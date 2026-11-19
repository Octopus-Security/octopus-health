'use strict';
// Per-side flag, holds and timed sets in the parser, the volume name match, and
// the Fix exercises page (bulk muscles / per-side / figure, preview then confirm).
// Run: node --test test/exercise-fix.test.js
require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const SIDES = require('../lib/sides');
const V = require('../lib/volume');
const { parseWorkout } = require('../api/workout-parse');

let express, ejs, getDatabase;
try {
  express = require('express');
  ejs = require('ejs');
  require('sequelize');
  require('sqlite3');
  getDatabase = require('../database');
} catch { /* skipped */ }
const skip = !getDatabase && 'express/ejs/sequelize/sqlite3 not installed on this machine';
const U = `zz_fix_${process.pid}`;
let server, base;

// ---------------------------------------------------------------- per-side maths

test('per-side: unilateral doubles reps, seconds and load; a per-hand note doubles only the load; a set stays one set', () => {
  const uni = { sides: 'unilateral' }, bi = { sides: 'bilateral' };
  assert.deepStrictEqual(V.setFacts({ reps: 10, weight: 25 }, uni), { hard: true, reps: 20, tonnage: 500, seconds: 0 });
  assert.deepStrictEqual(V.setFacts({ duration: 30 }, uni), { hard: true, reps: 0, tonnage: 0, seconds: 60 });
  assert.deepStrictEqual(V.setFacts({ reps: 10, weight: 35, notes: 'each side' }, bi), { hard: true, reps: 10, tonnage: 700, seconds: 0 });
  assert.deepStrictEqual(V.setFacts({ reps: 10, weight: 35, notes: 'each side' }, null), { hard: true, reps: 10, tonnage: 700, seconds: 0 });
  assert.deepStrictEqual(V.setFacts({ reps: 10, weight: 35 }, bi), { hard: true, reps: 10, tonnage: 350, seconds: 0 });
  // Unchanged without a definition or a note (the old behaviour).
  assert.strictEqual(V.setFacts({ reps: 5, weight: 100 }).tonnage, 500);
});

test('per-side suggestions come from the name, or from how the sets were logged', () => {
  assert.strictEqual(SIDES.suggest('Bulgarian Split Squat').sides, 'unilateral');
  assert.strictEqual(SIDES.suggest('Single Arm Dumbbell Row').sides, 'unilateral');
  assert.strictEqual(SIDES.suggest('Side Plank').sides, 'unilateral');
  assert.strictEqual(SIDES.suggest('Barbell Bench Press').sides, 'bilateral');
  assert.strictEqual(SIDES.suggest('Hammer Curl', { total: 6, perSide: 4 }).sides, 'unilateral');
  assert.strictEqual(SIDES.suggest('Hammer Curl', { total: 6, perSide: 1 }), null);
  assert.strictEqual(SIDES.suggest('Alternating Lunges'), null, 'alternating is a choice, not a fact');
});

// ---------------------------------------------------------------- parser

test('parser: holds read "30s" as seconds, "3x30 sec" is three timed sets, and more per-side wordings', () => {
  const one = t => { const p = parseWorkout(t); return p.exercises[0] && { n: p.exercises[0].sets.length, ...p.exercises[0].sets[0] }; };
  let r = one('side plank 30s');            assert.strictEqual(r.duration, 30); assert.strictEqual(r.reps, null);
  r = one('plank 3x30 sec');                assert.strictEqual(r.n, 3); assert.strictEqual(r.duration, 30); assert.strictEqual(r.reps, null);
  r = one('plank 3x30s');                   assert.strictEqual(r.n, 3); assert.strictEqual(r.duration, 30);
  r = one('plank 2 x 1 min');               assert.strictEqual(r.n, 2); assert.strictEqual(r.duration, 60);
  r = one('side plank 3x30s a side');       assert.strictEqual(r.note, 'each side'); assert.strictEqual(r.n, 3);
  r = one('lunges 3x12/leg 25lb');          assert.strictEqual(r.note, 'each side'); assert.strictEqual(r.reps, 12); assert.strictEqual(r.weight, 25);
  r = one('bulgarian split squat 3x10 each'); assert.strictEqual(r.note, 'each side');
  r = one('goblet squat 3x10 each set 50lb'); assert.strictEqual(r.note, null, '"each set" is not a side');
  // Unchanged: for a non-hold, "10 x 30s" can mean 30 lb dumbbells, so it is still asked, not guessed.
  assert.strictEqual(parseWorkout('hammer curls 10 x 30s').exercises.length, 0);
  r = one('bench 3x10 135lb');              assert.strictEqual(r.n, 3); assert.strictEqual(r.weight, 135);
});

// ---------------------------------------------------------------- routes

before(async () => {
  if (skip) return;
  const { asset } = require('../build');
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.asset = asset;
  app.use(express.json());
  const requireLogin = async (req, res, next) => {
    const u = req.get('x-test-user');
    if (!u) return res.status(302).end();
    req.user = { username: u, role: 'user' };
    res.locals.user = req.user;
    await getDatabase(u).ensureSeeded();
    next();
  };
  require('../api/exercise-fix')(app, { requireLogin, getDatabase });
  require('../api/volume')(app, { requireLogin, getDatabase });
  await new Promise(r => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (server) server.close();
  try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${U}_health.sqlite`)); } catch { /* none */ }
});

const H = { 'x-test-user': U };
const J = { ...H, 'content-type': 'application/json' };

async function logSets(sets, date = '2026-11-16') {
  await getDatabase(U).ensureSeeded();
  const db = getDatabase(U);
  const s = await db.WorkoutSession.create({ date, type: 'strength', status: 'finished' });
  let n = 1;
  for (const x of sets) await db.WorkoutSet.create({ sessionId: s.id, exerciseOrder: 1, setNumber: n++, ...x });
}

test('the page and the rows: issues and suggestions, nothing written by a GET', { skip }, async () => {
  await logSets([
    { exerciseName: 'Side Planks', duration: 30, notes: 'each side' },          // plural of a catalogue name
    { exerciseName: 'Paused Dumbbell Bench Press', reps: 8, weight: 50 },       // not in the library
    { exerciseName: 'Paused Dumbbell Bench Press', reps: 8, weight: 50 },
    { exerciseName: 'Mystery Move', reps: 10 },
    { exerciseName: 'DB Curls', reps: 10, weight: 30 },
    { exerciseName: 'BB Rows', reps: 8, weight: 135 },
  ]);
  const page = await fetch(base + '/logs/exercises/fix', { headers: H });
  assert.strictEqual(page.status, 200);
  assert.match(await page.text(), /Fix exercises/);
  const r = await (await fetch(base + '/logs/api/exercises/fix', { headers: H })).json();
  assert.ok(r.ok);
  const by = n => r.rows.find(x => x.name === n);
  const sp = by('Side Planks');
  assert.ok(sp.def && sp.def.name === 'Side Plank', 'plural resolves to the catalogue row');
  assert.ok(!sp.issues.includes('no-muscles'));
  assert.strictEqual(sp.suggest.sides.sides, 'unilateral');
  const pb = by('Paused Dumbbell Bench Press');
  assert.ok(pb.issues.includes('not-in-library') && pb.issues.includes('no-muscles'));
  assert.ok(pb.suggest.muscles, 'a close name with muscles is suggested');
  assert.ok(pb.suggest.muscles.primary.includes('chest'));
  const mm = by('Mystery Move');
  assert.strictEqual(mm.suggest.muscles, null, 'nothing resembles it: no guess');
  assert.strictEqual(by('DB Curls').suggest.muscles.from, 'Dumbbell Bicep Curl', 'DB is read as dumbbell, so the equipment matches');
  assert.strictEqual(by('BB Rows').suggest.muscles, null, 'bent-over and upright row fit equally and differ: asked, not guessed');
  assert.ok(r.rows.some(x => !x.logged), 'library rows are included for the figures view');
});

test('bulk save: preview writes nothing; confirm writes; the Body Map then counts it', { skip }, async () => {
  const db = getDatabase(U);
  const volume = async () => (await (await fetch(base + '/volume/api/windows?from=2026-11-16&to=2026-11-22&length=7&step=7', { headers: H })).json());
  let v = await volume();
  const unmappedBefore = v.skipped.exercises.map(e => e.name);
  assert.ok(unmappedBefore.includes('Paused Dumbbell Bench Press'));
  assert.ok(!unmappedBefore.includes('Side Planks'), 'the plural now matches its catalogue row');

  const changes = [
    { name: 'Paused Dumbbell Bench Press', primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'front_delts'], sides: 'bilateral' },
    { name: 'Side Planks', sides: 'unilateral', poseKey: '' },
  ];
  const prev = await (await fetch(base + '/logs/api/exercises/fix', { method: 'POST', headers: J, body: JSON.stringify({ changes }) })).json();
  assert.ok(prev.ok && prev.preview);
  assert.strictEqual(prev.changes.find(c => c.name === 'Paused Dumbbell Bench Press').action, 'create');
  assert.strictEqual(prev.changes.find(c => c.name === 'Side Plank').catalogue, true);
  assert.strictEqual(await db.ExerciseDefinition.count({ where: { name: 'Paused Dumbbell Bench Press' } }), 0, 'a preview writes nothing');

  const done = await (await fetch(base + '/logs/api/exercises/fix', { method: 'POST', headers: J, body: JSON.stringify({ changes, confirm: true }) })).json();
  assert.ok(done.ok); assert.strictEqual(done.saved, 2);
  const made = await db.ExerciseDefinition.findOne({ where: { name: 'Paused Dumbbell Bench Press' } });
  assert.ok(made.isCustom); assert.strictEqual(made.sides, 'bilateral');
  assert.strictEqual((await db.ExerciseDefinition.findOne({ where: { name: 'Side Plank' } })).sides, 'unilateral');

  v = await volume();
  assert.ok(!v.skipped.exercises.map(e => e.name).includes('Paused Dumbbell Bench Press'), 'now on the map');
  const chest = v.windows[0].muscles.chest || v.windows[0].muscles.find?.(m => m.muscle === 'chest');
  assert.ok(chest, 'chest has volume this week');
});

test('bad input is refused: unknown muscle, unknown figure, cross-origin, not JSON', { skip }, async () => {
  const post = (body, headers = J) => fetch(base + '/logs/api/exercises/fix', { method: 'POST', headers, body: JSON.stringify(body) });
  let r = await post({ changes: [{ name: 'Mystery Move', primaryMuscles: ['spleen'] }] });
  assert.strictEqual(r.status, 400); assert.match((await r.json()).error, /does not know spleen/);
  r = await post({ changes: [{ name: 'Mystery Move', poseKey: 'not-a-pose' }] });
  assert.strictEqual(r.status, 400);
  r = await post({ changes: [{ name: 'Mystery Move', sides: 'both' }] });
  assert.strictEqual(r.status, 400);
  r = await post({ changes: [{ name: 'Mystery Move', sides: 'unilateral' }] }, { ...J, origin: 'https://evil.example' });
  assert.strictEqual(r.status, 403);
  r = await fetch(base + '/logs/api/exercises/fix', { method: 'POST', headers: H, body: 'changes=1' });
  assert.strictEqual(r.status, 415);
});
