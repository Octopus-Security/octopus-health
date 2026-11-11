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
const { canonicalKey } = require('./exercise-names');

const bad = (error, status = 400) => ({ ok: false, status, error });

/** Every exercise name, with counts and last-logged date; `similar` lists spellings of the same name. */
async function listExercises(db) {
  const rows = await db.sequelize.query(
    `SELECT s.exerciseName AS name, COUNT(*) AS sets,
            COUNT(DISTINCT s.sessionId) AS sessions, MAX(ws.date) AS last
       FROM WorkoutSets s LEFT JOIN WorkoutSessions ws ON ws.id = s.sessionId
      GROUP BY s.exerciseName
      ORDER BY MAX(ws.date) DESC, s.exerciseName ASC`,
    { type: QueryTypes.SELECT },
  );
  const byKey = new Map();
  for (const r of rows) {
    const k = canonicalKey(r.name);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r.name);
  }
  return rows.map(r => ({
    name: r.name, sets: Number(r.sets), sessions: Number(r.sessions), last: r.last || null,
    similar: (byKey.get(canonicalKey(r.name)) || []).filter(n => n !== r.name),
  }));
}

/** Every set of one exercise (exact name), with its session's date, oldest first. */
async function setsFor(db, name) {
  return db.sequelize.query(
    `SELECT s.id, s.sessionId, ws.date AS date, s.reps, s.weight, s.weightUnit, s.duration, s.failed
       FROM WorkoutSets s LEFT JOIN WorkoutSessions ws ON ws.id = s.sessionId
      WHERE s.exerciseName = :name
      ORDER BY ws.date ASC, s.id ASC`,
    { replacements: { name }, type: QueryTypes.SELECT },
  );
}

async function moveExercise(db, fromIn, toIn, { confirm = false } = {}) {
  const from = String(fromIn == null ? '' : fromIn).trim();
  const to = String(toIn == null ? '' : toIn).trim();
  if (!from) return bad('from is required');
  if (!to) return bad('the new name cannot be empty');
  if (to.length > 120) return bad('the new name is too long');
  if (from === to) return bad('that is already its name');

  const { WorkoutSet } = db;
  const fromSets = await WorkoutSet.findAll({ where: { exerciseName: from } });
  const toSets = await WorkoutSet.findAll({ where: { exerciseName: to } });
  if (!fromSets.length && !toSets.length) return bad(`no exercise named "${from}"`, 404);

  const fromSessions = new Set(fromSets.map(s => s.sessionId));
  const collisions = [...new Set(toSets.map(s => s.sessionId))].filter(id => fromSessions.has(id));
  const plan = {
    from, to, sets: fromSets.length, sessions: fromSessions.size,
    merge: toSets.length > 0, targetSets: toSets.length, sessionsWithBoth: collisions.length,
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

module.exports = { listExercises, setsFor, moveExercise };
