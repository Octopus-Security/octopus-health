'use strict';
// Attaching muscles to a logged name. Nothing is guessed. A second account
// does not see the row. Run: node --test test/assign-muscles.test.js
require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const plan = require('../lib/assign-muscles').plan;

test('plan refuses an unknown muscle and a catalogue row that already has some', () => {
  const no = plan(null, { name: 'Chest Fly Sitting Forward', primaryMuscles: ['not-a-muscle'] });
  assert.strictEqual(no.ok, false);
  assert.strictEqual(no.status, 400);
  const seeded = plan(
    { isCustom: false, name: 'Cable Chest Fly', primaryMuscles: '["chest"]' },
    { name: 'Cable Chest Fly', primaryMuscles: ['chest'] },
  );
  assert.strictEqual(seeded.status, 409);
  const stretch = plan({ isCustom: false, name: 'Hamstring stretch', primaryMuscles: '[]' }, { name: 'Hamstring stretch', as: 'stretch' });
  assert.strictEqual(stretch.status, 409);
  const ok = plan(null, { name: 'Chest Fly Sitting Forward', primaryMuscles: ['chest', 'nope'], secondaryMuscles: ['chest', 'triceps'] });
  assert.deepStrictEqual(ok.fields.primaryMuscles, ['chest']);
  assert.deepStrictEqual(ok.fields.secondaryMuscles, ['triceps']);
});

let express, getDatabase;
try { express = require('express'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/sequelize/sqlite3 not installed on this machine';
const stamp = `zz_asg_${process.pid}`;
const A = `${stamp}_a`, B = `${stamp}_b`;
let server, base;

before(async () => {
  if (skip) return;
  const app = express();
  app.use(express.json());
  const requireLogin = async (req, res, next) => {
    const u = req.get('x-test-user');
    if (!u) return res.status(302).end();
    req.user = { username: u, role: 'user' };
    await getDatabase(u).ensure();
    next();
  };
  require('../api/volume')(app, { requireLogin, getDatabase });
  await new Promise(r => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
  const db = getDatabase(A);
  await db.ensure();
  const s = await db.WorkoutSession.create({ date: '2026-11-13', type: 'strength', status: 'finished' });
  await db.WorkoutSet.create({ sessionId: s.id, exerciseName: 'Chest Fly Sitting Forward', setNumber: 1, reps: 10, weight: 40, weightUnit: 'lbs' });
  await db.WorkoutSet.create({ sessionId: s.id, exerciseName: 'Chest Fly Sitting Forward', setNumber: 2, reps: 8, weight: 40, weightUnit: 'lbs', rpe: 3 });
  await getDatabase(B).ensure();
});
after(() => {
  if (server) server.close();
  for (const n of [A, B]) try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${n}_health.sqlite`)); } catch { /* none */ }
});

const call = (user, method, p, body) => fetch(base + p, {
  method,
  headers: { 'X-Test-User': user, 'Content-Type': 'application/json', Accept: 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
});
const Q = '/volume/api/windows?from=2026-11-08&to=2026-11-14&length=7&step=7';

test('assigning chest to the logged name moves that account only', { skip }, async () => {
  const before = await (await call(A, 'GET', Q)).json();
  assert.strictEqual(before.windows[0].muscles.chest.hardSets, 0);
  assert.strictEqual(before.skipped.exercises[0].name, 'Chest Fly Sitting Forward');
  assert.strictEqual(before.skipped.exercises[0].hardSets, 1);
  assert.strictEqual(before.skipped.exercises[0].sets, 2);

  const saved = await call(A, 'POST', '/volume/api/assign', { name: 'Chest Fly Sitting Forward', primaryMuscles: ['chest'] });
  assert.strictEqual(saved.status, 200);
  const after = await (await call(A, 'GET', Q)).json();
  assert.strictEqual(after.windows[0].muscles.chest.hardSets, 1);
  assert.deepStrictEqual(after.skipped.exercises, []);

  const other = await (await call(B, 'GET', Q)).json();
  assert.strictEqual(other.windows[0].muscles.chest.hardSets, 0);
  const listed = await (await call(B, 'GET', '/volume/api/with-muscles')).json();
  assert.ok(!listed.exercises.some(e => e.name === 'Chest Fly Sitting Forward'));
});

test('a made-up muscle is refused and the copy list does not save by itself', { skip }, async () => {
  // "pecs" is a real alias for chest. A word the map does not know is refused.
  const bad = await call(A, 'POST', '/volume/api/assign', { name: 'Wide Chest Press Machine', primaryMuscles: ['wibble'] });
  assert.strictEqual(bad.status, 400);
  const still = await getDatabase(A).ExerciseDefinition.findOne({ where: { name: 'Wide Chest Press Machine' } });
  assert.strictEqual(still, null);
});
