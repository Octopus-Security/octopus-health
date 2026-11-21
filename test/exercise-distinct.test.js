'use strict';
/**
 * "Not the same": dismissed merge suggestions (api/exercise-distinct.js). Run: node --test test/exercise-distinct.test.js
 */
require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../api/exercise-distinct');
const N = require('../api/exercise-names');

let express, getDatabase;
try { express = require('express'); require('ejs'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/ejs/sequelize/sqlite3 not installed on this machine';

test('pairOf is order-independent and refuses junk', () => {
  assert.deepStrictEqual(D.pairOf('b', 'a'), D.pairOf('a', 'b'));
  assert.strictEqual(D.pairOf('a', 'a'), null);
  assert.strictEqual(D.pairOf('', 'a'), null);
  assert.ok(D.cleanPairs([]).error);
  assert.ok(D.cleanPairs([['a']]).error);
  assert.strictEqual(D.cleanPairs([['b', 'a'], ['a', 'b']]).pairs.length, 1);
});

test('survivors: a 3-group suggestion with one pair dismissed still shows the rest; all dismissed removes it', () => {
  const g = ['A', 'B', 'C'].map(key => ({ key }));
  const one = new Set([D.pairKey(D.pairOf('A', 'B'))]);
  assert.deepStrictEqual(D.survivors(g, one).map(x => x.key), ['A', 'B', 'C']);   // A-C and B-C remain
  const two = new Set([D.pairKey(D.pairOf('A', 'B')), D.pairKey(D.pairOf('A', 'C'))]);
  assert.deepStrictEqual(D.survivors(g, two).map(x => x.key), ['B', 'C']);        // A drops out
  const all = new Set([['A', 'B'], ['A', 'C'], ['B', 'C']].map(p => D.pairKey(D.pairOf(...p))));
  assert.deepStrictEqual(D.survivors(g, all), []);
});

const stamp = `zz_distinct_${process.pid}`;
const A = `${stamp}_a`, B = `${stamp}_b`;
let server, base;
before(async () => {
  if (skip) return;
  const { asset } = require('../build');
  const app = express();
  app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.asset = asset;
  app.use(express.json());
  const requireLogin = (req, res, next) => {
    const u = req.get('x-test-user');
    if (!u) return res.status(302).set('Location', '/login').end();
    req.user = { username: u }; res.locals.user = req.user; res.locals.activeTab = 'logs';
    next();
  };
  require('../api/web-exercises')(app, { requireLogin, getDatabase });
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
  for (const u of [A, B]) {
    const db = getDatabase(u); await db.sequelize.sync();
    const s = await db.WorkoutSession.create({ type: 'strength', date: '2026-11-01', status: 'finished' });
    let i = 0;
    for (const n of ['Barbell Bench Press', 'Dumbbell Bench Press', 'Smith Machine Bench Press']) {
      await db.WorkoutSet.create({ sessionId: s.id, exerciseName: n, exerciseOrder: i++, setNumber: 1, reps: 5, weight: 100, weightUnit: 'lbs' });
    }
  }
});
after(() => {
  if (server) server.close();
  for (const n of [A, B]) try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${n}_health.sqlite`)); } catch { /* none */ }
});
const web = (user, method, p, body, headers = {}) => fetch(base + p, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...(user ? { 'X-Test-User': user } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
const review = async (u) => (await (await web(u, 'GET', '/logs/api/exercises/review')).json());
const key = (n) => N.groupKey(n);
const bench = (r) => r.suggestions.find(s => s.movement === 'bench press');

test('the three bench presses are suggested to begin with', { skip }, async () => {
  assert.strictEqual(bench(await review(A)).groups.length, 3);
});

test('dismiss hides the pair, only for that user, and order does not matter; restore brings it back', { skip }, async () => {
  const body = { pairs: [[key('Dumbbell Bench Press'), key('Barbell Bench Press')]] };
  const r = await (await web(A, 'POST', '/logs/api/exercises/distinct', body)).json();
  assert.deepStrictEqual([r.ok, r.added], [true, 1]);
  // Barbell-Dumbbell is hidden but both still pair with Smith, so all three remain
  assert.strictEqual(bench(await review(A)).groups.length, 3);
  // dismiss the other two pairs the other way round: the suggestion vanishes and the count drops
  const before = (await review(A)).suggestions.length;
  await web(A, 'POST', '/logs/api/exercises/distinct', { pairs: [[key('Smith Machine Bench Press'), key('Barbell Bench Press')], [key('Dumbbell Bench Press'), key('Smith Machine Bench Press')]] });
  const after = await review(A);
  assert.strictEqual(bench(after), undefined);
  assert.strictEqual(after.suggestions.length, before - 1);
  assert.strictEqual(after.dismissed.length, 3);
  assert.ok(bench(await review(B)), 'another account is unaffected');
  // re-dismissing is a no-op
  assert.strictEqual((await (await web(A, 'POST', '/logs/api/exercises/distinct', body)).json()).added, 0);
  const html = await (await web(A, 'GET', '/logs/exercises')).text();
  assert.match(html, /Dismissed \(3\) — show/);
  assert.match(html, /data-act="restore"/);
  // restore one pair (reversed order): that pair is suggested again
  const rr = await (await web(A, 'POST', '/logs/api/exercises/distinct/restore', { pairs: [[key('Smith Machine Bench Press'), key('Barbell Bench Press')]] })).json();
  assert.strictEqual(rr.removed, 1);
  const back = bench(await review(A));
  assert.deepStrictEqual(back.groups.map(g => g.name).sort(), ['Barbell Bench Press', 'Smith Machine Bench Press']);
});

test('a new spelling of a dismissed exercise is still suggested (pairs, not names)', { skip }, async () => {
  const db = getDatabase(A);
  const s = await db.WorkoutSession.create({ type: 'strength', date: '2026-11-02', status: 'finished' });
  await db.WorkoutSet.create({ sessionId: s.id, exerciseName: 'EZ Bar Bench Press', exerciseOrder: 0, setNumber: 1, reps: 5 });
  assert.ok(bench(await review(A)).groups.some(g => g.name === 'EZ Bar Bench Press'));
});

test('routes: cross-origin and non-JSON are refused, junk pairs are 400', { skip }, async () => {
  const ok = { pairs: [['a', 'b']] };
  assert.strictEqual((await web(A, 'POST', '/logs/api/exercises/distinct', ok, { Origin: 'https://evil.example' })).status, 403);
  assert.strictEqual((await web(A, 'POST', '/logs/api/exercises/distinct', ok, { 'Content-Type': 'text/plain' })).status, 415);
  assert.strictEqual((await web(null, 'POST', '/logs/api/exercises/distinct', ok)).status, 302);
  assert.strictEqual((await web(A, 'POST', '/logs/api/exercises/distinct', { pairs: [['a', 'a']] })).status, 400);
});

test('migration is idempotent: the table syncs twice and keeps its rows', { skip }, async () => {
  const db = getDatabase(B);
  await db.ExerciseDistinct.findOrCreate({ where: { a: 'x', b: 'y' }, defaults: { a: 'x', b: 'y' } });
  await db.ExerciseDistinct.sync(); await db.sequelize.sync(); await db.ExerciseDistinct.sync();
  assert.strictEqual(await db.ExerciseDistinct.count({ where: { a: 'x', b: 'y' } }), 1);
  await assert.rejects(db.ExerciseDistinct.create({ a: 'x', b: 'y' }), 'unique pair');
});
