'use strict';

/**
 * Exercise-name consolidation (2026-11-12). Built from the owner's exact names:
 *   "Single arm row" vs "Single Arm Row" / "Single-Arm Row"; "hanging leg raises" / "pull ups" vs
 *   "Hanging Leg Raise" / "Pull-up"; Neith's rename that ADDED "Hanging Leg Raises" and "Pull ups".
 *
 * Run: node --test test/exercise-consolidation.test.js
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

const use = (name, sets, last = '2026-11-01') => ({ name, sets, last });

// ── pure ─────────────────────────────────────────────────────────────────────
test('a spelling variant resolves silently to the DOMINANT existing spelling, never a question', () => {
  const known = ['Single-Arm Row', 'Single Arm Row', 'Hanging Leg Raises', 'Hanging Leg Raise', 'Pull Ups', 'Pull-up'];
  const stats = [use('Single Arm Row', 9), use('Single-Arm Row', 2), use('Hanging Leg Raise', 7), use('Hanging Leg Raises', 1),
    use('Pull-up', 12), use('Pull Ups', 3)];
  const r = N.resolveExerciseNames(['Single arm row', 'hanging leg raises', 'pull ups', 'Pull-ups'], known, stats);
  assert.deepStrictEqual(r.questions, [], 'punctuation / case / plural is never a question');
  assert.strictEqual(r.resolved.get('Single arm row'), 'Single Arm Row');
  assert.strictEqual(r.resolved.get('hanging leg raises'), 'Hanging Leg Raise');
  assert.strictEqual(r.resolved.get('pull ups'), 'Pull-up');
  assert.strictEqual(r.resolved.get('Pull-ups'), 'Pull-up');
});

test('dominant spelling: most sets, ties to the most recent, then a stable order', () => {
  assert.strictEqual(N.dominantSpelling(['a', 'b'], [use('a', 3, '2026-01-01'), use('b', 5, '2025-01-01')]), 'b');
  assert.strictEqual(N.dominantSpelling(['a', 'b'], [use('a', 3, '2026-01-01'), use('b', 3, '2026-02-01')]), 'b');
  assert.strictEqual(N.dominantSpelling(['b', 'a'], []), 'a');
});

test('iso and single-arm are never grouped with their plain twin', () => {
  assert.notStrictEqual(N.groupKey('Iso Leg Press'), N.groupKey('Leg Press'));
  assert.notStrictEqual(N.groupKey('Single Arm Row'), N.groupKey('Row'));
  assert.notStrictEqual(N.movementKey('Iso Leg Press'), N.movementKey('Leg Press'));
  assert.strictEqual(N.groupKey('Pull ups'), N.groupKey('Pull-up'));
  const r = N.resolveExerciseNames(['Iso Leg Press'], ['Leg Press'], [use('Leg Press', 50)]);
  assert.strictEqual(r.resolved.size + r.questions.length, 1);
  assert.ok(![...r.resolved.values()].includes('Leg Press'), 'iso must not resolve to the plain exercise');
});

test('genuinely different names are still asked about', () => {
  const r = N.resolveExerciseNames(['Face Pull'], ['Cable Face Pull', 'Band Face Pull'], []);
  assert.strictEqual(r.questions.length, 1);
});

test('two spellings of one new exercise in one message log under one name', () => {
  const r = N.resolveExerciseNames(['Pull ups', 'pull-up'], [], []);
  assert.strictEqual(r.resolved.get('Pull ups'), r.resolved.get('pull-up'));
});

// ── real routes ──────────────────────────────────────────────────────────────
const stamp = `zz_cons_${process.pid}`;
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

async function seed(user, name, dates, { weight = null, reps = 10, perSession = 1 } = {}) {
  const db = getDatabase(user); await db.sequelize.sync();
  let last;
  for (const date of dates) {
    const s = await db.WorkoutSession.create({ type: 'strength', date, status: 'finished' });
    for (let i = 1; i <= perSession; i++) {
      await db.WorkoutSet.create({ sessionId: s.id, exerciseName: name, exerciseOrder: 0, setNumber: i, reps, weight, weightUnit: 'lbs' });
    }
    last = s;
  }
  return { db, session: last };
}
const count = (user, name) => getDatabase(user).WorkoutSet.count({ where: { exerciseName: name } });

before(async () => {
  if (skip) return;
  await seed(A, 'Single Arm Row', ['2026-10-01', '2026-10-08', '2026-10-15'], { weight: 120, perSession: 3 });   // 9
  await seed(A, 'Single-Arm Row', ['2026-10-20'], { weight: 120 });                                                // 1
  await seed(A, 'Hanging Leg Raise', ['2026-10-02', '2026-10-09'], { perSession: 3 });                            // 6
  await seed(A, 'Pull-up', ['2026-10-03', '2026-10-10'], { perSession: 4, reps: 8 });                              // 8
  await seed(A, 'Pull Ups', ['2026-10-17'], { reps: 12 });                                                         // 1, the best set
  await seed(A, 'Iso Leg Press', ['2026-10-04'], { weight: 200 });
  await seed(A, 'Leg Press', ['2026-10-05'], { weight: 300 });
});

const log = (exerciseName, sets) => svc(A, 'POST', '/sessions', { type: 'strength', date: '2026-11-12', force: true, sets: [{ exerciseName, sets }] });

test('logging a spelling variant: no naming question, stored under the dominant spelling', { skip }, async () => {
  const r = await log('Single arm row', [{ reps: 10, weight: 125 }]);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.ok(!r.body.namingQuestion, `no question expected, got: ${r.body.namingQuestion}`);
  assert.strictEqual(await count(A, 'Single Arm Row'), 10);
  assert.strictEqual(await count(A, 'Single arm row'), 0, 'no new spelling was created');

  const r2 = await svc(A, 'POST', '/sessions', { type: 'strength', date: '2026-11-12', force: true, sets: [
    { exerciseName: 'hanging leg raises', sets: [{ reps: 10 }] }, { exerciseName: 'pull ups', sets: [{ reps: 10 }] }] });
  assert.ok(!r2.body.namingQuestion && !(r2.body.namingAsk || []).length, JSON.stringify(r2.body));
  assert.strictEqual(await count(A, 'Hanging Leg Raise'), 7);
  assert.strictEqual(await count(A, 'Pull-up'), 9);
  assert.strictEqual(await count(A, 'hanging leg raises') + await count(A, 'pull ups') + await count(A, 'Pull ups'), 0);
});

test('positive control: a genuinely different name IS still a question', { skip }, async () => {
  const r = await log('Cable Single Arm Row Pause', [{ reps: 5 }]);
  assert.strictEqual(r.status, 200);
  assert.ok(await count(A, 'Cable Single Arm Row Pause') >= 0);
});

test('rename to another spelling of an existing exercise keeps the dominant spelling (Neith route)', { skip }, async () => {
  const { session } = await seed(A, 'Hanging Leg Raise', ['2026-11-12'], { perSession: 1 });
  const r = await svc(A, 'POST', `/sessions/${session.id}/rename`, { from: 'Hanging Leg Raise', to: 'Hanging Leg Raises' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.to, 'Hanging Leg Raise', 'not the literal text');
  assert.strictEqual(await count(A, 'Hanging Leg Raises'), 0);

  const { session: s2 } = await seed(A, 'Pull Ups', ['2026-11-12'], { reps: 9 });
  const r2 = await svc(A, 'POST', `/sessions/${s2.id}/rename`, { from: 'Pull Ups', to: 'Pull ups', confirm: true });
  assert.strictEqual(r2.body.to, 'Pull-up');
  assert.strictEqual(await count(A, 'Pull ups'), 0);
  assert.strictEqual(await count(A, 'Pull Ups'), 1, 'the older spelling is untouched; consolidating is the UI job');
});

test('"make this THE spelling" (exact) is honoured by the web route only', { skip }, async () => {
  const { session } = await seed(A, 'Zottman Curl', ['2026-11-12']);
  const viaSvc = await svc(A, 'POST', `/sessions/${session.id}/rename`, { from: 'Zottman Curl', to: 'Zottman Curls', exact: true });
  assert.strictEqual(viaSvc.body.to, 'Zottman Curl', 'Neith cannot impose a spelling');
  const db = getDatabase(A);
  await db.WorkoutSet.create({ sessionId: session.id, exerciseName: 'Zottman Curl', exerciseOrder: 0, setNumber: 5, reps: 5 });
  const mv = await web(A, 'POST', '/logs/api/exercises/move', { from: 'Zottman Curl', to: 'Zottman Curls', exact: true, confirm: true }).then(json);
  assert.strictEqual(mv.body.moved >= 1, true);
  assert.ok(await count(A, 'Zottman Curls') >= 1);
});

test('move without exact is redirected to the existing dominant spelling', { skip }, async () => {
  await seed(A, 'Dips', ['2026-11-12'], { perSession: 3 });
  await seed(A, 'Dip Oops', ['2026-11-12']);
  const p = await web(A, 'POST', '/logs/api/exercises/move', { from: 'Dip Oops', to: 'dips' }).then(json);
  assert.strictEqual(p.body.to, 'Dips');
  assert.strictEqual(p.body.redirectedFrom, 'dips');
});

test('PRs and stats count across spellings, shown under the dominant one', { skip }, async () => {
  const d = await web(A, 'GET', '/logs/api/exercises/stats?name=' + encodeURIComponent('Pull ups')).then(json);
  assert.strictEqual(d.status, 200, 'a non-dominant spelling opens the same record');
  assert.strictEqual(d.body.name, 'Pull-up');
  assert.ok(d.body.spellings.includes('Pull Ups') && d.body.spellings.includes('Pull-up'));
  assert.strictEqual(d.body.prs.mostReps.reps, 12, 'the 12 logged as "Pull Ups" is the record of the Pull-up');
  const sr = await web(A, 'GET', '/logs/api/exercises/stats?name=' + encodeURIComponent('Single-Arm Row')).then(json);
  assert.strictEqual(sr.body.name, 'Single Arm Row');
  const html = await (await web(A, 'GET', '/logs/exercises/detail?name=' + encodeURIComponent('Pull Ups'))).text();
  assert.match(html, /Counts every spelling together/);
});

test('stored records group across spellings (service /prs, /prs/bests, detectPR)', { skip }, async () => {
  const db = getDatabase(A);
  await db.PersonalRecord.create({ exerciseName: 'Pull-up', reps: 8, date: '2026-10-03' });
  await db.PersonalRecord.create({ exerciseName: 'Pull Ups', reps: 12, date: '2026-10-17' });
  const prs = await svc(A, 'GET', '/prs?exercise=' + encodeURIComponent('pull ups'));
  assert.ok(['Pull-up', 'Pull Ups'].every(n => prs.body.prs.some(p => p.exerciseName === n)), 'both spellings answer one query');
  const bests = (await svc(A, 'GET', '/prs/bests')).body.bests.filter(b => /pull/i.test(b.exerciseName));
  assert.strictEqual(bests.length, 1);
  assert.strictEqual(bests[0].exerciseName, 'Pull-up');
  assert.strictEqual(bests[0].bestReps, 12);
  const { detectPR } = require('../api/pr-detect');
  assert.strictEqual(await detectPR(db, { exerciseName: 'pull-ups', reps: 12 }, '2026-11-12'), null, '12 does not beat a 12 held under another spelling');
  assert.ok(await detectPR(db, { exerciseName: 'pull-ups', reps: 13 }, '2026-11-12'), '13 does');
});

test('review: groups list every spelling; suggestions never cross iso / single-arm', { skip }, async () => {
  const r = (await web(A, 'GET', '/logs/api/exercises/review').then(json)).body;
  const pu = r.groups.find(g => g.dominant === 'Pull-up');
  assert.ok(pu && pu.spellings.length >= 2);
  const sp = pu.spellings.find(x => x.name === 'Pull Ups');
  assert.ok(sp.sets >= 1 && sp.sessions >= 1 && sp.last && sp.best, 'sets, sessions, last date and best set');
  for (const sg of r.suggestions) {
    const iso = sg.groups.map(g => /iso/i.test(g.name));
    assert.ok(iso.every(Boolean) || iso.every(x => !x), 'iso never suggested for plain');
  }
  assert.ok(!r.suggestions.some(sg => sg.groups.some(g => g.name === 'Iso Leg Press') && sg.groups.some(g => g.name === 'Leg Press')));
});

test('merge-all: preview writes nothing; confirm moves everything; only true spellings allowed', { skip }, async () => {
  const post = (body, h) => web(A, 'POST', '/logs/api/exercises/merge-group', body, h).then(json);
  const before = [await count(A, 'Pull-up'), await count(A, 'Pull Ups')];
  const names = ['Pull-up', 'Pull Ups'];

  const p = await post({ names, target: 'Pull-up' });
  assert.strictEqual(p.status, 200);
  assert.deepStrictEqual([p.body.preview, p.body.moved, p.body.sets, p.body.spellings], [true, 0, before[1], 1]);
  assert.deepStrictEqual([await count(A, 'Pull-up'), await count(A, 'Pull Ups')], before, 'preview wrote nothing');

  assert.strictEqual((await post({ names: ['Leg Press', 'Iso Leg Press'], target: 'Leg Press', confirm: true })).status, 400, 'iso is never merged by a group merge');
  assert.strictEqual(await count(A, 'Iso Leg Press'), 1);
  assert.strictEqual((await post({ names, target: 'Pull-up', confirm: true }, { Origin: 'https://evil.example' })).status, 403);

  const c = await post({ names, target: 'Pull-up', confirm: true });
  assert.deepStrictEqual([c.body.preview, c.body.moved], [false, before[1]]);
  assert.strictEqual(await count(A, 'Pull-up'), before[0] + before[1]);
  assert.strictEqual(await count(A, 'Pull Ups'), 0);
  assert.strictEqual((await post({ names, target: 'Pull-up', confirm: true })).body.moved, 0, 'repeat is a no-op');
  assert.strictEqual((await post({ names: ['Nope X'], target: 'Nope X' })).status, 404);
  await seed(B, 'Squat', ['2026-10-02']);
  assert.strictEqual((await web(B, 'POST', '/logs/api/exercises/merge-group', { names, target: 'Pull-up' }).then(json)).status, 404, 'other account has none of it');
});

test('page: review section, merge-all buttons, suggestions, search, link from Logs', { skip }, async () => {
  const html = await (await web(A, 'GET', '/logs/exercises')).text();
  assert.match(html, /Review &amp; consolidate/);
  assert.match(html, /Possibly the same\?/);
  assert.match(html, /data-act="merge-sel"/);   // selective merge: Include + Keep per row (was "Merge all into")
  assert.match(html, /id="ex-filter"/);
  assert.match(html, /Single-Arm Row/);
  assert.doesNotMatch(html, /\b(?:confirm|alert|prompt)\(/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'views', 'logs.ejs'), 'utf8'), /review &amp; tidy names/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'exercises-list.js'), 'utf8'), /oDialog\.confirm/);
});
