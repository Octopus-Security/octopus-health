'use strict';

/**
 * 2026-11-12: Needs-tidying filter, selective merge, Delete, and the chat-reply guard.
 * Run: node --test test/exercise-tidy-delete.test.js
 */

require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const N = require('../api/exercise-names');

let express, ejs, getDatabase;
try { express = require('express'); ejs = require('ejs'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/ejs/sequelize/sqlite3 not installed on this machine';

const JUNK = 'yes but it was with dumbbells';

test('conversationalReason: the exact junk string and other replies are refused', () => {
  assert.ok(N.conversationalReason(JUNK));
  for (const s of ['No I mean pull ups', 'ok', 'Sure thing', 'it was the neutral grip', 'I did pull ups', 'that was a row', 'but with dumbbells',
    'did you mean row?', 'one two three four five six seven eight nine']) assert.ok(N.conversationalReason(s), s);
});
test('positive control: real exercise names are not conversational', () => {
  for (const s of ['Single Arm Row', 'Bulgarian Split Squat', 'Pull-up', 'Dumbbell Bicep Curl', 'Iso Leg Press', 'Nordic Hamstring Curl']) assert.strictEqual(N.conversationalReason(s), null, s);
});

test('no native dialogs in the exercises page script', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'exercises-list.js'), 'utf8');
  assert.ok(!/(?<![\w.$])(alert|confirm|prompt)\s*\(/.test(src));
  assert.match(src, /oDialog\.confirm/);
  assert.match(src, /Delete ' \+ plural/);
});

const stamp = `zz_tidy_${process.pid}`;
const A = `${stamp}_a`, B = `${stamp}_b`;
let server, base;
before(async () => {
  if (skip) return;
  process.env.HEALTH_SERVICE_TOKEN = 'test-token';
  const { asset } = require('../build');
  const app = express();
  app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.asset = asset;
  app.use(express.json());
  app.use('/api/service', require('../api/routes/service'));
  const requireLogin = async (req, res, next) => {
    const u = req.get('x-test-user');
    if (!u) return res.status(302).set('Location', '/login').end();
    req.user = { username: u }; res.locals.user = req.user; res.locals.activeTab = 'logs';
    next();
  };
  require('../api/web-exercises')(app, { requireLogin, getDatabase });
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (server) server.close();
  for (const n of [A, B]) try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${n}_health.sqlite`)); } catch { /* none */ }
});
const web = (user, method, p, body, headers = {}) => fetch(base + p, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...(user ? { 'X-Test-User': user } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
const json = async r => ({ status: r.status, body: await r.json().catch(() => null) });
const svc = (user, method, p, body) => fetch(base + '/api/service' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Service-Token': 'test-token', 'X-Service-User': user }, body: body ? JSON.stringify(body) : undefined }).then(json);

async function seed(user, name, dates, { perSession = 1, reps = 10, extra = null } = {}) {
  const db = getDatabase(user); await db.sequelize.sync();
  const made = [];
  for (const date of dates) {
    const s = await db.WorkoutSession.create({ type: 'strength', date, status: 'finished' });
    for (let i = 1; i <= perSession; i++) await db.WorkoutSet.create({ sessionId: s.id, exerciseName: name, exerciseOrder: 0, setNumber: i, reps, weight: 20, weightUnit: 'lbs' });
    if (extra) await db.WorkoutSet.create({ sessionId: s.id, exerciseName: extra, exerciseOrder: 1, setNumber: 1, reps: 5 });
    made.push(s);
  }
  return made;
}
const count = (user, name) => getDatabase(user).WorkoutSet.count({ where: { exerciseName: name } });

before(async () => {
  if (skip) return;
  await seed(A, 'Dumbbell Bicep Curl', ['2026-10-01'], { perSession: 3 });
  await seed(A, 'Bicep Curls', ['2026-10-02', '2026-10-09'], { perSession: 4 });
  await seed(A, 'Resistance Band Bicep Curl', ['2026-10-03'], { perSession: 2 });
  await seed(A, 'Iso Bicep Curl', ['2026-10-04']);
  await seed(A, 'Row', ['2026-10-05'], { perSession: 2 });
  await seed(A, JUNK, ['2026-10-29'], { perSession: 1, extra: 'Row' });   // junk set in a session that also holds a Row
  await seed(A, 'Lonely Junk', ['2026-10-30'], { perSession: 1 });          // its session holds nothing else
  const db = getDatabase(A);
  await db.ExerciseAlias.create({ key: N.canonicalKey('lonely'), name: 'Lonely Junk' });
  await seed(B, JUNK, ['2026-10-29']);
});

test('page: Needs tidying toggle with count, rows flagged, works beside the text filter', { skip }, async () => {
  const html = await (await web(A, 'GET', '/logs/exercises')).text();
  assert.match(html, /id="seg-tidy"[^>]*>Needs tidying \((\d+)\)/);
  const n = Number(/Needs tidying \((\d+)\)/.exec(html)[1]);
  assert.strictEqual((html.match(/class="ex-row"[^>]*data-tidy="1"/g) || []).length, n);
  assert.ok(n >= 3, 'the three bicep curl names at least');
  assert.match(html, /id="ex-filter"/);
  assert.match(html, /All \(\d+\)/);
  assert.match(html, /Delete…/);
  assert.match(html, /Rename and Merge delete nothing/);
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'exercises-list.js'), 'utf8');
  assert.match(js, /try \{ localStorage\.setItem/);
  assert.match(js, /tidyOnly && !li\.hasAttribute\('data-tidy'\)/);
});

test('selective merge: preview writes nothing; partial merge leaves the unchecked name alone', { skip }, async () => {
  const body = { from: ['Dumbbell Bicep Curl'], to: 'Bicep Curls' };
  const p = await web(A, 'POST', '/logs/api/exercises/merge-selected', body).then(json);
  assert.strictEqual(p.body.preview, true);
  assert.strictEqual(p.body.sets, 3);
  assert.deepStrictEqual(p.body.names, [{ name: 'Dumbbell Bicep Curl', sets: 3 }]);
  assert.strictEqual(await count(A, 'Dumbbell Bicep Curl'), 3, 'preview wrote nothing');
  const r = await web(A, 'POST', '/logs/api/exercises/merge-selected', { ...body, confirm: true }).then(json);
  assert.strictEqual(r.body.moved, 3);
  assert.strictEqual(await count(A, 'Bicep Curls'), 11);
  assert.strictEqual(await count(A, 'Dumbbell Bicep Curl'), 0);
  assert.strictEqual(await count(A, 'Resistance Band Bicep Curl'), 2, 'the unchecked name is untouched');
  const again = await web(A, 'POST', '/logs/api/exercises/merge-selected', { ...body, confirm: true }).then(json);
  assert.strictEqual(again.body.moved, 0);
});

test('selective merge refuses iso into plain, strangers, and a keeper in the from list; nothing moves', { skip }, async () => {
  for (const b of [{ from: ['Iso Bicep Curl'], to: 'Bicep Curls' }, { from: ['Row'], to: 'Bicep Curls' },
    { from: ['Bicep Curls'], to: 'Bicep Curls' }, { from: [], to: 'Bicep Curls' }, { from: ['Resistance Band Bicep Curl', 'Iso Bicep Curl'], to: 'Bicep Curls' }]) {
    const r = await web(A, 'POST', '/logs/api/exercises/merge-selected', { ...b, confirm: true }).then(json);
    assert.ok(r.status >= 400, JSON.stringify(b));
  }
  assert.strictEqual(await count(A, 'Resistance Band Bicep Curl'), 2, 'a refused request moves nothing, even its valid names');
  assert.strictEqual(await count(A, 'Iso Bicep Curl'), 1);
  const x = await web(A, 'POST', '/logs/api/exercises/merge-selected', { from: ['Resistance Band Bicep Curl'], to: 'Bicep Curls' }, { Origin: 'https://evil.example' }).then(json);
  assert.strictEqual(x.status, 403);
});

test('delete: preview writes nothing', { skip }, async () => {
  const p = await web(A, 'POST', '/logs/api/exercises/delete', { name: JUNK }).then(json);
  assert.strictEqual(p.status, 200);
  assert.strictEqual(p.body.preview, true);
  assert.strictEqual(p.body.sets, 1);
  assert.strictEqual(p.body.sessions, 1);
  assert.deepStrictEqual(p.body.dates, ['2026-10-29']);
  assert.strictEqual(p.body.emptiedSessions, 0, 'that session still holds a Row');
  assert.strictEqual(await count(A, JUNK), 1);
});

test('delete: confirm removes the sets, keeps a session that still has other sets, and a repeat is a no-op', { skip }, async () => {
  const r = await web(A, 'POST', '/logs/api/exercises/delete', { name: JUNK, confirm: true }).then(json);
  assert.strictEqual(r.body.deleted, 1);
  assert.strictEqual(await count(A, JUNK), 0);
  const db = getDatabase(A);
  const sess = await db.WorkoutSession.findOne({ where: { date: '2026-10-29' } });
  assert.ok(sess, 'session with a Row stays');
  const rest = await db.WorkoutSet.findAll({ where: { sessionId: sess.id } });
  assert.deepStrictEqual(rest.map(s => [s.exerciseName, s.setNumber]), [['Row', 1]]);
  const again = await web(A, 'POST', '/logs/api/exercises/delete', { name: JUNK, confirm: true }).then(json);
  assert.strictEqual(again.body.deleted, 0);
  assert.strictEqual(again.body.alreadyDone, true);
});

test('delete: an emptied session and the alias go too', { skip }, async () => {
  const db = getDatabase(A);
  assert.strictEqual(await db.WorkoutSession.count({ where: { date: '2026-10-30' } }), 1);
  const p = await web(A, 'POST', '/logs/api/exercises/delete', { name: 'Lonely Junk' }).then(json);
  assert.strictEqual(p.body.emptiedSessions, 1);
  assert.strictEqual(p.body.aliases, 1);
  const r = await web(A, 'POST', '/logs/api/exercises/delete', { name: 'Lonely Junk', confirm: true }).then(json);
  assert.strictEqual(r.body.deleted, 1);
  assert.strictEqual(await db.WorkoutSession.count({ where: { date: '2026-10-30' } }), 0);
  assert.strictEqual(await db.ExerciseAlias.count({ where: { name: 'Lonely Junk' } }), 0);
});

test('delete: isolation, origin guard, and the typed name over 20 sets', { skip }, async () => {
  // Account A's delete never touched B's file; B's own junk is still there.
  assert.strictEqual(await count(B, JUNK), 1);
  const other = await web(B, 'POST', '/logs/api/exercises/delete', { name: 'Row', confirm: true }).then(json);
  assert.strictEqual(other.body.deleted, 0, 'B has no Row: nothing deleted, A untouched');
  assert.strictEqual(await count(A, 'Row'), 3);
  const x = await web(B, 'POST', '/logs/api/exercises/delete', { name: JUNK, confirm: true }, { Origin: 'https://evil.example' }).then(json);
  assert.strictEqual(x.status, 403);
  assert.strictEqual(await count(B, JUNK), 1);
  assert.strictEqual((await web(null, 'POST', '/logs/api/exercises/delete', { name: JUNK })).status, 302);
  await seed(B, 'Big Mistake', ['2026-10-01'], { perSession: 21 });
  const p = await web(B, 'POST', '/logs/api/exercises/delete', { name: 'Big Mistake' }).then(json);
  assert.strictEqual(p.body.requiresTyped, true);
  const no = await web(B, 'POST', '/logs/api/exercises/delete', { name: 'Big Mistake', confirm: true, typed: 'nope' }).then(json);
  assert.strictEqual(no.status, 400);
  assert.strictEqual(await count(B, 'Big Mistake'), 21);
  const yes = await web(B, 'POST', '/logs/api/exercises/delete', { name: 'Big Mistake', confirm: true, typed: 'Big Mistake' }).then(json);
  assert.strictEqual(yes.body.deleted, 21);
});

test('guard: the exact chat reply is not logged as a NEW exercise; real names still are', { skip }, async () => {
  const U = `${stamp}_g`;
  try {
    const r = await svc(U, 'POST', '/sessions', { type: 'strength', date: '2026-11-12', force: true, sets: [{ exerciseName: JUNK, sets: [{ reps: 8 }] }] });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.sessionId, null, 'nothing logged');
    assert.strictEqual(r.body.needsName[0].exerciseName, JUNK);
    assert.match(r.body.message, /NOT logged|NOTHING WAS SAVED/);
    assert.strictEqual(await count(U, JUNK), 0);
    // from-text path: a line in the middle of a real workout is held, the rest is logged
    const m = await svc(U, 'POST', '/sessions', { type: 'strength', date: '2026-11-12', force: true, sets: [
      { exerciseName: 'Single Arm Row', sets: [{ reps: 10, weight: 50 }] },
      { exerciseName: JUNK, sets: [{ reps: 8 }] },
      { exerciseName: 'Bulgarian Split Squat', sets: [{ reps: 8, weight: 30 }] }] });
    assert.ok(m.body.sessionId);
    assert.deepStrictEqual(m.body.logged.map(l => l.exerciseName).sort(), ['Bulgarian Split Squat', 'Single Arm Row']);
    assert.strictEqual(m.body.needsName[0].exerciseName, JUNK);
    assert.strictEqual(await count(U, JUNK), 0);
    assert.strictEqual(await count(U, 'Single Arm Row'), 1);
    // a question and "No ..." are held; an already-logged name is never refused
    const q = await svc(U, 'POST', '/sessions', { type: 'strength', date: '2026-11-12', force: true, sets: [{ exerciseName: 'was it the dumbbell one?', sets: [{ reps: 8 }] }] });
    assert.strictEqual(q.body.sessionId, null);
    const db = getDatabase(U);
    const s = await db.WorkoutSession.findOne({ where: { date: '2026-11-12' } });
    await db.WorkoutSet.create({ sessionId: s.id, exerciseName: 'Yes Man Press', exerciseOrder: 9, setNumber: 1, reps: 3 });   // already in the log
    const k = await svc(U, 'POST', '/sessions', { type: 'strength', date: '2026-11-12', force: true, sets: [{ exerciseName: 'Yes Man Press', sets: [{ reps: 3 }] }] });
    assert.ok(k.body.sessionId, 'a name the account already uses is never refused');
  } finally { try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${U}_health.sqlite`)); } catch { /* none */ } }
});

test('guard: renaming a set to a chat reply is refused (the 2026-10-29 path); a real new name is fine', { skip }, async () => {
  const [s] = await seed(A, 'Pull Ups Test', ['2026-11-12']);
  const r = await svc(A, 'POST', `/sessions/${s.id}/rename`, { from: 'Pull Ups Test', to: JUNK, confirm: true });
  assert.ok(r.status >= 400);
  assert.match(JSON.stringify(r.body), /not an exercise name/);
  assert.strictEqual(await count(A, JUNK), 0);
  const ok = await svc(A, 'POST', `/sessions/${s.id}/rename`, { from: 'Pull Ups Test', to: 'Bulgarian Split Squat', confirm: true });
  assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
});
