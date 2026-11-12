'use strict';

/**
 * exercise-manage.js - the Logs area's Exercises list: every name this account has
 * logged, and Rename / Merge to fix a mistake.
 *
 * Rename and merge are ONE operation, moveExercise(from, to): every set logged under
 * `from` is logged under `to` instead. If `to` already exists that is a merge; if not
 * it is a rename. It is the whole-history version of log-edit.js renameExercise
 * (which is one session), and it records the same alias, so a future log of the old
 * name lands on the new one (service.js applies ExerciseAlias to every log).
 *
 * Health is a database per user: `db` is the caller's own file, so nothing here
 * filters by owner and an unfiltered query is correct. Additive only - no column,
 * no table, no row is ever deleted; sets keep their ids.
 *
 * Safe to repeat: after a move `from` has no sets, so the second call moves 0 and
 * says so. Two-step: without `confirm: true` it writes NOTHING and returns a preview
 * (how many sets and sessions would move), so the caller can show the number first.
 */

const { QueryTypes } = require('sequelize');
const { canonicalKey, groupKey, movementKey, dominantSpelling, variantSig } = require('./exercise-names');

const bad = (error, status = 400) => ({ ok: false, status, error });

/** Per spelling: sets, sessions, last date. The usage that decides which spelling is dominant. */
async function spellingStats(db) {
  const rows = await db.sequelize.query(
    `SELECT s.exerciseName AS name, COUNT(*) AS sets,
            COUNT(DISTINCT s.sessionId) AS sessions, MAX(ws.date) AS last
       FROM WorkoutSets s LEFT JOIN WorkoutSessions ws ON ws.id = s.sessionId
      WHERE s.exerciseName IS NOT NULL
      GROUP BY s.exerciseName
      ORDER BY MAX(ws.date) DESC, s.exerciseName ASC`,
    { type: QueryTypes.SELECT },
  );
  return rows.map(r => ({ name: r.name, sets: Number(r.sets), sessions: Number(r.sessions), last: r.last || null }));
}

/** Every exercise name, with counts and last-logged date; `similar` lists spellings of the same name. */
async function listExercises(db) {
  const rows = await spellingStats(db);
  const byKey = new Map();
  for (const r of rows) {
    const k = groupKey(r.name);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r.name);
  }
  return rows.map(r => ({
    ...r, similar: (byKey.get(groupKey(r.name)) || []).filter(n => n !== r.name),
  }));
}

const LB_PER_KG = 2.20462;
/** The best logged set of one spelling, as { text, score } (heaviest weight, else most reps, else longest time). */
function bestSet(rows) {
  let best = null;
  for (const r of rows) {
    if (r.failed) continue;
    const w = r.weight != null && Number(r.weight) > 0 ? Number(r.weight) * (r.weightUnit === 'kg' ? LB_PER_KG : 1) : null;
    let cand = null;
    if (w != null) cand = { score: 1e6 + w * 1000 + (Number(r.reps) || 0), text: `${Math.round(w * 10) / 10} lb x ${r.reps != null ? r.reps : '?'}` };
    else if (r.reps != null && Number(r.reps) > 0) cand = { score: 1e3 + Number(r.reps), text: `${Number(r.reps)} reps` };
    else if (r.duration != null && Number(r.duration) > 0) cand = { score: Number(r.duration), text: `${Number(r.duration)}s` };
    if (cand && (!best || cand.score > best.score)) best = cand;
  }
  return best ? best.text : null;
}

/**
 * Everything the Review & consolidate page needs.
 *
 *   groups       exercises that are ONE exercise by spelling (same groupKey), listed with every
 *                spelling, the dominant one first. Only groups with 2+ spellings need tidying;
 *                `all` has every group so the page can search them.
 *   suggestions  "Possibly the same?": different groups sharing the equipment-stripped movement
 *                (and the same iso / single-arm signature). Suggestions only - nothing merges them
 *                except a person pressing the button.
 */
async function reviewExercises(db) {
  const stats = await spellingStats(db);
  const setRows = await db.sequelize.query(
    `SELECT s.exerciseName AS name, s.reps, s.weight, s.weightUnit, s.duration, s.failed FROM WorkoutSets s WHERE s.exerciseName IS NOT NULL`,
    { type: QueryTypes.SELECT },
  );
  const rowsBy = new Map();
  for (const r of setRows) { if (!rowsBy.has(r.name)) rowsBy.set(r.name, []); rowsBy.get(r.name).push(r); }

  const byGroup = new Map();
  for (const st of stats) {
    const k = groupKey(st.name);
    if (!byGroup.has(k)) byGroup.set(k, []);
    byGroup.get(k).push({ ...st, best: bestSet(rowsBy.get(st.name) || []) });
  }
  const groups = [];
  for (const [key, sp] of byGroup) {
    const dom = dominantSpelling(sp.map(x => x.name), stats);
    sp.sort((a, b) => (a.name === dom ? -1 : b.name === dom ? 1 : b.sets - a.sets));
    groups.push({
      key, dominant: dom, spellings: sp,
      sets: sp.reduce((n, x) => n + x.sets, 0),
      last: sp.map(x => x.last || '').sort().pop() || null,
    });
  }
  groups.sort((a, b) => String(b.last || '').localeCompare(String(a.last || '')) || a.dominant.localeCompare(b.dominant));

  const byMovement = new Map();
  for (const g of groups) {
    const mk = movementKey(g.dominant);
    if (!byMovement.has(mk)) byMovement.set(mk, []);
    byMovement.get(mk).push(g);
  }
  const suggestions = [];
  for (const [mk, gs] of byMovement) {
    if (gs.length < 2 || !mk.split('|')[0]) continue;
    // Never across iso / single-arm: the movement key carries the signature, and this re-checks it.
    if (new Set(gs.map(g => variantSig(g.dominant))).size > 1) continue;
    suggestions.push({ movement: mk.split('|')[0], groups: gs.map(g => ({ key: g.key, name: g.dominant, names: g.spellings.map(x => x.name), sets: g.sets, last: g.last })) });
  }
  return { groups: groups.filter(g => g.spellings.length > 1), all: groups, suggestions };
}

/** The dominant EXISTING spelling of the exercise `name` is a spelling of, or null if none is logged. */
async function dominantFor(db, name, stats) {
  const st = stats || await spellingStats(db);
  const gk = groupKey(name);
  const same = st.filter(r => groupKey(r.name) === gk);
  return same.length ? dominantSpelling(same.map(r => r.name), st) : null;
}

/** Every set of one exercise (exact name, or any of an array of spellings), with its session's date, oldest first. */
async function setsFor(db, nameOrNames) {
  const names = Array.isArray(nameOrNames) ? nameOrNames : [nameOrNames];
  if (!names.length) return [];
  return db.sequelize.query(
    `SELECT s.id, s.sessionId, ws.date AS date, s.reps, s.weight, s.weightUnit, s.duration, s.failed
       FROM WorkoutSets s LEFT JOIN WorkoutSessions ws ON ws.id = s.sessionId
      WHERE s.exerciseName IN (:names)
      ORDER BY ws.date ASC, s.id ASC`,
    { replacements: { names }, type: QueryTypes.SELECT },
  );
}

async function moveExercise(db, fromIn, toIn, { confirm = false, exact = false } = {}) {
  const from = String(fromIn == null ? '' : fromIn).trim();
  let to = String(toIn == null ? '' : toIn).trim();
  if (!from) return bad('from is required');
  if (!to) return bad('the new name cannot be empty');
  if (to.length > 120) return bad('the new name is too long');
  // A rename must not FORK a spelling: if `to` is another spelling of an exercise already in the
  // log, the existing dominant spelling is used, not the literal `to`. `exact` (the UI's "make this
  // THE spelling") is the only way to impose a spelling.
  let redirectedFrom = null;
  if (!exact) {
    const dom = await dominantFor(db, to);
    if (dom && dom !== to) { redirectedFrom = to; to = dom; }
  }
  if (from === to) return redirectedFrom ? { ok: true, preview: false, moved: 0, alreadyDone: true, from, to, sets: 0, sessions: 0, merge: false, targetSets: 0, sessionsWithBoth: 0, redirectedFrom } : bad('that is already its name');

  const { WorkoutSet } = db;
  const fromSets = await WorkoutSet.findAll({ where: { exerciseName: from } });
  const toSets = await WorkoutSet.findAll({ where: { exerciseName: to } });
  if (!fromSets.length && !toSets.length) return bad(`no exercise named "${from}"`, 404);

  const fromSessions = new Set(fromSets.map(s => s.sessionId));
  const collisions = [...new Set(toSets.map(s => s.sessionId))].filter(id => fromSessions.has(id));
  const plan = {
    from, to, sets: fromSets.length, sessions: fromSessions.size,
    merge: toSets.length > 0, targetSets: toSets.length, sessionsWithBoth: collisions.length,
    ...(redirectedFrom ? { redirectedFrom } : {}),
  };
  // Nothing under `from`: either already moved (repeat) or never existed.
  if (!fromSets.length) return { ok: true, preview: false, moved: 0, alreadyDone: true, ...plan };
  if (!confirm) return { ok: true, preview: true, moved: 0, ...plan };

  const adoptId = toSets.map(s => s.exerciseId).find(v => v != null) || null;
  await db.sequelize.transaction(async (t) => {
    for (const sessionId of fromSessions) {
      const mine = fromSets.filter(s => s.sessionId === sessionId).sort((a, b) => (a.exerciseOrder - b.exerciseOrder) || (a.setNumber - b.setNumber) || (a.id - b.id));
      const theirs = toSets.filter(s => s.sessionId === sessionId);
      let order = null, next = 1;
      if (theirs.length) {
        // Same session holds both: join the target's block and keep numbering unbroken,
        // or the Logs page shows two blocks of "Set 1, Set 2".
        order = Math.min(...theirs.map(s => s.exerciseOrder));
        next = Math.max(...theirs.map(s => s.setNumber || 0)) + 1;
      }
      for (const s of mine) {
        s.exerciseName = to;
        if (adoptId != null) s.exerciseId = adoptId;
        if (theirs.length) { s.exerciseOrder = order; s.setNumber = next++; }
        await s.save({ transaction: t });
      }
    }
    if (db.PersonalRecord) await db.PersonalRecord.update({ exerciseName: to }, { where: { exerciseName: from }, transaction: t });
    if (db.ExerciseAlias) {
      // Future logs of the old spelling land on the new one; answers that pointed at
      // the old name now point at the new one (no alias chain to follow).
      await db.ExerciseAlias.update({ name: to }, { where: { name: from }, transaction: t });
      const key = canonicalKey(from);
      if (key && key !== canonicalKey(to)) {
        const [row, created] = await db.ExerciseAlias.findOrCreate({ where: { key }, defaults: { name: to }, transaction: t });
        if (!created && row.name !== to) { row.name = to; await row.save({ transaction: t }); }
      }
    }
  });
  return { ok: true, preview: false, moved: fromSets.length, alreadyDone: false, ...plan, remembered: Boolean(canonicalKey(from)) };
}

/**
 * Merge every spelling of ONE exercise into the chosen one. Two-step like moveExercise: without
 * confirm: true nothing is written and the result is the count to show. The names must all be
 * spellings of one exercise (same groupKey) - merging different exercises is moveExercise's job,
 * one deliberate pair at a time - and `target` must be one of them (the UI's "make this THE
 * spelling", so it is applied literally).
 */
async function mergeGroup(db, namesIn, targetIn, { confirm = false } = {}) {
  const target = String(targetIn == null ? '' : targetIn).trim();
  const names = [...new Set((Array.isArray(namesIn) ? namesIn : []).map(n => String(n == null ? '' : n).trim()).filter(Boolean))];
  if (!target) return bad('target is required');
  if (!names.length) return bad('names is required');
  if (!names.includes(target)) names.push(target);
  const gk = groupKey(target);
  const stray = names.find(n => groupKey(n) !== gk);
  if (stray) return bad(`"${stray}" is not a spelling of "${target}" - merge different exercises one pair at a time`);
  const stats = await spellingStats(db);
  const have = new Set(stats.map(r => r.name));
  if (!have.has(target)) return bad(`no exercise named "${target}"`, 404);
  // A spelling with no sets left was already merged (a repeat, or a second tab): skipped, not an error.
  const from = names.filter(n => n !== target && have.has(n));
  if (!from.length) return { ok: true, preview: !confirm, moved: 0, alreadyDone: true, target, from: [], sets: 0, sessions: 0, spellings: 0 };

  const per = [];
  for (const n of from) per.push(await moveExercise(db, n, target, { confirm: false, exact: true }));
  const bad1 = per.find(r => !r.ok);
  if (bad1) return bad1;
  const sessions = new Set();
  for (const n of from) (await db.WorkoutSet.findAll({ where: { exerciseName: n }, attributes: ['sessionId'] })).forEach(x => sessions.add(x.sessionId));
  const plan = {
    target, from, spellings: from.length, sets: per.reduce((n, r) => n + r.sets, 0), sessions: sessions.size,
    targetSets: (stats.find(r => r.name === target) || {}).sets || 0,
  };
  if (!confirm) return { ok: true, preview: true, moved: 0, alreadyDone: false, ...plan };
  let moved = 0;
  for (const n of from) { const r = await moveExercise(db, n, target, { confirm: true, exact: true }); if (!r.ok) return r; moved += r.moved; }
  return { ok: true, preview: false, moved, alreadyDone: moved === 0, ...plan };
}

module.exports = { listExercises, spellingStats, reviewExercises, dominantFor, setsFor, moveExercise, mergeGroup };
