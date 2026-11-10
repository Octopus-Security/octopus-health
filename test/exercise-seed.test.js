'use strict';

/**
 * The exercise seed: content that is correct, links that are not dead, and a refresh that
 * reaches existing accounts without touching anything the user owns.
 *
 * The video ids that remain were checked against YouTube's public oEmbed endpoint on
 * 2026-11-04 (19 of 218 unique ids were live; the other 199 returned 404 and were removed).
 *
 * Run: node --test test/exercise-seed.test.js
 */

require('./helpers/data-dir');
const { test } = require('node:test');
const assert = require('node:assert');

let getDatabase;
try { require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skip DB tests */ }
const skip = !getDatabase && 'sequelize/sqlite3 not installed on this machine';
const { SEED_EXERCISES, SEED_CONTENT_VERSION } = require('../database');
const { RECOVERY_NOTE } = require('../lib/recovery-note');

const stamp = `zz_seed_${process.pid}`;
const KEY = 'exerciseSeedContent';

test('seed exercise names are unique (a duplicate used to insert two rows on a fresh account)', () => {
  const seen = new Set(), dup = [];
  for (const e of SEED_EXERCISES) { if (seen.has(e.name)) dup.push(e.name); seen.add(e.name); }
  assert.deepStrictEqual(dup, []);
});

test('no seed points at the dead media host, and no seed carries a dead-host URL', () => {
  const bad = SEED_EXERCISES.filter(e => /website-cdn\.com/.test(`${e.mediaUrl || ''} ${e.videoUrl || ''}`));
  assert.deepStrictEqual(bad.map(e => e.name), []);
});

// Ids deliberately shared by close variations of one movement (reviewed 2026-11-04).
const SHARED_OK = new Map([
  ['IODxDxX7oi4', ['Push-up', 'Wide Push-up', 'Push-up Board Wide']],
  ['FJmRQ5iTXKE', ['Jump Rope', 'Weighted Jump Rope']],
  ['gwLzBJYoWlI', ['Calf Raise (bodyweight)', 'Calf Raise (machine)']],
]);

test('a video id is not reused across different exercises unless allow-listed', () => {
  const by = new Map();
  for (const e of SEED_EXERCISES) {
    const m = e.videoUrl && e.videoUrl.match(/[?&]v=([\w-]{11})/);
    if (e.videoUrl && !m) assert.fail(`${e.name}: unrecognised video URL ${e.videoUrl}`);
    if (!m) continue;
    if (!by.has(m[1])) by.set(m[1], []);
    by.get(m[1]).push(e.name);
  }
  for (const [id, names] of by) {
    if (names.length < 2) continue;
    const ok = SHARED_OK.get(id);
    assert.ok(ok, `${id} is on ${names.join(' / ')}`);
    assert.deepStrictEqual([...names].sort(), [...ok].sort());
  }
});

test('copy no longer makes treatment or structural claims', () => {
  const text = SEED_EXERCISES.map(e => e.instructions).join('\n')   // names stay: they key logs and PRs;
  for (const re of [/treats and prevents/i, /corrects forward head/i, /lubricat/i, /decompress/i, /lengthen/i]) {
    assert.ok(!re.test(text), `still matches ${re}`);
  }
});

test('risky entries carry a caution', () => {
  const by = new Map(SEED_EXERCISES.map(e => [e.name, e.instructions]));
  const need = ['Cervical Spine CARS', 'Neck Isometric Holds', "Wrestler's Bridge", 'Neck Bridge', 'Jefferson Curl',
    'Shoulder Dislocates', 'Sleeper Stretch', 'Scorpion Stretch', 'Relaxed Dead Hang', 'Pigeon Stretch', 'Deep Squat Hold'];
  for (const n of need) assert.ok(/stop|never force|back off|skip|ease off|pinch|come up|step down/i.test(by.get(n) || ''), `${n} has no caution`);
});

test('the standing recovery line is plain and short', () => {
  assert.ok(RECOVERY_NOTE.length < 160);
  assert.match(RECOVERY_NOTE, /not medical advice/i);
  assert.match(RECOVERY_NOTE, /sharp pain/i);
  assert.match(RECOVERY_NOTE, /professional/i);
  assert.ok(require('../api/mobility').NOTE.includes(RECOVERY_NOTE));
});

async function account(tag) {
  const db = getDatabase(`${stamp}_${tag}`);
  await db.sequelize.sync(); await db.migrate();
  return db;
}
const names = new Set(SEED_EXERCISES.map(e => e.name));

test('fresh account: one row per seed name, marker set', { skip }, async () => {
  const db = await account('fresh');
  await db.seedData();
  const rows = await db.ExerciseDefinition.findAll();
  assert.strictEqual(rows.length, SEED_EXERCISES.length);
  assert.strictEqual((await db.UserSetting.findByPk(KEY)).value, SEED_CONTENT_VERSION);
});

test('refresh updates stale non-custom rows, once, and a rerun is a no-op', { skip }, async () => {
  const db = await account('stale');
  await db.seedData();
  const seed = SEED_EXERCISES.find(e => e.name === 'Terminal Knee Extension (TKE)');
  const row = await db.ExerciseDefinition.findOne({ where: { name: seed.name } });
  // simulate a row seeded by an older release, with the old marker
  await row.update({ instructions: 'old text treats and prevents knee pain', videoUrl: 'https://www.youtube.com/watch?v=deadbeef000' });
  await db.UserSetting.destroy({ where: { key: KEY } });
  await db.seedData();
  const fixed = await db.ExerciseDefinition.findByPk(row.id);
  assert.strictEqual(fixed.instructions, seed.instructions);
  assert.strictEqual(fixed.videoUrl, seed.videoUrl ?? null);
  // marker present: a hand-change is not revisited (cheap path), proving the pass is skipped
  await fixed.update({ instructions: 'sentinel' });
  await db.seedData();
  assert.strictEqual((await db.ExerciseDefinition.findByPk(row.id)).instructions, 'sentinel');
  assert.strictEqual(await db.ExerciseDefinition.count(), SEED_EXERCISES.length);
});

test('refresh never touches a custom row, even one with a seed name, or any user data', { skip }, async () => {
  const db = await account('custom');
  await db.seedData();
  const seedRow = await db.ExerciseDefinition.findOne({ where: { name: 'Chin Tuck' } });
  const mine = await db.ExerciseDefinition.create({ name: 'Chin Tuck', category: 'recovery', equipment: 'none',
    primaryMuscles: '[]', secondaryMuscles: '[]', instructions: 'my own cue', videoUrl: 'https://example.com/mine', isCustom: true });
  const other = await db.ExerciseDefinition.create({ name: 'My Own Move', category: 'strength', equipment: 'none',
    primaryMuscles: '[]', secondaryMuscles: '[]', instructions: 'keep me', videoUrl: null, isCustom: true });
  const session = await db.WorkoutSession.create({ date: '2026-11-01', type: 'strength', status: 'finished' });
  const set = await db.WorkoutSet.create({ sessionId: session.id, exerciseId: seedRow.id, exerciseName: 'Chin Tuck', reps: 10, weight: 0 });
  const snap = async () => JSON.stringify([
    (await db.WorkoutSet.findAll({ raw: true })), (await db.WorkoutSession.findAll({ raw: true })),
    (await db.PersonalRecord.findAll({ raw: true })), (await db.WorkoutTemplate.findAll({ raw: true })),
    (await db.ExercisePlan.findAll({ raw: true })), (await db.TrainingPlan.findAll({ raw: true })),
    (await db.ExerciseDefinition.findAll({ where: { isCustom: true }, raw: true })),
  ]);
  const before = await snap();
  const count = await db.ExerciseDefinition.count();
  await seedRow.update({ instructions: 'stale' });
  await db.UserSetting.destroy({ where: { key: KEY } });
  await db.seedData();
  assert.strictEqual(await snap(), before);
  assert.strictEqual(await db.ExerciseDefinition.count(), count);
  assert.strictEqual((await db.ExerciseDefinition.findByPk(mine.id)).instructions, 'my own cue');
  assert.strictEqual((await db.ExerciseDefinition.findByPk(other.id)).instructions, 'keep me');
  assert.strictEqual((await db.WorkoutSet.findByPk(set.id)).exerciseId, seedRow.id);
  assert.strictEqual((await db.ExerciseDefinition.findByPk(seedRow.id)).instructions,
    SEED_EXERCISES.find(e => e.name === 'Chin Tuck').instructions);
});

test('a duplicate row already in an account is updated, not deleted', { skip }, async () => {
  const db = await account('dup');
  await db.seedData();
  const a = await db.ExerciseDefinition.findOne({ where: { name: 'Incline Dumbbell Press' } });
  const b = await db.ExerciseDefinition.create({ name: 'Incline Dumbbell Press', category: 'strength', equipment: 'dumbbell',
    primaryMuscles: '[]', secondaryMuscles: '[]', instructions: 'old dup', videoUrl: null, isCustom: false });
  await db.UserSetting.destroy({ where: { key: KEY } });
  await db.seedData();
  assert.strictEqual(await db.ExerciseDefinition.count({ where: { name: 'Incline Dumbbell Press' } }), 2);
  const want = SEED_EXERCISES.find(e => e.name === 'Incline Dumbbell Press').instructions;
  assert.strictEqual((await db.ExerciseDefinition.findByPk(a.id)).instructions, want);
  assert.strictEqual((await db.ExerciseDefinition.findByPk(b.id)).instructions, want);
});

test('a failing refresh does not stop seeding or throw, and is retried next time', { skip }, async () => {
  const db = await account('fail');
  await db.seedData();
  const orig = db.UserSetting.upsert;
  const log = console.error; let logged = '';
  console.error = (...a) => { logged += a.join(' '); };
  await db.UserSetting.destroy({ where: { key: KEY } });
  db.UserSetting.upsert = async () => { throw new Error('boom'); };
  try { await db.seedData(); } finally { db.UserSetting.upsert = orig; console.error = log; }
  assert.match(logged, /seed content refresh failed/);
  assert.strictEqual(await db.UserSetting.findByPk(KEY), null, 'marker must stay unset so the next login retries');
  await db.seedData();
  assert.strictEqual((await db.UserSetting.findByPk(KEY)).value, SEED_CONTENT_VERSION);
});
