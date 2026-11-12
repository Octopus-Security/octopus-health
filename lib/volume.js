'use strict';

/**
 * volume.js - training volume per muscle group, from logged sets. PURE: rows in,
 * numbers out. No database, no clock (callers pass dates), so every rule below is
 * unit-tested. Full description and JSON shape: docs/MUSCLE-VOLUME.md.
 *
 * Credit. A set credits the muscles of its exercise (lib/muscles.js normalize, the same
 * vocabulary the Body Map uses): PRIMARY muscles at PRIMARY_CREDIT (1), SECONDARY at
 * SECONDARY_CREDIT (0.5). A muscle listed as both gets the larger credit once. The 0.5 is a
 * configurable assumption, not a measured constant: sources differ on how much
 * indirect work counts, and half is a conventional middle.
 *
 * Per muscle, per window:
 *   sets          raw sets that touched the muscle (any credit, any effort)
 *   hardSets      sets x credit, counting only "hard" sets: a set with reps >= 1 or a hold
 *                 > 0 s, that is not tagged RPE < 5 (RPE < 5 is read as a warm-up). A FAILED
 *                 set still counts: it was work, only not a successful rep.
 *   weeklySets    hardSets scaled to 7 days (hardSets x 7 / windowDays); what the guideline
 *                 is compared with, so a 14-day and a 30-day window are comparable.
 *   reps          reps x credit
 *   tonnageLbs    reps x load x credit, load in lbs (kg x 2.20462). See bodyweight below.
 *   seconds       held/timed seconds x credit
 *
 * Bodyweight. A bodyweight set (no weight logged) adds to sets, hardSets and reps but NOT to
 * tonnage: the athlete's body mass is not in the log and guessing it would make the number
 * look more exact than it is. If a weight IS logged on a bodyweight exercise (weighted
 * pull-up, dip belt) that added load is tonnage. Tonnage therefore understates bodyweight
 * work, and hardSets is the fairer cross-exercise measure. Timed sets (planks, holds) have no
 * reps: they count as one hard set each and their seconds are summed; they add no tonnage.
 *
 * Excluded: recovery-category exercises (stretches, mobility), and sets that resolve to no
 * known muscle (reported in `unmapped`, never guessed).
 */

const M = require('./muscles');
const { addDays, daysBetween } = require('./et');

const LB_PER_KG = 2.20462;
const PRIMARY_CREDIT = 1;
const SECONDARY_CREDIT = 0.5;
const WARMUP_RPE_BELOW = 5;

// Default weekly hard-set guideline per muscle. Source: Schoenfeld, Ogborn & Krieger (2017),
// "Dose-response relationship between weekly resistance training volume and increases in muscle
// mass", J Sports Sci 35(11): more weekly sets per muscle gave more growth, with >= 10 sets/week
// the best-supported band. The upper bound of 20 is NOT from that paper: it is a conservative
// working ceiling many coaches use (Israetel's "maximum recoverable volume" idea), so treat
// it as an assumption. Both are overridable per request.
const DEFAULT_GUIDELINE = Object.freeze({ min: 10, max: 20 });

const MAX_WINDOWS = 2000;
const MAX_LENGTH = 366;

const round = (n, p = 1) => { const f = 10 ** p; return Math.round(n * f) / f; };
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Which muscles does an exercise credit, and how much. {} for a stretch or an unmapped one. */
function creditsFor(def, opts = {}) {
  const pc = opts.primaryCredit != null ? opts.primaryCredit : PRIMARY_CREDIT;
  const sc = opts.secondaryCredit != null ? opts.secondaryCredit : SECONDARY_CREDIT;
  if (!def || def.category === 'recovery') return {};
  const out = {};
  for (const m of M.normalize(def.secondaryMuscles).muscles) out[m] = sc;
  for (const m of M.normalize(def.primaryMuscles).muscles) out[m] = Math.max(out[m] || 0, pc);
  return out;
}

/** The numbers for ONE set: { hard, reps, tonnage, seconds } before credit. */
function setFacts(s) {
  const reps = s.reps != null && Number.isFinite(Number(s.reps)) && Number(s.reps) > 0 ? Number(s.reps) : 0;
  const secs = s.duration != null && Number.isFinite(Number(s.duration)) && Number(s.duration) > 0 ? Number(s.duration) : 0;
  const w = s.weight != null && Number(s.weight) > 0 ? Number(s.weight) * (s.weightUnit === 'kg' ? LB_PER_KG : 1) : 0;
  const warmup = s.rpe != null && Number(s.rpe) < WARMUP_RPE_BELOW;
  return {
    hard: (reps > 0 || secs > 0) && !warmup,
    reps: warmup ? 0 : reps,
    tonnage: warmup ? 0 : reps * w,
    seconds: warmup ? 0 : (reps > 0 ? 0 : secs), // a rep set's duration is tempo/rest noise, not a hold
  };
}

/**
 * Sets -> per-day, per-muscle buckets.
 * `sets`: [{ date, exerciseName, exerciseId, reps, weight, weightUnit, duration, rpe, failed }]
 * `resolveDef(set)` -> an ExerciseDefinition-like { category, primaryMuscles, secondaryMuscles } or null.
 */
function bucketByDay(sets, resolveDef, opts = {}) {
  const days = new Map();
  let unmapped = 0, considered = 0;
  for (const s of sets || []) {
    if (!s || !isDate(String(s.date).slice(0, 10))) continue;
    const def = resolveDef(s);
    if (def && def.category === 'recovery') continue;
    considered++;
    const credits = creditsFor(def, opts);
    const muscles = Object.keys(credits);
    if (!muscles.length) { unmapped++; continue; }
    const f = setFacts(s);
    const date = String(s.date).slice(0, 10);
    const day = days.get(date) || new Map();
    for (const m of muscles) {
      const c = credits[m];
      const b = day.get(m) || { sets: 0, hardSets: 0, reps: 0, tonnageLbs: 0, seconds: 0 };
      b.sets += 1;
      if (f.hard) b.hardSets += c;
      b.reps += f.reps * c; b.tonnageLbs += f.tonnage * c; b.seconds += f.seconds * c;
      day.set(m, b);
    }
    days.set(date, day);
  }
  return { days, unmapped, considered };
}

/**
 * The windows. A window is `length` calendar days starting `step` days after the previous
 * one: with from=D1, length 30, step 1 -> D1..D30, D2..D31, D3..D32 ... Only FULL windows that
 * end on or before `to` are produced (a short last window would read as a quiet month).
 */
function windowList(from, to, length, step) {
  const out = [];
  for (let s = from; addDays(s, length - 1) <= to; s = addDays(s, step)) {
    out.push({ start: s, end: addDays(s, length - 1) });
    if (out.length > MAX_WINDOWS) break;
  }
  return out;
}

/** Validate and default the request. Returns { ok, error } or { ok:true, ...clean }. */
function parseParams(q, { today, firstDate } = {}) {
  const num = (v, d) => (v == null || v === '' ? d : Number(v));
  const length = num(q.length, 30), step = num(q.step, 1);
  if (!Number.isInteger(length) || length < 1 || length > MAX_LENGTH) return { ok: false, error: `length must be a whole number of days, 1-${MAX_LENGTH}` };
  if (!Number.isInteger(step) || step < 1 || step > MAX_LENGTH) return { ok: false, error: `step must be a whole number of days, 1-${MAX_LENGTH}` };
  const to = q.to || today;
  if (!isDate(to)) return { ok: false, error: 'to must be YYYY-MM-DD' };
  // Default span: the last 120 days, but never earlier than the first saved set, and never shorter than one window.
  let from = q.from;
  if (!from) {
    from = addDays(to, -119);
    if (firstDate && firstDate > from) from = firstDate;
    if (addDays(from, length - 1) > to) from = addDays(to, -(length - 1));
  }
  if (!isDate(from)) return { ok: false, error: 'from must be YYYY-MM-DD' };
  if (from > to) return { ok: false, error: 'from is after to' };
  const min = num(q.guidelineMin, DEFAULT_GUIDELINE.min), max = num(q.guidelineMax, DEFAULT_GUIDELINE.max);
  if (!(min >= 0) || !(max >= min) || !Number.isFinite(max)) return { ok: false, error: 'guideline needs 0 <= guidelineMin <= guidelineMax' };
  const primaryCredit = num(q.primaryCredit, PRIMARY_CREDIT), secondaryCredit = num(q.secondaryCredit, SECONDARY_CREDIT);
  for (const [k, v] of [['primaryCredit', primaryCredit], ['secondaryCredit', secondaryCredit]]) {
    if (!(v >= 0 && v <= 1)) return { ok: false, error: `${k} must be between 0 and 1` };
  }
  if (windowList(from, to, length, step).length > MAX_WINDOWS) return { ok: false, error: `more than ${MAX_WINDOWS} windows; raise step or shorten the range` };
  return { ok: true, from, to, length, step, guideline: { min, max }, primaryCredit, secondaryCredit };
}

/** untrained (no hard sets), under (< min), ok, over (> max), against weekly sets. */
function statusFor(weeklySets, g) {
  if (!(weeklySets > 0)) return 'untrained';
  if (weeklySets < g.min) return 'under';
  if (weeklySets > g.max) return 'over';
  return 'ok';
}

/**
 * The whole report. `sets` + `resolveDef` as bucketByDay; `p` from parseParams.
 * Muscles reported: every id in lib/muscles MUSCLES, so the grid never changes shape.
 */
function compute(sets, resolveDef, p) {
  const { days, unmapped, considered } = bucketByDay(sets, resolveDef, p);
  const muscleIds = Object.keys(M.MUSCLES);
  const windows = windowList(p.from, p.to, p.length, p.step).map(w => {
    const acc = new Map();
    for (let d = w.start, i = 0; i < p.length; d = addDays(d, 1), i++) {
      const day = days.get(d);
      if (!day) continue;
      for (const [m, b] of day) {
        const a = acc.get(m) || { sets: 0, hardSets: 0, reps: 0, tonnageLbs: 0, seconds: 0 };
        a.sets += b.sets; a.hardSets += b.hardSets; a.reps += b.reps; a.tonnageLbs += b.tonnageLbs; a.seconds += b.seconds;
        acc.set(m, a);
      }
    }
    const muscles = {};
    for (const m of muscleIds) {
      const a = acc.get(m) || { sets: 0, hardSets: 0, reps: 0, tonnageLbs: 0, seconds: 0 };
      const weekly = a.hardSets * 7 / p.length;
      muscles[m] = {
        sets: a.sets, hardSets: round(a.hardSets), weeklySets: round(weekly), reps: round(a.reps),
        tonnageLbs: Math.round(a.tonnageLbs), seconds: Math.round(a.seconds),
        status: statusFor(weekly, p.guideline),
      };
    }
    return { start: w.start, end: w.end, muscles };
  });
  return {
    params: { from: p.from, to: p.to, length: p.length, step: p.step, guideline: p.guideline, primaryCredit: p.primaryCredit, secondaryCredit: p.secondaryCredit },
    muscles: muscleIds.map(id => ({ id, name: M.MUSCLES[id].name, region: M.MUSCLES[id].region, drawn: M.MUSCLES[id].drawn })),
    windows,
    skipped: { unmapped, considered },
  };
}

const CSV_COLUMNS = ['window_start', 'window_end', 'window_days', 'muscle', 'muscle_name', 'sets', 'hard_sets', 'weekly_sets', 'reps', 'tonnage_lbs', 'seconds', 'status', 'guideline_min', 'guideline_max'];

const csvCell = v => {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // spreadsheet formula guard; ids and numbers never start so
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Long format: one row per window x muscle. */
function toCsv(report) {
  const g = report.params.guideline;
  const names = Object.fromEntries(report.muscles.map(m => [m.id, m.name]));
  const lines = [CSV_COLUMNS.join(',')];
  for (const w of report.windows) {
    for (const m of report.muscles) {
      const c = w.muscles[m.id];
      lines.push([w.start, w.end, report.params.length, m.id, names[m.id], c.sets, c.hardSets, c.weeklySets, c.reps, c.tonnageLbs, c.seconds, c.status, g.min, g.max].map(csvCell).join(','));
    }
  }
  return lines.join('\n') + '\n';
}

module.exports = {
  PRIMARY_CREDIT, SECONDARY_CREDIT, WARMUP_RPE_BELOW, DEFAULT_GUIDELINE, MAX_WINDOWS, MAX_LENGTH, CSV_COLUMNS,
  creditsFor, setFacts, bucketByDay, windowList, parseParams, statusFor, compute, toCsv, daysBetween,
};
