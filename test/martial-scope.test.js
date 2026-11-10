'use strict';
// Scope line for martial content (lib/martial-scope.js) and the additive migration of the renamed seed.
// Run: node --test test/martial-scope.test.js
require('./helpers/data-dir');
const { test } = require('node:test');
const assert = require('node:assert');
const scope = require('../lib/martial-scope');
const L = require('../api/sessions-library');
const db0 = require('../database');
const mma = require('../lib/mma-moves.json');
const { BANNED } = require('./helpers/banned');

let getDatabase;
try { require('sequelize'); require('sqlite3'); getDatabase = db0; } catch { /* skip DB tests */ }
const skip = !getDatabase && 'sequelize/sqlite3 not installed on this machine';
const byName = new Map(db0.SEED_EXERCISES.map(e => [e.name, e]));

test('every partner submission is a loggable martial technique with no dose and no finishing cue', () => {
  assert.strictEqual(scope.PARTNER_SUBMISSIONS.length, 13);
  for (const n of scope.PARTNER_SUBMISSIONS) {
    const e = byName.get(n);
    assert.ok(e, `${n} is in the seed library (still loggable)`);
    assert.ok(e.instructions.startsWith(scope.TECHNIQUE_NOTE), `${n} opens with the trained-partner note`);
    assert.strictEqual(e.defaultSets, null, n); assert.strictEqual(e.defaultReps, null, n); assert.strictEqual(e.defaultDuration, null, n);
    assert.match(e.instructions, /tap/i, `${n} says to tap early`);
    assert.match(e.instructions, /let go/i, `${n} says to let go on the tap`);
    assert.doesNotMatch(e.instructions, /\b(finish|crank|snap|rip|pop)\b|squeeze|break (their|the)|windshield|extend (the|their)|pull (it )?(toward|upward)/i, `${n} has no finishing cue`);
    assert.doesNotMatch(e.instructions, BANNED, n);
  }
});

test('no seeded template or plan contains a partner submission', () => {
  const names = [];
  for (const t of db0.SEED_WORKOUT_TEMPLATES) for (const x of t.exercises) names.push(x.exerciseName);
  for (const p of db0.SEED_EXERCISE_PLANS) for (const x of p.items) names.push(x.name);
  for (const n of names) assert.ok(!scope.isPartnerSubmission(n), `${n} is a partner submission in a template or plan`);
});

test('the session builder library and its suggestions never offer a submission', () => {
  const rows = db0.SEED_EXERCISES.map((e, i) => ({ id: i + 1, ...e }));
  const lib = [...L.fromExercises(rows), ...L.fromMma()];
  const offered = new Set(lib.map(i => i.name));
  for (const n of scope.PARTNER_SUBMISSIONS) assert.ok(!offered.has(n), n);
  assert.ok(mma.moves.some(scope.isSubmissionMove), 'the snapshot does carry submissions (so this is a real filter)');
  for (const m of mma.moves.filter(scope.isSubmissionMove)) assert.ok(!offered.has(m.title), m.title);
  // even if one is injected into the library, suggest() drops it
  const injected = [...lib, { ref: 'x', name: 'Heel Hook (Outside)', primary: ['core'], secondary: [], joints: [], requires: [] }];
  const s = L.suggest(injected, {});
  assert.ok(!s.suggested.some(x => x.name === 'Heel Hook (Outside)'));
  assert.ok(s.suggested.length > 0);
});

test('lymph routine copy is general: no personal context, disclaimer and sources present', () => {
  const mob = require('../api/mobility');
  const r = mob.ROUTINES.find(x => x.id === 'lymph-head-neck');
  assert.match(r.notes, /nhs\.uk\/conditions\/lymphoedema\/treatment/);
  assert.match(r.notes, /medlineplus\.gov\/lymphaticdiseases/);
  const cues = db0.SEED_EXERCISES.filter(e => /^Lymph Drainage:/.test(e.name)).map(e => e.instructions).join(' ') + r.items.map(i => i.cue).join(' ');
  assert.doesNotMatch(cues, /\bENT\b|left side|fluid|toward the collarbone|clear/i);
});

async function account(name) { const d = getDatabase(name); await d.sequelize.sync(); return d; }
const OLD = 'Lumbar Decompression Hang', NEW = 'Relaxed Dead Hang';
const oldRow = (d) => d.ExerciseDefinition.findOne({ where: { name: NEW } });

test('a renamed seed: unused old row is renamed in place (same id), rerun is a no-op', { skip }, async () => {
  const d = await account('rename_unused');
  await d.seedData();
  const row = await d.ExerciseDefinition.findOne({ where: { name: NEW } });
  await row.update({ name: OLD, instructions: 'old' });                       // an account seeded by the old release
  await d.UserSetting.destroy({ where: { key: 'exerciseSeedContent' } });
  const before = await d.ExerciseDefinition.count();
  await d.seedData();
  const after = await d.ExerciseDefinition.findByPk(row.id);
  assert.strictEqual(after.name, NEW); assert.strictEqual(after.id, row.id);
  assert.strictEqual(after.instructions, byName.get(NEW).instructions);
  assert.strictEqual(await d.ExerciseDefinition.count(), before);
  await d.seedData();
  assert.strictEqual(await d.ExerciseDefinition.count(), before);
});

test('a renamed seed: if logs refer to the old name the row keeps it, nothing is added, history is intact', { skip }, async () => {
  const d = await account('rename_used');
  await d.seedData();
  const row = await d.ExerciseDefinition.findOne({ where: { name: NEW } });
  await row.update({ name: OLD, instructions: 'old' });
  const s = await d.WorkoutSession.create({ date: '2026-11-01', type: 'recovery', status: 'finished' });
  await d.WorkoutSet.create({ sessionId: s.id, exerciseId: row.id, exerciseName: OLD, duration: 30 });
  await d.UserSetting.destroy({ where: { key: 'exerciseSeedContent' } });
  const before = await d.ExerciseDefinition.count();
  await d.seedData();
  const after = await d.ExerciseDefinition.findByPk(row.id);
  assert.strictEqual(after.name, OLD, 'name kept: the log joins on it');
  assert.strictEqual(after.instructions, byName.get(NEW).instructions, 'but it still gets the corrected cue');
  assert.strictEqual(await d.ExerciseDefinition.count(), before, 'no second row');
  assert.strictEqual(await d.ExerciseDefinition.count({ where: { name: NEW } }), 0);
  const set = await d.WorkoutSet.findOne();
  assert.strictEqual(set.exerciseName, OLD); assert.strictEqual(set.exerciseId, row.id);
});

test('refreshing the submissions\' cues reaches an existing account and touches no logged set', { skip }, async () => {
  const d = await account('submissions');
  await d.seedData();
  const row = await d.ExerciseDefinition.findOne({ where: { name: 'Heel Hook (Outside)' } });
  const s = await d.WorkoutSession.create({ date: '2026-11-01', type: 'bjj', status: 'finished' });
  const set = await d.WorkoutSet.create({ sessionId: s.id, exerciseId: row.id, exerciseName: row.name, reps: 3 });
  await row.update({ instructions: 'Windshield wiper hips to finish.' });
  await d.UserSetting.destroy({ where: { key: 'exerciseSeedContent' } });
  await d.seedData();
  assert.ok((await d.ExerciseDefinition.findByPk(row.id)).instructions.startsWith(scope.TECHNIQUE_NOTE));
  const after = await d.WorkoutSet.findByPk(set.id);
  assert.strictEqual(after.reps, 3); assert.strictEqual(after.exerciseId, row.id);
});
