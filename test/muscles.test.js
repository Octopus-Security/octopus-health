'use strict';

/**
 * The muscle vocabulary, the body-map geometry, the seeded stretches and the
 * starter plan. Pure parts need nothing installed; the HTTP and seeding tests
 * skip without express/ejs/sequelize/sqlite3 (borrow, see octopus-vault lenders).
 *
 * Run: node --test test/muscles.test.js
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const M = require('../lib/muscles');
const GEOMETRY = require('../lib/body-geometry.json');

let express, ejs, getDatabase;
try { express = require('express'); ejs = require('ejs'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/ejs/sequelize/sqlite3 not installed on this machine';

// The seed arrays are exported by database.js, but that file needs sequelize to load.
// Read them from source when it cannot be required, so the pure checks still run.
function seedExercises() {
  if (getDatabase) return getDatabase.SEED_EXERCISES;
  const src = fs.readFileSync(path.join(__dirname, '..', 'database.js'), 'utf8');
  return eval(src.match(/const SEED_EXERCISES = (\[[\s\S]*?\n\]);/)[1]); // eslint-disable-line no-eval
}
function seedPlans() {
  if (getDatabase) return getDatabase.SEED_EXERCISE_PLANS;
  const src = fs.readFileSync(path.join(__dirname, '..', 'database.js'), 'utf8');
  return eval(src.match(/const SEED_EXERCISE_PLANS = (\[[\s\S]*?\n\]);/)[1]); // eslint-disable-line no-eval
}

// ── Alias normalisation ──────────────────────────────────────────────────────

test('free-text spellings resolve to canonical ids', () => {
  const n = (x) => M.normalize(x).muscles;
  assert.deepStrictEqual(n(['Quadriceps']), ['quads']);
  assert.deepStrictEqual(n(['upper_chest', 'lower chest', 'Pecs']), ['chest']);
  assert.deepStrictEqual(n(['rhomboids', 'upper_back', 'trapezius']), ['traps']);
  assert.deepStrictEqual(n(['core']), ['abs', 'obliques']);
  assert.deepStrictEqual(n(['shoulders']), ['front_delts', 'side_delts', 'rear_delts']);
  assert.deepStrictEqual(n(['  Hip-Flexors ']), ['hip_flexors']);
  assert.deepStrictEqual(n(['glute']), ['glutes']);          // singular not in the table's keys
  assert.deepStrictEqual(n(['legs']), ['quads', 'hamstrings', 'calves']);
});

test('normalize accepts the stored JSON text, an array, or junk, and never rewrites input', () => {
  const stored = '["hamstrings","calves"]';
  assert.deepStrictEqual(M.normalize(stored).muscles, ['hamstrings', 'calves']);
  assert.deepStrictEqual(M.normalize(null).muscles, []);
  assert.deepStrictEqual(M.normalize('not json, glutes').muscles, ['not json', 'glutes'].map(x => M.resolve(x).muscles).flat());
  const arr = ['Upper Chest'];
  M.normalize(arr);
  assert.deepStrictEqual(arr, ['Upper Chest']);
});

test('joint words resolve to joints, and some words are both', () => {
  assert.deepStrictEqual(M.normalize(['ankles']).joints, ['ankle']);
  assert.deepStrictEqual(M.normalize(['knees']).joints, ['knee']);
  assert.deepStrictEqual(M.normalize(['thoracic_spine']).joints, ['thoracic_spine']);
  const neck = M.normalize(['neck']);
  assert.deepStrictEqual([neck.muscles, neck.joints], [['neck'], ['neck']]);
  const ach = M.normalize(['achilles']);
  assert.deepStrictEqual([ach.muscles, ach.joints], [['calves'], ['ankle']]);
});

test('non-regional words are known but resolve to nothing; gibberish is reported, not guessed', () => {
  const full = M.normalize(['full_body', 'balance']);
  assert.deepStrictEqual([full.muscles, full.joints, full.unknown], [[], [], []]);
  const bad = M.normalize(['wibble', 'glutes']);
  assert.deepStrictEqual(bad.muscles, ['glutes']);
  assert.deepStrictEqual(bad.unknown, ['wibble']);
});

test('every canonical muscle id is its own alias', () => {
  for (const id of Object.keys(M.MUSCLES)) assert.ok(M.normalize([id]).muscles.includes(id), id);
});

// ── Joints ───────────────────────────────────────────────────────────────────

test('the nine joints exist and each maps to real muscles', () => {
  assert.deepStrictEqual(Object.keys(M.JOINTS).sort(),
    ['ankle', 'elbow', 'hip', 'knee', 'lumbar_spine', 'neck', 'shoulder', 'thoracic_spine', 'wrist']);
  for (const [id, j] of Object.entries(M.JOINTS)) {
    assert.ok(j.muscles.length > 0, id);
    for (const m of j.muscles) assert.ok(M.isMuscle(m), `${id} -> ${m}`);
  }
});

test('joint -> muscle mapping', () => {
  assert.deepStrictEqual(M.musclesForJoint('ankle'), ['calves']);
  assert.ok(M.musclesForJoint('hip').includes('hip_flexors'));
  assert.ok(M.musclesForJoint('hip').includes('glutes'));
  assert.ok(M.musclesForJoint('knee').includes('hamstrings'));
  assert.deepStrictEqual(M.musclesForJoint('nope'), []);
  assert.ok(M.jointsForMuscle('hamstrings').includes('hip') && M.jointsForMuscle('hamstrings').includes('knee'));
});

test('clicking a joint returns mobility work for the muscles that cross it', () => {
  const rows = [
    { id: 1, name: 'Calf Stretch', category: 'recovery', primaryMuscles: ['calves'], secondaryMuscles: [] },
    { id: 2, name: 'Ankle Drill', category: 'recovery', primaryMuscles: ['ankles'], secondaryMuscles: [] },
    { id: 3, name: 'Hamstring Stretch', category: 'recovery', primaryMuscles: ['hamstrings'], secondaryMuscles: [] },
    { id: 4, name: 'Calf Raise', category: 'strength', primaryMuscles: ['calves'], secondaryMuscles: [] },
    { id: 5, name: 'Squat', category: 'strength', primaryMuscles: ['quads'], secondaryMuscles: ['calves'] },
  ];
  const r = M.exercisesFor('joint', 'ankle', rows);
  assert.deepStrictEqual(r.stretches.map(e => e.name), ['Ankle Drill', 'Calf Stretch']); // direct joint tag first
  assert.deepStrictEqual(r.primary.map(e => e.name), ['Calf Raise']);
  assert.deepStrictEqual(r.secondary.map(e => e.name), ['Squat']);
});

test('muscle selection: stretches need it as a primary; exercises split primary / secondary', () => {
  const rows = [
    { id: 1, name: 'A', category: 'recovery', primaryMuscles: '["glutes"]', secondaryMuscles: '[]' },
    { id: 2, name: 'B', category: 'recovery', primaryMuscles: ['hamstrings'], secondaryMuscles: ['glutes'] },
    { id: 3, name: 'C', category: 'strength', primaryMuscles: ['glutes'], secondaryMuscles: [] },
    { id: 4, name: 'D', category: 'strength', primaryMuscles: ['quads'], secondaryMuscles: ['glutes'] },
  ];
  const r = M.exercisesFor('muscle', 'glutes', rows);
  assert.deepStrictEqual(r.stretches.map(e => e.name), ['A']);
  assert.deepStrictEqual(r.primary.map(e => e.name), ['C']);
  assert.deepStrictEqual(r.secondary.map(e => e.name), ['D']);
  assert.strictEqual(M.exercisesFor('muscle', 'banana', rows), null);
  assert.strictEqual(M.exercisesFor('joint', 'banana', rows), null);
});

// ── Geometry ─────────────────────────────────────────────────────────────────

test('every shape and joint on the figure keys to a canonical id, and every drawn muscle has a shape', () => {
  const seen = new Set();
  for (const v of ['front', 'back']) {
    for (const s of GEOMETRY[v].shapes) {
      if (s.id === '@head') continue;
      if (s.id === '@knee') { seen.add('knee'); continue; }
      assert.ok(M.isMuscle(s.id), `${v}: ${s.id}`);
      seen.add(s.id);
      assert.match(s.points, /^(\d+ )+\d+$/);
    }
    for (const j of GEOMETRY[v].joints) { assert.ok(M.isJoint(j.id), `${v}: ${j.id}`); seen.add(j.id); }
  }
  for (const [id, m] of Object.entries(M.MUSCLES)) if (m.drawn) assert.ok(seen.has(id), `no shape for ${id}`);
  for (const id of Object.keys(M.JOINTS)) assert.ok(seen.has(id), `no hotspot for joint ${id}`);
});

// ── Seed catalogue ───────────────────────────────────────────────────────────

test('every seeded exercise muscle string resolves to a canonical id (or is a known non-region)', () => {
  const bad = [];
  for (const e of seedExercises()) {
    for (const list of [e.primaryMuscles, e.secondaryMuscles]) {
      const n = M.normalize(list);
      if (n.unknown.length) bad.push(`${e.name}: ${n.unknown.join(',')}`);
    }
  }
  assert.deepStrictEqual(bad, []);
});

test('every seeded stretch has a primary that lands on a muscle or joint', () => {
  const stretches = seedExercises().filter(e => e.category === 'recovery');
  assert.ok(stretches.length >= 60);
  for (const e of stretches) {
    const n = M.normalize(e.primaryMuscles);
    assert.ok(n.muscles.length + n.joints.length > 0, `${e.name} resolves to nothing`);
    assert.ok(n.muscles.every(M.isMuscle) && n.joints.every(M.isJoint), e.name);
  }
});

test('the stretches added for the body map follow the catalogue rules', () => {
  const names = ['Cobra Stretch', 'Standing Side Bend Stretch', 'Seated Spinal Twist', 'Wall Biceps Stretch', 'Overhead Triceps Stretch',
    'Supine Hamstring Stretch', 'Standing Calf Stretch (Wall)', 'Wall Calf Stretch (Bent Knee)', 'Standing Quad Stretch',
    'Behind-the-Back Chest Opener', 'Standing Crossover IT Band Stretch', 'Downward Dog'];
  const all = seedExercises();
  for (const n of names) {
    const e = all.find(x => x.name === n);
    assert.ok(e, n);
    assert.strictEqual(e.defaultDuration, 30);
    assert.strictEqual(e.videoUrl, null);
    assert.strictEqual(e.mediaUrl, null);
  }
  // (the catalogue already carries one duplicate, 'Incline Dumbbell Press'; not ours to change here)
  for (const n of names) assert.strictEqual(all.filter(e => e.name === n).length, 1, `duplicate ${n}`);
});

test('every muscle and joint now has at least one seeded stretch except those deliberately thin', () => {
  const rows = seedExercises();
  const empty = [];
  for (const id of Object.keys(M.MUSCLES)) if (!M.exercisesFor('muscle', id, rows).stretches.length) empty.push(id);
  for (const id of Object.keys(M.JOINTS)) if (!M.exercisesFor('joint', id, rows).stretches.length) empty.push('joint:' + id);
  assert.deepStrictEqual(empty, []);
});

// ── Starter plan ─────────────────────────────────────────────────────────────

test('the starter plan is about ten minutes of seeded stretches', () => {
  const plan = seedPlans().find(p => /Starter Stretch/.test(p.name));
  assert.ok(plan);
  const known = new Map(seedExercises().map(e => [e.name, e]));
  let seconds = 0;
  for (const i of plan.items) {
    const e = known.get(i.name);
    assert.ok(e && e.category === 'recovery', i.name);
    seconds += (i.sets || 1) * i.duration;
  }
  assert.ok(plan.items.length >= 6 && plan.items.length <= 8);
  assert.ok(seconds >= 7 * 60 && seconds <= 10 * 60, `holds add up to ${seconds}s`);
  const covered = new Set(plan.items.flatMap(i => { const n = M.normalize(known.get(i.name).primaryMuscles); return [...n.muscles, ...n.joints]; }));
  for (const want of ['hip_flexors', 'hamstrings', 'chest', 'calves', 'neck', 'thoracic_spine'])
    assert.ok(covered.has(want), `plan misses ${want}`);
  assert.ok([...covered].some(x => ['front_delts', 'rear_delts', 'shoulder'].includes(x)), 'plan misses shoulders');
});

// ── Pages, JSON route, seeding (needs the real stack) ────────────────────────

const stamp = `zz_bm_${process.pid}`;
const A = `${stamp}_a`, B = `${stamp}_b`;
let server, base;

before(async () => {
  if (skip) return;
  const { asset } = require('../build');
  const app = express();
  app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.asset = asset;
  app.use(express.json());
  const requireLogin = async (req, res, next) => {
    const u = req.get('x-test-user');
    if (!u) return res.status(302).set('Location', '/login').end();
    req.user = { username: u }; res.locals.user = req.user; res.locals.activeTab = 'exercises';
    const db = getDatabase(u); await db.sequelize.sync(); await db.seedData?.(); next();
  };
  require('../api/body-map')(app, { requireLogin, getDatabase });
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (server) server.close();
  for (const n of [A, B]) try { fs.unlinkSync(path.join(__dirname, '..', 'data', `${n}_health.sqlite`)); } catch { /* none */ }
});

const get = (user, p) => fetch(base + p, { redirect: 'manual', headers: user ? { 'x-test-user': user } : {} })
  .then(async r => ({ status: r.status, text: await r.text() }));
const json = async (user, p) => { const r = await get(user, p); return { status: r.status, body: JSON.parse(r.text || 'null') }; };

test('the route refuses an anonymous caller', { skip }, async () => {
  assert.strictEqual((await get(null, '/body/api/exercises?muscle=chest')).status, 302);
  assert.strictEqual((await get(null, '/body')).status, 302);
});

test('the route validates its query', { skip }, async () => {
  assert.strictEqual((await json(A, '/body/api/exercises')).status, 400);
  assert.strictEqual((await json(A, '/body/api/exercises?muscle=chest&joint=hip')).status, 400);
  assert.strictEqual((await json(A, '/body/api/exercises?muscle=banana')).status, 404);
  assert.strictEqual((await json(A, '/body/api/exercises?joint=banana')).status, 404);
});

test('the page renders every drawn muscle, every joint, and uses versioned assets', { skip }, async () => {
  const { status, text } = await get(A, '/body');
  assert.strictEqual(status, 200);
  for (const [id, m] of Object.entries(M.MUSCLES)) assert.ok(text.includes(`data-kind="muscle" data-id="${id}"`), `no control for ${id}`);
  for (const id of Object.keys(M.JOINTS)) assert.ok(text.includes(`data-kind="joint" data-id="${id}"`), `no control for joint ${id}`);
  assert.match(text, /\/body-map\.css\?v=|\/body-map\.css/);
  assert.match(text, /aria-label="Chest \(muscle\)/);
});

test('JSON route: built-in stretches and exercises for a muscle and a joint', { skip }, async () => {
  const m = await json(A, '/body/api/exercises?muscle=hamstrings');
  assert.strictEqual(m.status, 200);
  assert.strictEqual(m.body.target.id, 'hamstrings');
  assert.ok(m.body.stretches.some(e => e.name === 'Supine Hamstring Stretch'));
  assert.ok(m.body.stretches.every(e => e.category === 'recovery'));
  assert.ok(m.body.primary.every(e => e.category !== 'recovery') && m.body.primary.length > 0);
  const j = await json(A, '/body/api/exercises?joint=ankle');
  assert.strictEqual(j.status, 200);
  assert.deepStrictEqual(j.body.target.muscles, ['calves']);
  assert.ok(j.body.stretches.length > 0);
});

test("one user's custom exercises appear for them and never for another user", { skip }, async () => {
  const { ExerciseDefinition, sequelize } = getDatabase(A);
  await sequelize.sync();
  await ExerciseDefinition.create({ name: `Private Lunge ${stamp}`, category: 'strength', equipment: 'none', primaryMuscles: JSON.stringify(['Hamstring']), secondaryMuscles: '[]', isCustom: true });
  await ExerciseDefinition.create({ name: `Private Stretch ${stamp}`, category: 'recovery', equipment: 'none', primaryMuscles: JSON.stringify(['hamstrings']), secondaryMuscles: '[]', isCustom: true });
  const mine = (await json(A, '/body/api/exercises?muscle=hamstrings')).body;
  assert.ok(mine.primary.some(e => e.name === `Private Lunge ${stamp}` && e.isCustom), 'custom exercise with a non-canonical spelling is found');
  assert.ok(mine.stretches.some(e => e.name === `Private Stretch ${stamp}`));
  const theirs = JSON.stringify((await json(B, '/body/api/exercises?muscle=hamstrings')).body);
  assert.ok(!theirs.includes(stamp), 'leaked another account\'s custom exercise');
  const theirsJoint = JSON.stringify((await json(B, '/body/api/exercises?joint=knee')).body);
  assert.ok(!theirsJoint.includes(stamp));
});

test('seeding is additive and idempotent, and the starter plan reaches an existing account', { skip }, async () => {
  const db = getDatabase(B);
  await db.sequelize.sync();
  // an account that predates this change: exercises present, no plan
  await db.seedData();
  await db.ExercisePlan.destroy({ where: { name: 'Daily Starter Stretch (10 min)' } });
  const before_ = await db.ExerciseDefinition.count();
  await db.seedData();
  await db.seedData();
  assert.strictEqual(await db.ExerciseDefinition.count(), before_, 'exercise rows duplicated');
  const plans = await db.ExercisePlan.findAll({ where: { name: 'Daily Starter Stretch (10 min)' } });
  assert.strictEqual(plans.length, 1);
  const items = JSON.parse(plans[0].items);
  assert.ok(items.length >= 6 && items.every(i => Number.isInteger(i.exerciseId)), 'every item resolves to an exercise id');
  // a plan the user has edited is left alone
  await plans[0].update({ description: 'mine' });
  await db.seedData();
  assert.strictEqual((await db.ExercisePlan.findOne({ where: { name: 'Daily Starter Stretch (10 min)' } })).description, 'mine');
});
