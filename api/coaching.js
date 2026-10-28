'use strict';

/**
 * coaching.js - the "IP method" progression engine (HANDOFF item 91, phase 3).
 *
 * Progress the movement PATTERN (horizontal/vertical push and pull, squat, hinge),
 * not one exercise. Each variation in content/coaching/patterns.json biases a
 * sector of the lift. When the variation you are on stops moving, rotate to one
 * that biases your weak sector; do not add sets and do not let form slip. There
 * are no planned deloads. Everything here is derived from the workout log on every
 * read - nothing is stored except the two columns a failed-set tap writes.
 *
 * Owner decisions (2026-10-27):
 *   - PLATEAU: a variation is plateaued after PLATEAU_EXPOSURES (4) exposures with
 *     no rep/load PR. An exposure is one finished session containing the variation.
 *   - WEAK POINT: comes only from a tap on a set the owner marked FAILED:
 *     bottom / middle / top / grip (WorkoutSets.failed + failPoint).
 *
 * Decisions where the spec was silent (also recorded in HANDOFF item 91):
 *   - A PR is relative to the variation's OWN history: the exposure's best set must
 *     beat every earlier exposure of that variation (weight first, then reps at it;
 *     bodyweight and timed sets compare on reps / seconds). The first exposure is a PR.
 *   - Only finished sessions count. A failed set still counts as work done.
 *   - Weak point = the most common tap among failed sets in the current variation
 *     since its last PR; with none there, the pattern's last 10 taps. Ties go to
 *     the most recent tap.
 *   - Recommendation: only variations the active gyms' equipment allows; one that
 *     biases the weak point first, then never-tried, then longest ago. With no weak
 *     point known it says so and asks for a tap instead of guessing.
 */

const fs = require('fs');
const path = require('path');
const { canonicalKey } = require('./exercise-names');
const E = require('./equipment');

const PLATEAU_EXPOSURES = 4;
const WEAK_POINTS = ['bottom', 'middle', 'top', 'grip'];
const RECENT_TAPS = 10;

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'coaching', 'patterns.json'), 'utf8'));
const PATTERNS = DATA.patterns;

// canonical logged-name -> { pattern, variation }
const BY_NAME = new Map();
for (const p of PATTERNS) for (const v of p.variations) for (const n of [v.name, ...(v.names || [])]) {
  const k = canonicalKey(n);
  if (!BY_NAME.has(k)) BY_NAME.set(k, { pattern: p, variation: v });
}

/** Which pattern/variation does a logged exercise name belong to? null when none. */
function match(exerciseName) {
  return BY_NAME.get(canonicalKey(exerciseName)) || null;
}

/** [primary, secondary] - compared lexicographically. Weight, then reps; unweighted: reps; timed: seconds. */
function setScore(s) {
  const w = Number(s.weight) || 0;
  const r = s.reps != null ? Number(s.reps) : (s.duration != null ? Number(s.duration) : 0);
  return [w, r || 0];
}
const better = (a, b) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);

/**
 * @param sets rows { id, sessionId, date, reps, weight, duration, failed, failPoint, exerciseName }
 *   (any order). Returns exposures per variation: [{sessionId,date,best:[w,r],pr,sets,failTaps}], oldest first.
 */
function exposuresOf(sets) {
  const bySession = new Map(); // `${variationId}|${sessionId}` -> exposure
  for (const s of sets) {
    const m = match(s.exerciseName);
    if (!m) continue;
    const key = `${m.variation.id}|${s.sessionId}`;
    let ex = bySession.get(key);
    if (!ex) { ex = { pattern: m.pattern.id, variation: m.variation.id, sessionId: s.sessionId, date: s.date, best: [0, 0], sets: 0, failTaps: [] }; bySession.set(key, ex); }
    ex.sets += 1;
    const sc = setScore(s);
    if (better(sc, ex.best)) ex.best = sc;
    if (s.failed && WEAK_POINTS.includes(s.failPoint)) ex.failTaps.push({ point: s.failPoint, setId: s.id });
  }
  const byVar = new Map();
  for (const ex of bySession.values()) (byVar.get(ex.variation) || byVar.set(ex.variation, []).get(ex.variation)).push(ex);
  for (const list of byVar.values()) {
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.sessionId - b.sessionId));
    let top = null;
    for (const ex of list) { ex.pr = top === null || better(ex.best, top); if (ex.pr) top = ex.best; }
  }
  return byVar;
}

/** Exposures since the last PR (0 right after one). */
function sinceLastPr(list) {
  let last = -1;
  list.forEach((e, i) => { if (e.pr) last = i; });
  return last < 0 ? 0 : list.length - 1 - last;
}

function tally(taps) {
  const counts = Object.fromEntries(WEAK_POINTS.map(p => [p, 0]));
  for (const t of taps) counts[t.point] += 1;
  return counts;
}
/** Most common tap; ties to the most recent (taps are oldest first). */
function modeOf(taps) {
  if (!taps.length) return null;
  const counts = tally(taps);
  const max = Math.max(...Object.values(counts));
  for (let i = taps.length - 1; i >= 0; i--) if (counts[taps[i].point] === max) return { point: taps[i].point, counts, taps: taps.length };
  return null;
}

/** Variations that bias a weak point (the owner's vocabulary is also bias vocabulary). */
const biases = (v, point) => (v.bias || []).includes(point);

function available(v, have) {
  return !have || E.unmet(v.requires, have).length === 0;
}

/**
 * The whole picture for one pattern.
 * @param have Set of equipment ids the active gyms provide, or null for "do not filter"
 */
function patternStatus(pattern, byVar, have) {
  const all = pattern.variations.map(v => ({ v, list: byVar.get(v.id) || [] }));
  const done = all.filter(x => x.list.length);
  if (!done.length) return { id: pattern.id, name: pattern.name, current: null, plateau: false, weakPoint: null, recommendation: null, variations: all.map(x => brief(x.v, x.list, have)) };

  const latest = (x) => x.list[x.list.length - 1];
  const cur = done.reduce((a, b) => {
    const ea = latest(a), eb = latest(b);
    return (eb.date > ea.date || (eb.date === ea.date && eb.sessionId > ea.sessionId)) ? b : a;
  });
  const since = sinceLastPr(cur.list);
  const plateau = since >= PLATEAU_EXPOSURES;

  // Weak point: taps in the current variation since its last PR, else the pattern's recent taps.
  let lastPr = -1; cur.list.forEach((e, i) => { if (e.pr) lastPr = i; });
  const windowTaps = cur.list.slice(Math.max(lastPr, 0)).flatMap(e => e.failTaps);
  const patternTaps = done.flatMap(x => x.list.map(e => ({ date: e.date, sid: e.sessionId, taps: e.failTaps })))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.sid - b.sid)).flatMap(x => x.taps).slice(-RECENT_TAPS);
  const weakPoint = modeOf(windowTaps) || modeOf(patternTaps);

  let recommendation = null;
  if (plateau) {
    const others = all.filter(x => x.v.id !== cur.v.id && available(x.v, have));
    const rank = x => [
      weakPoint && biases(x.v, weakPoint.point) ? 0 : 1,
      x.list.length ? 1 : 0,
      x.list.length ? latest(x).date : '',
    ];
    others.sort((a, b) => { const ra = rank(a), rb = rank(b); return ra[0] - rb[0] || ra[1] - rb[1] || (ra[2] < rb[2] ? -1 : ra[2] > rb[2] ? 1 : 0); });
    const pick = others[0];
    if (pick) {
      const hits = weakPoint && biases(pick.v, weakPoint.point);
      recommendation = {
        variation: pick.v.id, name: pick.v.name, bias: pick.v.bias,
        why: hits
          ? `You have failed sets at the ${weakPoint.point}; ${pick.v.name} biases the ${weakPoint.point}.`
          : weakPoint
            ? `No available variation biases the ${weakPoint.point}, so this is the least-recent one.`
            : 'No failed-set taps yet, so this is the one you have done least recently. Tap where a failed set gave out and the next suggestion will target it.',
        rule: 'Keep the same sets and reps. Do not add sets, and stop a set when form slips.',
      };
    } else {
      recommendation = { variation: null, name: null, bias: [], why: 'No other variation in this pattern fits the equipment at your active gyms.', rule: null };
    }
  }

  return {
    id: pattern.id, name: pattern.name,
    current: { id: cur.v.id, name: cur.v.name, bias: cur.v.bias, exposures: cur.list.length, sinceLastPr: since, exposuresToPlateau: Math.max(0, PLATEAU_EXPOSURES - since), lastDate: latest(cur).date, best: latest(cur).best },
    plateau, weakPoint, recommendation,
    variations: all.map(x => brief(x.v, x.list, have)),
  };
}

function brief(v, list, have) {
  return { id: v.id, name: v.name, bias: v.bias, exposures: list.length, lastDate: list.length ? list[list.length - 1].date : null, available: available(v, have) };
}

/** Pure entry point: logged sets + equipment in, every pattern's status out. */
function analyse(sets, have = null) {
  const byVar = exposuresOf(sets);
  return { plateauExposures: PLATEAU_EXPOSURES, weakPoints: WEAK_POINTS, patterns: PATTERNS.map(p => patternStatus(p, byVar, have)) };
}

// ── database half ────────────────────────────────────────────────────────────

/** Sets of finished sessions whose exercise belongs to some pattern. */
async function loadSets(db) {
  const { QueryTypes } = require('sequelize');
  const rows = await db.sequelize.query(
    `SELECT s.id, s.sessionId, ws.date AS date, s.exerciseName, s.reps, s.weight, s.duration, s.failed, s.failPoint
       FROM WorkoutSets s JOIN WorkoutSessions ws ON ws.id = s.sessionId
      WHERE ws.status = 'finished'`, { type: QueryTypes.SELECT });
  return rows.filter(r => match(r.exerciseName)).map(r => ({ ...r, failed: !!r.failed }));
}

/** Equipment ids the active gyms provide; null (no filtering) if there are no gyms or none active. */
async function equipmentHave(db) {
  const G = require('./gyms-store');
  const gyms = (await G.listGyms(db)).filter(g => g.active);
  if (!gyms.length) return null;
  return new Set(gyms.flatMap(g => g.effective));
}

async function status(db) {
  return analyse(await loadSets(db), await equipmentHave(db));
}

module.exports = { PATTERNS, PLATEAU_EXPOSURES, WEAK_POINTS, match, setScore, exposuresOf, sinceLastPr, analyse, status, loadSets, equipmentHave };
