'use strict';

const { canonicalKey } = require('./exercise-names');

/**
 * Correcting a workout that is already in the log.
 *
 * Until 2026-10-11 the only correction anywhere was "delete the whole session":
 * the Logs page had one Delete button, the service API (what cortex/Neith call)
 * had no edit route at all. So a set logged at 50 instead of 95, an exercise
 * under the wrong name, or a session stamped with the wrong day could only be
 * fixed by throwing the day away and re-logging it — through the same chat
 * that got it wrong.
 *
 * One module, two doors: the browser (api/web-log-edit.js, cookie session) and
 * the service API (api/routes/service.js, X-Service-User). Both pass the
 * account's own database, so there is no owner check to forget — health is a
 * database per user, and an id that is not in this file simply is not found.
 *
 * Every function returns { ok, ... } or { ok:false, status, error }, never
 * throws for bad input, so both doors can relay the result unchanged.
 */

const { detectPR } = require('./pr-detect');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = ['strength', 'conditioning', 'mma', 'bjj', 'muay_thai', 'recovery'];

const bad = (error, status = 400) => ({ ok: false, status, error });
const notFound = what => bad(`${what} not found`, 404);

const has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);

/** A number field: '' or null clears it, anything else must be a finite number ≥ 0. */
function num(v, { int = false } = {}) {
  if (v === '' || v === null) return { value: null };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return { error: `"${v}" is not a number` };
  return { value: int ? Math.round(n) : n };
}

/** The session with its sets, in Logs-page order. */
async function getSession(db, id) {
  const s = await db.WorkoutSession.findByPk(id);
  if (!s) return notFound('session');
  const sets = await db.WorkoutSet.findAll({
    where: { sessionId: s.id },
    order: [['exerciseOrder', 'ASC'], ['setNumber', 'ASC']],
  });
  return { ok: true, session: { ...s.toJSON(), sets: sets.map(x => x.toJSON()) } };
}

/** Date, title, type, notes, effort, duration. Only the fields present change. */
async function editSession(db, id, body = {}) {
  const s = await db.WorkoutSession.findByPk(id);
  if (!s) return notFound('session');

  if (has(body, 'date')) {
    if (!DATE_RE.test(String(body.date))) return bad('date must be YYYY-MM-DD');
    s.date = body.date;
  }
  if (has(body, 'type')) {
    if (!TYPES.includes(body.type)) return bad(`type must be one of ${TYPES.join(', ')}`);
    s.type = body.type;
  }
  // A title typed here is the person's own correction, so it is taken as given —
  // the known-title check in session-titles.js exists to stop a MODEL inventing
  // one, not to stop someone renaming their own workout.
  if (has(body, 'title')) s.title = String(body.title || '').trim() || null;
  if (has(body, 'notes')) s.notes = String(body.notes || '').trim() || null;
  for (const k of ['effort', 'duration']) {
    if (!has(body, k)) continue;
    const r = num(body[k], { int: true });
    if (r.error) return bad(`${k}: ${r.error}`);
    if (k === 'effort' && r.value != null && (r.value < 1 || r.value > 5)) return bad('effort is 1–5');
    s[k] = r.value;
  }
  await s.save();
  return getSession(db, s.id);
}

async function deleteSession(db, id) {
  const s = await db.WorkoutSession.findByPk(id);
  if (!s) return notFound('session');
  const sets = await db.WorkoutSet.destroy({ where: { sessionId: s.id } });
  await s.destroy();
  return { ok: true, deleted: { session: Number(id), sets } };
}

const SET_FIELDS = {
  reps:     { int: true },
  weight:   {},
  duration: { int: true },   // seconds
  rpe:      { int: true },
};

/** Apply the numeric/text fields of `body` onto a set-shaped object. */
function applySetFields(target, body) {
  for (const [k, opt] of Object.entries(SET_FIELDS)) {
    if (!has(body, k)) continue;
    const r = num(body[k], opt);
    if (r.error) return `${k}: ${r.error}`;
    target[k] = r.value;
  }
  if (has(body, 'weightUnit')) {
    if (!['lbs', 'kg'].includes(body.weightUnit)) return 'weightUnit must be lbs or kg';
    target.weightUnit = body.weightUnit;
  }
  if (has(body, 'notes')) target.notes = String(body.notes || '').trim() || null;
  // Coaching: mark a set failed and where it gave out. Un-failing clears the point.
  if (has(body, 'failed') || has(body, 'failPoint')) {
    const failed = has(body, 'failed') ? !!body.failed : !!target.failed;
    const point = has(body, 'failPoint') ? body.failPoint : target.failPoint;
    if (failed && point != null && point !== '' && !['bottom', 'middle', 'top', 'grip'].includes(point)) return 'failPoint must be bottom, middle, top or grip';
    target.failed = failed;
    target.failPoint = failed && point ? point : null;
  }
  if (has(body, 'exerciseName')) {
    const name = String(body.exerciseName || '').trim();
    if (!name) return 'exerciseName cannot be empty';
    target.exerciseName = name;
  }
  return null;
}

async function prFor(db, set, sessionId) {
  // Same detection the log paths run, so a corrected weight can still be a PR.
  // Never fatal: the edit is written whether or not this works.
  try {
    const sess = await db.WorkoutSession.findByPk(sessionId);
    return await detectPR(db, set, sess ? sess.date : undefined);
  } catch { return null; }
}

/** Reps, weight, duration, notes, or the exercise name of ONE set. */
async function editSet(db, id, body = {}) {
  const st = await db.WorkoutSet.findByPk(id);
  if (!st) return notFound('set');
  const err = applySetFields(st, body);
  if (err) return bad(err);
  await st.save();
  const pr = await prFor(db, st.toJSON(), st.sessionId);
  return { ok: true, set: st.toJSON(), pr: pr ? true : undefined };
}

async function deleteSet(db, id) {
  const st = await db.WorkoutSet.findByPk(id);
  if (!st) return notFound('set');
  const { sessionId, exerciseOrder } = st;
  await st.destroy();
  // Renumber what is left of that exercise, so the Logs page does not show
  // "Set 1, Set 3".
  const rest = await db.WorkoutSet.findAll({
    where: { sessionId, exerciseOrder }, order: [['setNumber', 'ASC'], ['id', 'ASC']],
  });
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].setNumber !== i + 1) { rest[i].setNumber = i + 1; await rest[i].save(); }
  }
  return { ok: true, deleted: { set: Number(id) }, sessionId };
}

/**
 * Add a set to a session. Same exercise name as one already in it (case-
 * insensitive) → the next set of that exercise; otherwise a new exercise at
 * the end. exerciseOrder must continue from the max — restarting it merges two
 * exercises into one row on the Logs page (HANDOFF item 53).
 */
async function addSet(db, sessionId, body = {}) {
  const s = await db.WorkoutSession.findByPk(sessionId);
  if (!s) return notFound('session');
  const fields = { weightUnit: 'lbs' };
  const err = applySetFields(fields, body);
  if (err) return bad(err);
  if (!fields.exerciseName) return bad('exerciseName is required');

  const sets = await db.WorkoutSet.findAll({ where: { sessionId: s.id } });
  const same = sets.filter(x => x.exerciseName.toLowerCase() === fields.exerciseName.toLowerCase());
  let exerciseOrder, setNumber;
  if (same.length) {
    exerciseOrder = same[0].exerciseOrder;
    fields.exerciseName = same[0].exerciseName;   // keep the spelling already there
    setNumber = Math.max(...same.map(x => x.setNumber || 0)) + 1;
  } else {
    exerciseOrder = sets.length ? Math.max(...sets.map(x => x.exerciseOrder || 0)) + 1 : 0;
    setNumber = 1;
  }
  const st = await db.WorkoutSet.create({ ...fields, sessionId: s.id, exerciseOrder, setNumber });
  const pr = await prFor(db, st.toJSON(), s.id);
  return { ok: true, set: st.toJSON(), pr: pr ? true : undefined };
}

/** Rename every set of one exercise within a session — "that was Hanging Leg Raise". */
async function renameExercise(db, sessionId, from, to) {
  const name = String(to || '').trim();
  if (!name) return bad('new name cannot be empty');
  const s = await db.WorkoutSession.findByPk(sessionId);
  if (!s) return notFound('session');
  const sets = await db.WorkoutSet.findAll({ where: { sessionId: s.id } });
  const hit = sets.filter(x => x.exerciseName.toLowerCase() === String(from || '').trim().toLowerCase());
  if (!hit.length) return notFound(`exercise "${from}" in that session`);
  for (const x of hit) { x.exerciseName = name; await x.save(); }
  // A rename IS the answer to "which did you mean?", so remember it.
  //
  // From 2026-10-14 an ambiguous name no longer refuses the workout: it is
  // logged under the name as typed and asked about afterwards, and this is
  // where the answer lands. Without recording the alias the rename would fix
  // one session and the same question would come back the next time he wrote
  // the name the same way — which is the loop the question was built to avoid.
  // Best-effort: a failure here must never cost a rename that already worked.
  const alias = canonicalKey(String(from || ''));
  if (alias && db.ExerciseAlias) {
    try {
      const [row, created] = await db.ExerciseAlias.findOrCreate({ where: { key: alias }, defaults: { name } });
      if (!created && row.name !== name) { row.name = name; await row.save(); }
    } catch { /* the rename stands regardless */ }
  }
  return { ok: true, renamed: hit.length, from: String(from).trim(), to: name, remembered: Boolean(alias) };
}

module.exports = {
  getSession, editSession, deleteSession,
  editSet, deleteSet, addSet, renameExercise,
  TYPES,
};
