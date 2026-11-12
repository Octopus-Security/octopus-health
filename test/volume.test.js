'use strict';
/**
 * Muscle volume: the maths (pure, fixtures), the window stepping, and the export route at the
 * route level with a positive control. The route half skips without express/sequelize/sqlite3.
 * Run: node --test test/volume.test.js
 */
require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const V = require('../lib/volume');

const DEFS = {
  bench:  { id: 1, name: 'Bench Press', category: 'strength', equipment: 'barbell', primaryMuscles: '["chest"]', secondaryMuscles: '["triceps","front_delts"]' },
  pullup: { id: 2, name: 'Pull-up', category: 'strength', equipment: 'bodyweight', primaryMuscles: '["lats"]', secondaryMuscles: '["biceps"]' },
  plank:  { id: 3, name: 'Plank', category: 'strength', equipment: 'bodyweight', primaryMuscles: '["abs"]', secondaryMuscles: '[]' },
  stretch:{ id: 4, name: 'Chest stretch', category: 'recovery', equipment: 'none', primaryMuscles: '["chest"]', secondaryMuscles: '[]' },
  mystery:{ id: 5, name: 'Wibble', category: 'strength', equipment: 'none', primaryMuscles: '["wibble"]', secondaryMuscles: '[]' },
};
const byName = s => Object.values(DEFS).find(d => d.name === s.exerciseName) || null;
const P = (extra = {}) => V.parseParams({ from: '2026-01-01', to: '2026-01-30', ...extra }, { today: '2026-01-30' });

test('credits: primary full, secondary half, recovery none, overridable', () => {
  assert.deepStrictEqual(V.creditsFor(DEFS.bench), { chest: 1, triceps: 0.5, front_delts: 0.5 });
  assert.deepStrictEqual(V.creditsFor(DEFS.stretch), {});
  assert.strictEqual(V.creditsFor(DEFS.bench, { secondaryCredit: 0.25 }).triceps, 0.25);
});

test('set facts: kg converted, bodyweight has no tonnage, timed hold, warm-up and failed rules', () => {
  assert.strictEqual(V.setFacts({ reps: 5, weight: 100, weightUnit: 'lbs' }).tonnage, 500);
  assert.ok(Math.abs(V.setFacts({ reps: 10, weight: 50, weightUnit: 'kg' }).tonnage - 1102.31) < 0.01);
  assert.deepStrictEqual(V.setFacts({ reps: 10 }), { hard: true, reps: 10, tonnage: 0, seconds: 0 });
  assert.deepStrictEqual(V.setFacts({ duration: 60 }), { hard: true, reps: 0, tonnage: 0, seconds: 60 });
  assert.strictEqual(V.setFacts({ reps: 10, weight: 45, rpe: 3 }).hard, false);
  assert.strictEqual(V.setFacts({ reps: 3, weight: 200, failed: true }).hard, true);
  assert.strictEqual(V.setFacts({}).hard, false);
});

test('compute: fixture totals per muscle', () => {
  const sets = [
    { date: '2026-01-05', exerciseName: 'Bench Press', reps: 10, weight: 100, weightUnit: 'lbs' },
    { date: '2026-01-05', exerciseName: 'Bench Press', reps: 8, weight: 100, weightUnit: 'lbs' },
    { date: '2026-01-06', exerciseName: 'Pull-up', reps: 8 },
    { date: '2026-01-06', exerciseName: 'Plank', duration: 45 },
    { date: '2026-01-06', exerciseName: 'Chest stretch', duration: 30 },
    { date: '2026-01-06', exerciseName: 'Wibble', reps: 5 },
  ];
  const r = V.compute(sets, byName, P());
  assert.strictEqual(r.windows.length, 1);
  const m = r.windows[0].muscles;
  assert.deepStrictEqual([m.chest.sets, m.chest.hardSets, m.chest.reps, m.chest.tonnageLbs], [2, 2, 18, 1800]);
  assert.deepStrictEqual([m.triceps.hardSets, m.triceps.reps, m.triceps.tonnageLbs], [1, 9, 900]);
  assert.deepStrictEqual([m.lats.hardSets, m.lats.tonnageLbs], [1, 0]);
  assert.strictEqual(m.biceps.hardSets, 0.5);
  assert.deepStrictEqual([m.abs.hardSets, m.abs.seconds], [1, 45]);
  assert.strictEqual(m.chest.weeklySets, 0.5); // 2 x 7 / 30 = 0.47
  assert.deepStrictEqual(r.skipped, { unmapped: 1, considered: 5 }); // stretch ignored entirely
});

test('status against the guideline, and a configurable guideline', () => {
  const g = { min: 10, max: 20 };
  assert.deepStrictEqual([0, 5, 10, 20, 21].map(n => V.statusFor(n, g)), ['untrained', 'under', 'ok', 'ok', 'over']);
  const sets = Array.from({ length: 6 }, () => ({ date: '2026-01-03', exerciseName: 'Pull-up', reps: 5 }));
  const wk = r => r.windows[0].muscles.lats;
  assert.strictEqual(wk(V.compute(sets, byName, P({ length: 7, to: '2026-01-07' }))).status, 'under'); // 6/wk
  assert.strictEqual(wk(V.compute(sets, byName, P({ length: 7, to: '2026-01-07', guidelineMin: 3, guidelineMax: 5 }))).status, 'over');
});

test('window stepping: step 1 slides by a day, 7 and 14 and odd steps work, only full windows', () => {
  const w1 = V.windowList('2026-01-01', '2026-02-02', 30, 1);
  assert.deepStrictEqual(w1.map(w => [w.start, w.end]), [['2026-01-01', '2026-01-30'], ['2026-01-02', '2026-01-31'], ['2026-01-03', '2026-02-01'], ['2026-01-04', '2026-02-02']]);
  assert.deepStrictEqual(V.windowList('2026-01-01', '2026-03-01', 30, 14).map(w => w.start), ['2026-01-01', '2026-01-15', '2026-01-29']);
  assert.deepStrictEqual(V.windowList('2026-01-01', '2026-02-28', 30, 7).map(w => w.start), ['2026-01-01', '2026-01-08', '2026-01-15', '2026-01-22', '2026-01-29']);
  assert.strictEqual(V.windowList('2026-01-01', '2026-01-20', 30, 1).length, 0);
  assert.deepStrictEqual(V.windowList('2026-01-01', '2026-01-12', 3, 5).map(w => w.start), ['2026-01-01', '2026-01-06', '2026-01-11'].slice(0, 2));
});

test('a set moves out of the window as it slides (scrub changes the numbers)', () => {
  const sets = [{ date: '2026-01-01', exerciseName: 'Pull-up', reps: 5 }];
  const r = V.compute(sets, byName, P({ to: '2026-01-31' }));
  assert.deepStrictEqual(r.windows.map(w => w.muscles.lats.sets), [1, 0]);
});

test('parseParams rejects bad input and defaults the span', () => {
  const bad = q => V.parseParams(q, { today: '2026-01-30' }).ok;
  assert.strictEqual(bad({ length: 0 }), false);
  assert.strictEqual(bad({ step: 1.5 }), false);
  assert.strictEqual(bad({ from: '2026-02-01', to: '2026-01-01' }), false);
  assert.strictEqual(bad({ guidelineMin: 9, guidelineMax: 3 }), false);
  assert.strictEqual(bad({ secondaryCredit: 2 }), false);
  assert.strictEqual(bad({ to: 'nonsense' }), false);
  assert.strictEqual(bad({ from: '2000-01-01', step: 1 }), false); // > MAX_WINDOWS
  const d = V.parseParams({}, { today: '2026-01-30', firstDate: '2026-01-20' });
  assert.strictEqual(d.from, '2026-01-01'); // never shorter than one window
});

test('csv: header, one row per window x muscle, formula guard', () => {
  const r = V.compute([], byName, P());
  const lines = V.toCsv(r).trim().split('\n');
  assert.strictEqual(lines[0], V.CSV_COLUMNS.join(','));
  assert.strictEqual(lines.length, 1 + r.muscles.length);
  assert.match(lines[1], /^2026-01-01,2026-01-30,30,/);
});

// ── route level ──────────────────────────────────────────────────────────────
let express, ejs, getDatabase;
try { express = require('express'); ejs = require('ejs'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/ejs/sequelize/sqlite3 not installed on this machine';
const stamp = `zz_vol_${process.pid}`;
const A = `${stamp}_a`, B = `${stamp}_b`;
let server, base;

before(async () => {
  if (skip) return;
  const { asset } = require('../build');
  const app = express();
  app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.asset = asset;
  const requireLogin = async (req, res, next) => {
    const u = req.get('x-test-user');
    if (!u) return res.status(302).set('Location', '/login').end();
    req.user = { username: u }; res.locals.user = req.user; res.locals.activeTab = 'body';
    await getDatabase(u).sequelize.sync(); next();
  };
  require('../api/volume')(app, { requireLogin, getDatabase });
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;

  const db = getDatabase(A);
  await db.sequelize.sync();
  const def = await db.ExerciseDefinition.create({ name: 'Zz Volume Press', category: 'strength', equipment: 'barbell', primaryMuscles: '["chest"]', secondaryMuscles: '["triceps"]', isCustom: true });
  const s = await db.WorkoutSession.create({ date: '2026-01-10', type: 'strength', status: 'finished' });
  for (let i = 1; i <= 3; i++) await db.WorkoutSet.create({ sessionId: s.id, exerciseId: def.id, exerciseName: def.name, setNumber: i, reps: 10, weight: 100, weightUnit: 'lbs' });
  await getDatabase(B).sequelize.sync(); // B has no sets at all
});
after(() => {
  if (server) server.close();
  for (const n of [A, B]) try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${n}_health.sqlite`)); } catch { /* none */ }
});

const get = (u, p) => fetch(base + p, { redirect: 'manual', headers: u ? { 'X-Test-User': u } : {} });
const Q = '/volume/api/windows?from=2026-01-01&to=2026-01-30&length=30&step=1';

test('route: signed-out is bounced, never served', { skip }, async () => {
  const r = await get(null, Q);
  assert.strictEqual(r.status, 302);
});

test('route: positive control, the owner of the sets sees exactly their numbers', { skip }, async () => {
  const r = await get(A, Q);
  assert.strictEqual(r.status, 200);
  const j = await r.json();
  assert.strictEqual(j.success, true);
  assert.strictEqual(j.windows.length, 1);
  const m = j.windows[0].muscles;
  assert.deepStrictEqual([m.chest.sets, m.chest.hardSets, m.chest.tonnageLbs], [3, 3, 3000]);
  assert.deepStrictEqual([m.triceps.hardSets, m.triceps.tonnageLbs], [1.5, 1500]);
  assert.strictEqual(m.chest.status, 'under');
  assert.deepStrictEqual(j.dataRange, { first: '2026-01-10', last: '2026-01-10' });
});

test('route: another account gets none of it (own data only)', { skip }, async () => {
  const j = await (await get(B, Q)).json();
  assert.strictEqual(j.windows[0].muscles.chest.sets, 0);
  assert.strictEqual(j.windows[0].muscles.chest.tonnageLbs, 0);
});

test('route: csv export carries the same numbers and a download header', { skip }, async () => {
  const r = await get(A, Q + '&format=csv');
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/csv/);
  assert.match(r.headers.get('content-disposition'), /attachment/);
  const row = (await r.text()).split('\n').find(l => l.split(',')[3] === 'chest');
  assert.ok(row.startsWith('2026-01-01,2026-01-30,30,chest,Chest,3,3,'));
  assert.strictEqual(row.split(',')[9], '3000');
});

test('route: bad parameters are a 400, and the page renders', { skip }, async () => {
  assert.strictEqual((await get(A, '/volume/api/windows?length=0')).status, 400);
  assert.strictEqual((await get(A, '/volume/api/windows?step=abc')).status, 400);
  const p = await get(A, '/volume');
  assert.strictEqual(p.status, 200);
  const html = await p.text();
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /data-id="chest"/);
});
