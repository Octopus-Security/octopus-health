'use strict';

/**
 * Correcting a logged workout: api/log-edit.js through the service API (what
 * cortex calls) and the Logs page's known-name suggestions.
 *
 * Until 2026-10-11 the only correction was deleting the whole session. Each
 * test below asserts the database, not the response — the response is the
 * claim, the row is the fact.
 *
 * Run: node --test test/log-edit.test.js
 */

require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let express, getDatabase;
try { express = require('express'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/sequelize/sqlite3 not installed on this machine';

const stamp = `zz_edit_${process.pid}`;
const used = new Set();
function userFor(tag) {
  const name = `${stamp}_${tag}`;
  used.add(name);
  return name;
}

let server, base;
before(async () => {
  if (skip) return;
  process.env.HEALTH_SERVICE_TOKEN = 'test-token';
  const app = express();
  app.use(express.json());
  app.use('/api/service', require('../api/routes/service'));
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (server) server.close();
  for (const n of used) { try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${n}_health.sqlite`)); } catch { /* not created */ } }
});

const svc = (user, method, p, body) => fetch(base + '/api/service' + p, {
  method,
  headers: { 'Content-Type': 'application/json', 'X-Service-Token': 'test-token', 'X-Service-User': user },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));


const log = (user, sets, extra = {}) => svc(user, 'POST', '/sessions', { type: 'strength', sets, ...extra });

async function seed(tag) {
  const user = userFor(tag);
  const r = await log(user, [
    { exerciseName: 'Bench Press', sets: [{ reps: 10, weight: 50 }, { reps: 10, weight: 70 }, { reps: 10, weight: 90 }] },
    { exerciseName: 'Pull-up', sets: [{ reps: 10 }] },
  ]);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const db = getDatabase(user); await db.sequelize.sync();
  return { user, sessionId: r.body.sessionId, db };
}

test('GET /sessions carries set ids, so a caller can name one set', { skip }, async () => {
  const { user } = await seed('ids');
  const r = await svc(user, 'GET', '/sessions');
  const sets = r.body.sessions[0].exercises.flatMap(e => e.sets);
  assert.ok(sets.length === 4 && sets.every(s => Number.isInteger(s.id)));
});

test('a set\'s weight is corrected in place', { skip }, async () => {
  const { user, sessionId, db } = await seed('editset');
  const first = await db.WorkoutSet.findOne({ where: { sessionId, exerciseName: 'Bench Press', setNumber: 1 } });
  const r = await svc(user, 'PATCH', `/sets/${first.id}`, { weight: 95 });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  await first.reload();
  assert.strictEqual(first.weight, 95);
  assert.strictEqual(first.reps, 10, 'a field not sent is left alone');
});

test('a bad number is refused and nothing changes', { skip }, async () => {
  const { user, sessionId, db } = await seed('badnum');
  const st = await db.WorkoutSet.findOne({ where: { sessionId, exerciseName: 'Pull-up' } });
  const r = await svc(user, 'PATCH', `/sets/${st.id}`, { reps: 'ten' });
  assert.strictEqual(r.status, 400);
  await st.reload();
  assert.strictEqual(st.reps, 10);
});

test('deleting a set renumbers the rest of that exercise', { skip }, async () => {
  const { user, sessionId, db } = await seed('delset');
  const mid = await db.WorkoutSet.findOne({ where: { sessionId, exerciseName: 'Bench Press', setNumber: 2 } });
  assert.strictEqual((await svc(user, 'DELETE', `/sets/${mid.id}`)).status, 200);
  const rest = await db.WorkoutSet.findAll({ where: { sessionId, exerciseName: 'Bench Press' }, order: [['setNumber', 'ASC']] });
  assert.deepStrictEqual(rest.map(s => [s.setNumber, s.weight]), [[1, 50], [2, 90]]);
});

test('adding a set: same exercise joins it, a new one goes on the end', { skip }, async () => {
  const { user, sessionId, db } = await seed('addset');
  await svc(user, 'POST', `/sessions/${sessionId}/sets`, { exerciseName: 'bench press', reps: 8, weight: 100 });
  await svc(user, 'POST', `/sessions/${sessionId}/sets`, { exerciseName: 'Bicep Curl', reps: 10, weight: 30 });
  const bench = await db.WorkoutSet.findAll({ where: { sessionId, exerciseName: 'Bench Press' } });
  assert.strictEqual(bench.length, 4, 'case-insensitive match kept the existing spelling');
  assert.strictEqual(Math.max(...bench.map(b => b.setNumber)), 4);
  const orders = new Set((await db.WorkoutSet.findAll({ where: { sessionId } })).map(s => s.exerciseOrder));
  assert.strictEqual(orders.size, 3, 'the new exercise got its own exerciseOrder');
});

test('a session is redated and retitled; a bad date is refused', { skip }, async () => {
  const { user, sessionId, db } = await seed('editsess');
  const r = await svc(user, 'PATCH', `/sessions/${sessionId}`, { date: '2026-10-10', title: 'Chest & Arms' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const s = await db.WorkoutSession.findByPk(sessionId);
  assert.strictEqual(s.date, '2026-10-10');
  assert.strictEqual(s.title, 'Chest & Arms');
  assert.strictEqual((await svc(user, 'PATCH', `/sessions/${sessionId}`, { date: 'yesterday' })).status, 400);
});

test('renaming an exercise renames every set of it in that session', { skip }, async () => {
  const { user, sessionId, db } = await seed('rename');
  const r = await svc(user, 'POST', `/sessions/${sessionId}/rename`, { from: 'pull-up', to: 'Chin-up' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(await db.WorkoutSet.count({ where: { sessionId, exerciseName: 'Chin-up' } }), 1);
  assert.strictEqual(await db.WorkoutSet.count({ where: { sessionId, exerciseName: 'Pull-up' } }), 0);
});

test('another account\'s set id is a 404 and is not touched', { skip }, async () => {
  const a = await seed('own_a');
  const b = userFor('own_b');
  const st = await a.db.WorkoutSet.findOne({ where: { sessionId: a.sessionId } });
  // b has no sets, so the SAME id only exists in a's file — and must not reach it.
  const r = await svc(b, 'PATCH', `/sets/${st.id}`, { weight: 1 });
  assert.strictEqual(r.status, 404);
  await st.reload();
  assert.notStrictEqual(st.weight, 1);
});

test('deleting a session removes its sets too', { skip }, async () => {
  const { user, sessionId, db } = await seed('delsess');
  assert.strictEqual((await svc(user, 'DELETE', `/sessions/${sessionId}`)).status, 200);
  assert.strictEqual(await db.WorkoutSession.count({ where: { id: sessionId } }), 0);
  assert.strictEqual(await db.WorkoutSet.count({ where: { sessionId } }), 0);
});

test('known names: most-used first, filtered by what is typed', { skip }, async () => {
  const { db } = await seed('known');
  const { knownNames } = require('../api/web-log-edit');
  const all = await knownNames(db);
  assert.deepStrictEqual(all.map(n => n.name), ['Bench Press', 'Pull-up']);
  assert.deepStrictEqual((await knownNames(db, 'pull')).map(n => n.name), ['Pull-up']);
});

// ── POST /sessions/from-text — the model passes the message, code reads it ────

const REAL = 'chest fly Machine:\n100lb x 10\n\nBench press 45lb bar:\n50+bar x 10\n70+bar x 10\n90+bar x 10\n\n'
           + '10 pull ups\n\n10 leg raises\n\n10 bicep curls ea side 30 lbs\n\nIs the full session right now for today so far\n\n719981';

test('from-text: the 2026-10-11 message logs as written, chatter and 2FA code ignored', { skip }, async () => {
  const user = userFor('text_real');
  const r = await svc(user, 'POST', '/sessions/from-text', { text: REAL });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.sessionId, JSON.stringify(r.body));
  assert.deepStrictEqual(r.body.ignored, ['Is the full session right now for today so far', '719981']);

  const db = getDatabase(user); await db.sequelize.sync();
  const rows = await db.WorkoutSet.findAll({ where: { sessionId: r.body.sessionId }, order: [['exerciseOrder', 'ASC'], ['setNumber', 'ASC']] });
  assert.deepStrictEqual(rows.map(x => [x.exerciseName, x.reps, x.weight]), [
    ['Chest Fly Machine', 10, 100],
    ['Bench Press', 10, 95], ['Bench Press', 10, 115], ['Bench Press', 10, 135],
    ['Pull Ups', 10, null],
    ['Leg Raises', 10, null],
    ['Bicep Curls', 10, 30],
  ]);
  assert.match(rows[1].notes, /50 \+ 45lb bar/, 'the plates-plus-bar reading is kept');
  assert.strictEqual(rows[6].notes, 'each side');
});

test('from-text: an ambiguous name is asked ONCE — the answer is remembered', { skip }, async () => {
  const user = userFor('text_alias');
  await log(user, [{ exerciseName: 'Barbell Bench Press', sets: [{ reps: 5, weight: 185 }] }], { date: '2026-10-01' });

  const text = 'Bench press 45lb bar:\n50+bar x 10';
  // 2026-10-14: this used to refuse the write. It is now SAVED under the name
  // as typed, and the question comes back as advice — under `namingAsk`, not
  // `needsNaming`, which still means "nothing was saved" to every caller.
  const first = await svc(user, 'POST', '/sessions/from-text', { text });
  assert.ok(first.body.sessionId, 'the workout is saved on the FIRST call');
  assert.ok(!first.body.needsNaming, 'not under the key that means nothing was saved');
  assert.ok(first.body.namingAsk && first.body.namingAsk.length, JSON.stringify(first.body));
  assert.strictEqual(first.body.logged[0].exerciseName, 'Bench Press', 'as typed');

  // The answer is a RENAME, which is also what records the alias.
  const { renameExercise } = require('../api/log-edit');
  const db = getDatabase(user); await db.sequelize.sync();
  const r = await renameExercise(db, first.body.sessionId, 'Bench Press', 'Barbell Bench Press');
  assert.strictEqual(r.renamed, 1, JSON.stringify(r));

  // A later day, no names passed: the answer applies, and nothing is asked.
  await db.WorkoutSession.update({ date: '2026-10-02' }, { where: { id: first.body.sessionId } });
  const third = await svc(user, 'POST', '/sessions/from-text', { text: 'bench press 3x5 155lbs' });
  assert.ok(third.body.sessionId, JSON.stringify(third.body));
  assert.strictEqual(third.body.logged[0].exerciseName, 'Barbell Bench Press');
  assert.ok(!third.body.namingAsk, 'asked once, ever');
});

test('from-text: "it is a new exercise" is remembered too', { skip }, async () => {
  const user = userFor('text_new');
  await log(user, [{ exerciseName: 'Hanging Leg Raise', sets: [{ reps: 10 }] }], { date: '2026-10-01' });
  const asked = await svc(user, 'POST', '/sessions/from-text', { text: '10 leg raises' });
  assert.ok(asked.body.sessionId, 'saved, not refused');
  assert.ok(asked.body.namingAsk && asked.body.namingAsk.length, JSON.stringify(asked.body));
  assert.strictEqual(asked.body.logged[0].exerciseName, 'Leg Raises');

  // "it is a new exercise, leave it" is still an answer, and `names` is still
  // the channel — mapping the name to itself. Without that being remembered the
  // question returns every time he writes it the same way.
  //
  // Note what re-sending the SAME text now does: the first call saved it, so
  // the duplicate hold catches the second and NOTHING is written again. That is
  // correct, and it is why answering a question about an already-saved session
  // is a RENAME (api/log-edit.js renameExercise, which records the alias
  // itself) rather than a re-send. `names` here still does its other job —
  // the alias is recorded before the parse, so it applies from now on.
  const held = await svc(user, 'POST', '/sessions/from-text', { text: '10 leg raises', names: { 'Leg Raises': 'Leg Raises' } });
  assert.strictEqual(held.body.sessionId, null, 'held as a duplicate, not written twice');
  assert.ok(held.body.needsConfirm.length, JSON.stringify(held.body));

  // ...and the answer sticks: a different set of the same exercise asks nothing.
  const later = await svc(user, 'POST', '/sessions/from-text', { text: '25 leg raises' });
  assert.ok(later.body.sessionId, JSON.stringify(later.body));
  assert.ok(!later.body.namingAsk, 'settled, so no longer asked');
  assert.strictEqual(later.body.logged[0].exerciseName, 'Leg Raises');
});

test('from-text: a line with numbers it cannot read saves NOTHING and names the line', { skip }, async () => {
  const user = userFor('text_unread');
  const r = await svc(user, 'POST', '/sessions/from-text', { text: '20 pull ups\n3 sets of something 4/5' });
  assert.strictEqual(r.body.sessionId, null);
  assert.ok(r.body.needsReading.length, JSON.stringify(r.body));
  const db = getDatabase(user); await db.sequelize.sync();
  assert.strictEqual(await db.WorkoutSet.count(), 0);
});

test('from-text dryRun parses and writes nothing — not even an alias', { skip }, async () => {
  const user = userFor('text_dry');
  const r = await svc(user, 'POST', '/sessions/from-text', { text: REAL, dryRun: true, names: { 'Bench Press': 'Barbell Bench Press' } });
  assert.strictEqual(r.body.exercises, 5);
  const db = getDatabase(user); await db.sequelize.sync();
  assert.strictEqual(await db.WorkoutSet.count(), 0);
  assert.strictEqual(await db.ExerciseAlias.count(), 0);
});
