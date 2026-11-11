'use strict';

/**
 * exercise-stats.js - what one exercise's history says. PURE: rows in, numbers out.
 * No database, no model, no clock (callers pass `today`), so every rule below is
 * unit-tested and nothing here is a model's judgement.
 *
 * It computes PRs from the logged sets themselves rather than reading
 * PersonalRecord, because that table only ever holds "heaviest weight" (see
 * pr-detect.js) and was never rebuilt when sets were edited or merged. The stored
 * record is returned beside it (`stored`, via bestPerExercise) so a mismatch is visible.
 *
 * Units: kg sets are converted to lbs for comparison. Everything returned is lbs.
 * A set marked `failed` is a missed rep, not a lift, and is ignored for PRs,
 * estimated 1RM and the plateau rule.
 */

const LB_PER_KG = 2.20462;

// Estimated 1RM = Epley: weight * (1 + reps / 30). Only for 1-12 reps: past about
// 12 the estimate is mostly an endurance number and over-reads badly.
const E1RM_FORMULA = 'Epley: weight x (1 + reps / 30)';
const E1RM_MAX_REPS = 12;

// "Heaviest weight lifted for at least N reps".
const REP_TARGETS = [1, 3, 5, 8, 10, 12];

// ── The plateau rule (one place, named constants) ────────────────────────────
// Per session the metric is the best estimated 1RM of that session (best reps for
// a bodyweight exercise). The exercise is on a PLATEAU when ALL hold:
//   1. it has at least PLATEAU_SESSIONS + 1 sessions with a usable metric;
//   2. the most recent PLATEAU_SESSIONS sessions span at least PLATEAU_MIN_DAYS days
//      (four sessions in one week is a bad week, not a stall);
//   3. the best metric in those recent sessions is NOT at least PLATEAU_MIN_GAIN (1%)
//      above the best metric of every earlier session.
// "declining" is a plateau whose recent best is below PLATEAU_DECLINE (95%) of the earlier best.
const PLATEAU_SESSIONS = 4;
const PLATEAU_MIN_DAYS = 14;
const PLATEAU_MIN_GAIN = 0.01;
const PLATEAU_DECLINE = 0.95;

const round1 = n => Math.round(n * 10) / 10;
const toLbs = (w, unit) => (unit === 'kg' ? w * LB_PER_KG : w);

function e1rm(weight, reps) {
  if (!(weight > 0) || !Number.isFinite(reps) || reps < 1 || reps > E1RM_MAX_REPS) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

/** Normalise raw rows ({date, reps, weight, weightUnit, duration, failed}) and drop the unusable. */
function cleanSets(rows) {
  const out = [];
  for (const r of rows || []) {
    if (!r || !r.date || r.failed) continue;
    const w = r.weight != null && Number.isFinite(Number(r.weight)) ? toLbs(Number(r.weight), r.weightUnit) : null;
    out.push({
      date: String(r.date).slice(0, 10),
      sessionId: r.sessionId != null ? r.sessionId : String(r.date).slice(0, 10),
      reps: r.reps != null && Number.isFinite(Number(r.reps)) ? Number(r.reps) : null,
      weight: w != null && w > 0 ? w : null,
      duration: r.duration != null && Number.isFinite(Number(r.duration)) ? Number(r.duration) : null,
    });
  }
  return out;
}

function modeOf(sets) {
  if (sets.some(s => s.weight != null)) return 'weighted';
  if (sets.some(s => s.reps != null)) return 'reps';
  if (sets.some(s => s.duration != null)) return 'timed';
  return 'none';
}

/** One point per session, oldest first. */
function sessionSeries(sets, mode) {
  const by = new Map();
  for (const s of sets) {
    const k = `${s.date}#${s.sessionId}`;
    if (!by.has(k)) by.set(k, { date: s.date, sets: [] });
    by.get(k).sets.push(s);
  }
  const pts = [];
  for (const { date, sets: ss } of by.values()) {
    const p = { date, sets: ss.length };
    if (mode === 'weighted') {
      const w = ss.filter(x => x.weight != null);
      if (!w.length) continue;
      const top = w.reduce((b, x) => (x.weight > b.weight || (x.weight === b.weight && (x.reps || 0) > (b.reps || 0)) ? x : b));
      p.topWeight = round1(top.weight);
      p.topReps = top.reps;
      const est = w.map(x => e1rm(x.weight, x.reps)).filter(v => v != null);
      p.e1rm = est.length ? round1(Math.max(...est)) : null;
      p.volume = Math.round(w.reduce((a, x) => a + x.weight * (x.reps || 0), 0));
      p.metric = p.e1rm;
    } else if (mode === 'reps') {
      const r = ss.filter(x => x.reps != null);
      if (!r.length) continue;
      p.topReps = Math.max(...r.map(x => x.reps));
      p.volume = r.reduce((a, x) => a + x.reps, 0);
      p.metric = p.topReps;
    } else if (mode === 'timed') {
      const d = ss.filter(x => x.duration != null);
      if (!d.length) continue;
      p.topSeconds = Math.max(...d.map(x => x.duration));
      p.metric = p.topSeconds;
    } else continue;
    if (p.metric == null) continue;
    pts.push(p);
  }
  return pts.sort((a, b) => a.date.localeCompare(b.date));
}

function prs(sets, mode) {
  const out = { mode };
  if (mode === 'weighted') {
    const w = sets.filter(s => s.weight != null);
    const heavy = w.reduce((b, s) => (!b || s.weight > b.weight || (s.weight === b.weight && (s.reps || 0) > (b.reps || 0)) ? s : b), null);
    out.heaviest = heavy && { weight: round1(heavy.weight), reps: heavy.reps, date: heavy.date };
    let best = null;
    for (const s of w) { const v = e1rm(s.weight, s.reps); if (v != null && (!best || v > best.value)) best = { value: round1(v), weight: round1(s.weight), reps: s.reps, date: s.date }; }
    out.bestE1rm = best && { ...best, formula: E1RM_FORMULA };
    let vol = null;
    for (const s of w) { const v = s.weight * (s.reps || 0); if (s.reps && (!vol || v > vol.volume)) vol = { volume: Math.round(v), weight: round1(s.weight), reps: s.reps, date: s.date }; }
    out.bestVolumeSet = vol;
    out.repPRs = REP_TARGETS.map(n => {
      let hit = null;
      for (const s of w) if (s.reps != null && s.reps >= n && (!hit || s.weight > hit.weight)) hit = s;
      return { reps: n, weight: hit ? round1(hit.weight) : null, date: hit ? hit.date : null };
    });
  } else if (mode === 'reps') {
    const r = sets.filter(s => s.reps != null);
    const top = r.reduce((b, s) => (!b || s.reps > b.reps ? s : b), null);
    out.mostReps = top && { reps: top.reps, date: top.date };
  } else if (mode === 'timed') {
    const d = sets.filter(s => s.duration != null);
    const top = d.reduce((b, s) => (!b || s.duration > b.duration ? s : b), null);
    out.longest = top && { seconds: top.duration, date: top.date };
  }
  return out;
}

const dayNum = d => Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400000);

/** The plateau rule above, on a session series. Returns { status, ... } - never throws. */
function plateau(series) {
  const rule = { sessions: PLATEAU_SESSIONS, minDays: PLATEAU_MIN_DAYS, minGain: PLATEAU_MIN_GAIN };
  if (series.length < PLATEAU_SESSIONS + 1) return { status: 'not-enough-data', have: series.length, need: PLATEAU_SESSIONS + 1, rule };
  const recent = series.slice(-PLATEAU_SESSIONS);
  const earlier = series.slice(0, -PLATEAU_SESSIONS);
  const days = dayNum(recent[recent.length - 1].date) - dayNum(recent[0].date);
  const priorBest = Math.max(...earlier.map(p => p.metric));
  const recentBest = Math.max(...recent.map(p => p.metric));
  const base = { rule, days, priorBest, recentBest, since: earlier.length ? earlier.reduce((b, p) => (p.metric >= b.metric ? p : b)).date : null };
  if (days < PLATEAU_MIN_DAYS) return { ...base, status: 'too-recent' };
  if (recentBest >= priorBest * (1 + PLATEAU_MIN_GAIN)) return { ...base, status: 'progressing' };
  return { ...base, status: recentBest < priorBest * PLATEAU_DECLINE ? 'declining' : 'plateau' };
}

// General, conservative training principles. They are NOT a diagnosis of why one
// lifter stalled, and none of them is a claim about injury: pain, or anything that
// feels wrong, is a question for a clinician. Reference for the general idea of
// progressive overload and variation: ACSM Position Stand, "Progression Models in
// Resistance Training for Healthy Adults" (Med Sci Sports Exerc, 2009).
const TIPS = [
  { id: 'recovery', title: 'Check sleep, food and stress first', text: 'Most stalls are recovery stalls. Look at the last two weeks: enough sleep, enough total food and protein, and no unusually hard stretch at work or elsewhere. Fix that before changing the programme.' },
  { id: 'deload', title: 'Take an easier week', text: 'A planned lighter week (roughly 40-60% less volume, same exercises, stop well short of failure) lets fatigue clear. Then retest. It is a normal part of progressing, not a step back.' },
  { id: 'reps', title: 'Change the rep range for a block', text: 'If you have been in the same rep range for weeks, move it for 3-4 weeks (for example from sets of 5 to sets of 8-10, or the reverse), then come back. The new range often moves the old one.' },
  { id: 'volume', title: 'Add or trim volume deliberately', text: 'Adding one or two hard sets a week often restarts progress; if you are already doing a lot, trimming a little can do the same. Change one thing at a time so you can tell what worked.' },
  { id: 'frequency', title: 'Practise it a little more often', text: 'Training the lift twice a week instead of once, spreading the same total sets, gives more chances to practise the movement without much more fatigue per day.' },
  { id: 'variation', title: 'Use a close variation for a few weeks', text: 'A pause, a different grip or stance, a slightly different angle, or a nearby exercise can work the weak point and carry back to the main lift. Keep the main lift in at lower volume.' },
  { id: 'small', title: 'Make the jumps smaller', text: 'If the smallest step you take is large relative to the lift, try smaller increments (fractional plates), or add a rep per set before adding weight.' },
  { id: 'log', title: 'Check the log is comparable', text: 'Different bars, machines or gyms on the same exercise name can make a number look stalled when it is not. Merge only names that are truly the same lift.' },
];

function tipsFor(pl) {
  if (!pl || (pl.status !== 'plateau' && pl.status !== 'declining')) return [];
  const order = pl.status === 'declining'
    ? ['recovery', 'deload', 'log', 'volume', 'reps', 'frequency', 'variation', 'small']
    : ['recovery', 'reps', 'volume', 'frequency', 'variation', 'deload', 'small', 'log'];
  return order.map(id => TIPS.find(t => t.id === id));
}

const DISCLAIMER = 'General training information, not medical advice. If something hurts or feels wrong, stop and ask a clinician or qualified coach; these tips are not rehab.';

/**
 * @param {Array} rows  raw set rows for ONE exercise, with the session's date
 */
function analyse(rows) {
  const sets = cleanSets(rows);
  const mode = modeOf(sets);
  const series = sessionSeries(sets, mode);
  const pl = plateau(series);
  return {
    mode, unit: 'lbs', sessions: series.length, series,
    prs: prs(sets, mode),
    plateau: pl,
    tips: tipsFor(pl),
    disclaimer: DISCLAIMER,
  };
}

module.exports = {
  analyse, e1rm, cleanSets, sessionSeries, plateau, tipsFor, prs,
  E1RM_FORMULA, E1RM_MAX_REPS, REP_TARGETS,
  PLATEAU_SESSIONS, PLATEAU_MIN_DAYS, PLATEAU_MIN_GAIN, PLATEAU_DECLINE, LB_PER_KG,
};
