'use strict';

/**
 * The Exercises section of the Logs area: stats rules (pure), then the real routes on
 * throwaway accounts - list, rename/merge with preview and confirm, alias learning,
 * the detail page, and isolation between two accounts.
 *
 * Run: node --test test/exercises-section.test.js
 */

require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../api/exercise-stats');

let express, ejs, getDatabase;
try { express = require('express'); ejs = require('ejs'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/ejs/sequelize/sqlite3 not installed on this machine';

// ── pure: estimated 1RM, PRs, plateau ────────────────────────────────────────
const row = (date, weight, reps, extra = {}) => ({ date, sessionId: date, weight, reps, weightUnit: 'lbs', ...extra });

test('estimated 1RM is Epley, 1-12 reps only', () => {
  assert.strictEqual(S.e1rm(100, 1), 100);
  assert.strictEqual(Math.round(S.e1rm(100, 10) * 10) / 10, 133.3);
  assert.strictEqual(S.e1rm(100, 13), null);
  assert.strictEqual(S.e1rm(0, 5), null);
  assert.match(S.E1RM_FORMULA, /Epley/);
});

test('PRs: heaviest, best e1RM, best volume set, rep PRs; failed sets and kg handled', () => {
  const a = S.analyse([
    row('2026-10-01', 100, 10), row('2026-10-01', 135, 5), row('2026-10-08', 155, 1),
    row('2026-10-08', 200, 3, { failed: true }),
    row('2026-10-15', 40, 8, { weightUnit: 'kg' }),     // 88.2 lbs
  ]);
  assert.strictEqual(a.mode, 'weighted');
  assert.strictEqual(a.prs.heaviest.weight, 155);
  assert.strictEqual(a.prs.bestE1rm.value, 157.5);     // 135 x5 = 157.5 beats 155 x1
  assert.strictEqual(a.prs.bestVolumeSet.volume, 1000);
  const rp = Object.fromEntries(a.prs.repPRs.map(r => [r.reps, r.weight]));
  assert.strictEqual(rp[1], 155); assert.strictEqual(rp[5], 135); assert.strictEqual(rp[10], 100);
  assert.ok(a.series.every(p => p.topWeight <= 155), 'the failed 200 is not a lift');
  assert.ok(Math.abs(a.series[2].topWeight - 88.2) < 0.1, 'kg converted to lbs');
});

test('bodyweight and timed exercises get their own mode', () => {
  assert.strictEqual(S.analyse([{ date: '2026-10-01', reps: 8 }, { date: '2026-10-05', reps: 10 }]).prs.mostReps.reps, 10);
  assert.strictEqual(S.analyse([{ date: '2026-10-01', duration: 30 }]).prs.longest.seconds, 30);
  assert.strictEqual(S.analyse([]).mode, 'none');
});

const series = (...pairs) => pairs.map(([date, w]) => row(date, w, 1));

test('plateau rule: needs 5 sessions, 14 days, and <1% gain over the earlier best', () => {
  assert.deepStrictEqual([S.PLATEAU_SESSIONS, S.PLATEAU_MIN_DAYS, S.PLATEAU_MIN_GAIN], [4, 14, 0.01]);
  // 4 sessions only: not enough data
  assert.strictEqual(S.analyse(series(['2026-09-01', 100], ['2026-09-08', 100], ['2026-09-15', 100], ['2026-09-22', 100])).plateau.status, 'not-enough-data');
  // best set at session 1, flat for four more weeks: plateau + tips
  const flat = S.analyse(series(['2026-09-01', 150], ['2026-09-08', 145], ['2026-09-15', 150], ['2026-09-22', 150], ['2026-09-29', 148]));
  assert.strictEqual(flat.plateau.status, 'plateau');
  assert.ok(flat.tips.length >= 6 && flat.tips[0].id === 'recovery');
  // a new best inside the window: progressing, no tips
  const up = S.analyse(series(['2026-09-01', 150], ['2026-09-08', 150], ['2026-09-15', 150], ['2026-09-22', 155], ['2026-09-29', 160]));
  assert.strictEqual(up.plateau.status, 'progressing'); assert.deepStrictEqual(up.tips, []);
  // exactly under 1%: still a plateau; at 1%: progressing
  assert.strictEqual(S.analyse(series(['2026-09-01', 200], ['2026-09-08', 100], ['2026-09-15', 100], ['2026-09-22', 100], ['2026-09-29', 201.9])).plateau.status, 'plateau');
  assert.strictEqual(S.analyse(series(['2026-09-01', 200], ['2026-09-08', 100], ['2026-09-15', 100], ['2026-09-22', 100], ['2026-09-29', 202])).plateau.status, 'progressing');
  // four sessions in one week is not a stall
  assert.strictEqual(S.analyse(series(['2026-09-01', 150], ['2026-09-08', 140], ['2026-09-09', 140], ['2026-09-10', 140], ['2026-09-11', 140])).plateau.status, 'too-recent');
  // well below the earlier best: declining
  assert.strictEqual(S.analyse(series(['2026-09-01', 200], ['2026-09-08', 150], ['2026-09-15', 150], ['2026-09-22', 150], ['2026-09-29', 150])).plateau.status, 'declining');
});

test('tips are general and make no injury or medical claim', () => {
  const text = JSON.stringify(S.tipsFor({ status: 'plateau' }));
  assert.doesNotMatch(text, /\b(?:cure|diagnos\w*|heals?|treats?|injur\w*)\b/i);
  assert.match(S.analyse([]).disclaimer, /not medical advice/i);
  assert.deepStrictEqual(S.tipsFor({ status: 'progressing' }), []);
});

// ── routes ───────────────────────────────────────────────────────────────────
const stamp = `zz_exs_${process.pid}`;
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
const svc = (user, p, body) => fetch(base + '/api/service' + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Service-Token': 'test-token', 'X-Service-User': user }, body: JSON.stringify(body) }).then(json);

async function seed(user, name, dates, w0 = 100) {
  const db = getDatabase(user); await db.sequelize.sync();
  let n = 0;
  for (const date of dates) {
    const s = await db.WorkoutSession.create({ type: 'strength', date, status: 'finished' });
    await db.WorkoutSet.create({ sessionId: s.id, exerciseName: name, exerciseOrder: 0, setNumber: 1, reps: 5, weight: w0 + (n++ % 2), weightUnit: 'lbs' });
  }
  return db;
}

test('list: names with counts and last date; another account sees none of it; login required', { skip }, async () => {
  const dbA = await seed(A, 'Bench Press', ['2026-10-01', '2026-10-08']);
  await seed(A, 'bench press', ['2026-10-15']);
  await seed(B, 'Squat', ['2026-10-02']);
  assert.strictEqual((await web('', 'GET', '/logs/api/exercises')).status, 302);
  const a = (await json(await web(A, 'GET', '/logs/api/exercises'))).body.exercises;
  const bench = a.find(e => e.name === 'Bench Press');
  assert.deepStrictEqual([bench.sets, bench.sessions, bench.last], [2, 2, '2026-10-08']);
  assert.deepStrictEqual(bench.similar, ['bench press'], 'spellings of one name are pointed out');
  assert.ok(!a.some(e => e.name === 'Squat'));
  const b = (await json(await web(B, 'GET', '/logs/api/exercises'))).body.exercises;
  assert.deepStrictEqual(b.map(e => e.name), ['Squat']);
  const html = await (await web(A, 'GET', '/logs/exercises')).text();
  assert.match(html, /Bench Press/); assert.doesNotMatch(html, /Squat/);
  assert.ok(dbA);
});

test('merge: preview writes nothing, confirm moves and counts, repeat moves 0, alias learned, PR rows follow', { skip }, async () => {
  const dbA = getDatabase(A);
  await dbA.PersonalRecord.create({ exerciseName: 'bench press', weight: 130, weightUnit: 'lbs', date: '2026-10-15' });
  const move = body => web(A, 'POST', '/logs/api/exercises/move', body).then(json);

  const p = await move({ from: 'bench press', to: 'Bench Press' });
  assert.strictEqual(p.status, 200);
  assert.deepStrictEqual([p.body.preview, p.body.sets, p.body.merge, p.body.moved], [true, 1, true, 0]);
  assert.strictEqual(await dbA.WorkoutSet.count({ where: { exerciseName: 'bench press' } }), 1, 'preview wrote nothing');

  const r = await move({ from: 'bench press', to: 'Bench Press', confirm: true });
  assert.deepStrictEqual([r.body.moved, r.body.sessions], [1, 1]);
  assert.strictEqual(await dbA.WorkoutSet.count({ where: { exerciseName: 'Bench Press' } }), 3);
  assert.strictEqual(await dbA.WorkoutSet.count({ where: { exerciseName: 'bench press' } }), 0);
  assert.strictEqual(await dbA.PersonalRecord.count({ where: { exerciseName: 'Bench Press' } }), 1);

  const again = await move({ from: 'bench press', to: 'Bench Press', confirm: true });
  assert.deepStrictEqual([again.status, again.body.moved, again.body.alreadyDone], [200, 0, true]);
  assert.strictEqual(await dbA.WorkoutSet.count({ where: { exerciseName: 'Bench Press' } }), 3, 'repeat is a no-op');
});

test('rename: future logs of the old spelling land on the new name', { skip }, async () => {
  const dbA = await seed(A, 'Flys', ['2026-10-20']);
  const r = await web(A, 'POST', '/logs/api/exercises/move', { from: 'Flys', to: 'Cable Fly', confirm: true }).then(json);
  assert.deepStrictEqual([r.body.moved, r.body.merge], [1, false]);
  const log = await svc(A, '/sessions/from-text', { text: 'Flys 3x10 40lb', date: '2026-10-21' });
  assert.strictEqual(log.status, 200, JSON.stringify(log.body));
  assert.strictEqual(await dbA.WorkoutSet.count({ where: { exerciseName: 'Flys' } }), 0, 'no new "Flys" history');
  assert.strictEqual(await dbA.WorkoutSet.count({ where: { exerciseName: 'Cable Fly' } }), 4);
});

test('merging inside one session keeps one block with unbroken set numbers', { skip }, async () => {
  const db = getDatabase(A); await db.sequelize.sync();
  const s = await db.WorkoutSession.create({ type: 'strength', date: '2026-10-25', status: 'finished' });
  await db.WorkoutSet.bulkCreate([
    { sessionId: s.id, exerciseName: 'Row', exerciseOrder: 0, setNumber: 1, reps: 8, weight: 100 },
    { sessionId: s.id, exerciseName: 'Row', exerciseOrder: 0, setNumber: 2, reps: 8, weight: 100 },
    { sessionId: s.id, exerciseName: 'Rows', exerciseOrder: 1, setNumber: 1, reps: 8, weight: 105 },
  ]);
  await web(A, 'POST', '/logs/api/exercises/move', { from: 'Rows', to: 'Row', confirm: true });
  const got = await db.WorkoutSet.findAll({ where: { sessionId: s.id }, order: [['setNumber', 'ASC']] });
  assert.deepStrictEqual(got.map(g => [g.exerciseName, g.exerciseOrder, g.setNumber]), [['Row', 0, 1], ['Row', 0, 2], ['Row', 0, 3]]);
});

test('move: bad input refused, unknown 404, other account untouched, cross-origin and non-JSON refused', { skip }, async () => {
  const move = (u, body, h) => web(u, 'POST', '/logs/api/exercises/move', body, h).then(json);
  assert.strictEqual((await move(A, { from: 'Bench Press', to: '  ', confirm: true })).status, 400);
  assert.strictEqual((await move(A, { from: 'Bench Press', to: 'Bench Press', confirm: true })).status, 400);
  assert.strictEqual((await move(A, { from: 'Nope', to: 'Other', confirm: true })).status, 404);
  // B has no "Bench Press": A's name does not exist in B's file, so it is a 404 and nothing moves.
  assert.strictEqual((await move(B, { from: 'Bench Press', to: 'Hacked', confirm: true })).status, 404);
  assert.strictEqual(await getDatabase(A).WorkoutSet.count({ where: { exerciseName: 'Hacked' } }), 0);
  assert.strictEqual(await getDatabase(B).WorkoutSet.count({ where: { exerciseName: 'Hacked' } }), 0);
  assert.strictEqual((await move(A, { from: 'Bench Press', to: 'X1' }, { Origin: 'https://evil.example' })).status, 403);
  assert.strictEqual((await move(A, null, { 'Content-Type': 'text/plain' })).status, 415);
  assert.strictEqual((await move('', { from: 'a', to: 'b' })).status, 302);
});

test('detail page: PRs, graph hooks, plateau verdict; unknown name is a 404; isolated per account', { skip }, async () => {
  const dates = ['2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22', '2026-08-29'];
  await seed(A, 'Chest Press', dates, 150);
  const url = n => `/logs/exercises/detail?name=${encodeURIComponent(n)}`;
  const r = await web(A, 'GET', url('Chest Press'));
  assert.strictEqual(r.status, 200);
  const html = await r.text();
  assert.match(html, /Personal records/); assert.match(html, /Epley/);
  assert.match(html, /id="ex-canvas"/); assert.match(html, /chart\.umd\.js/);
  assert.match(html, /Plateau/); assert.match(html, /Check sleep, food and protein|Check sleep, food and stress/);
  assert.match(html, /not medical advice/i);
  assert.strictEqual((await web(A, 'GET', url('Nothing Here'))).status, 404);
  assert.strictEqual((await web(B, 'GET', url('Chest Press'))).status, 404, "B cannot read A's history");
  const j = (await json(await web(A, 'GET', '/logs/api/exercises/stats?name=Chest%20Press'))).body;
  assert.strictEqual(j.plateau.status, 'plateau'); assert.strictEqual(j.sessions, 5);
});

test('chart.js is served through the stamped vendor route, and views are mobile-safe', () => {
  const { KIT_FILES } = require('../build');
  assert.strictEqual(KIT_FILES['/vendor/chart.umd.js'], 'chart.js/dist/chart.umd.js');
  for (const f of ['exercises-list.ejs', 'exercises-detail.ejs']) {
    const t = fs.readFileSync(path.join(__dirname, '..', 'views', f), 'utf8');
    assert.match(t, /viewport-fit=cover/); assert.match(t, /asset\('\/theme\.css'\)/); assert.match(t, /partials\/dialog/);
    assert.doesNotMatch(t, /(?:src|href)="\/(?:js|vendor)\/[^"]*"/, 'static files go through asset()');
  }
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'exercises.css'), 'utf8');
  assert.match(css, /\.table-wrap \{[^}]*overflow-x: auto/);
  assert.match(css, /min-height: 44px/);
});
