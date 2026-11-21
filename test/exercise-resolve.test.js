'use strict';
/**
 * One resolver for "which exercise does this logged name mean" (lib/exercise-resolve.js), pinned against the
 * REAL seed catalogue and the 18 names from the owner's Body Map "Not in your library" list (2026-11-21).
 * Run: node --test test/exercise-resolve.test.js
 */
require('./helpers/data-dir');
const { test } = require('node:test');
const assert = require('node:assert');

let SEED; try { SEED = require('../database').SEED_EXERCISES; } catch { /* sequelize missing */ }
const skip = !SEED && 'sequelize/sqlite3 not installed on this machine';
const { makeResolver } = require('../lib/exercise-resolve');
const { parseWorkout } = require('../api/workout-parse');

const defs = () => (SEED || []).map((e, i) => ({ id: i + 1, ...e, primaryMuscles: JSON.stringify(e.primaryMuscles), secondaryMuscles: JSON.stringify(e.secondaryMuscles) }));
const resolve = (name, opts) => { const r = makeResolver(defs(), opts)(name); return r ? r.name : null; };

const EXPECTED = {
  'Bench Press': 'Barbell Bench Press',
  'Bicep Curls': 'Dumbbell Bicep Curl',
  'Lat pull down bar to thighs': null,           // owner is sending a picture first: stays unassigned
  'Iso Leg Press': 'Iso Leg Press',
  'Iso Shoulder Press': 'Iso Shoulder Press',
  'Single Leg Curl': 'Single-Leg Curl (Machine)',
  'Wide Chest Press Machine': 'Chest Press Machine',
  'Back Extensions': 'Back Extension (Bench)',
  'Barbell Clean': 'Barbell Clean',
  'Cable Crunches': 'Cable Crunch',
  'Chest Fly Sitting Backwards': 'Reverse Pec Deck',
  'Chest Fly Sitting Forward': 'Pec Deck',
  'Dumbbell Incline Chest Press': 'Incline Dumbbell Press',
  'Hack Squat': 'Hack Squat (Machine)',
  'Iso Chest Press': 'Iso Chest Press',
  'Iso Row': 'Iso Row',
  'Row': null,                                    // owner's call (Seated Cable Row) is made in the UI, never globally
  'Single Arm Tricep Extensions': 'Single-Arm Cable Tricep Extension',
};
for (const [asked, want] of Object.entries(EXPECTED)) {
  test(`"${asked}" -> ${want || 'unresolved'}`, { skip }, () => assert.strictEqual(resolve(asked), want));
}

test('every new seed row carries muscles that are drawn on the body map', { skip }, () => {
  const M = require('../lib/muscles');
  for (const n of ['Iso Leg Press', 'Iso Shoulder Press', 'Iso Chest Press', 'Iso Row', 'Hack Squat (Machine)', 'Single-Leg Curl (Machine)', 'Barbell Clean', 'Single-Arm Cable Tricep Extension', 'Reverse Pec Deck']) {
    const d = defs().find(x => x.name === n);
    assert.ok(d, n);
    const got = M.normalize(d.primaryMuscles).muscles;
    assert.ok(got.length, n);
    for (const m of got) assert.ok(M.MUSCLES[m] && M.MUSCLES[m].drawn !== false, `${n}: ${m} is not drawn`);
  }
});

test('guard: Iso Leg Press never resolves to Leg Press, even when the iso row is absent', { skip }, () => {
  const without = defs().filter(d => d.name !== 'Iso Leg Press');
  const r = makeResolver(without)('Iso Leg Press');
  assert.ok(!r || !/^Leg Press/.test(r.name), r && r.name);
});

test('guard: Single Leg Curl never resolves to a bilateral curl', { skip }, () => {
  const without = defs().filter(d => d.name !== 'Single-Leg Curl (Machine)');
  const r = makeResolver(without)('Single Leg Curl');
  assert.strictEqual(r, null);
});

test('guard: two candidates with different muscles stay unresolved ("BB Rows")', { skip }, () => {
  assert.strictEqual(resolve('BB Rows'), null);
  assert.strictEqual(resolve('Curl'), null);
});

test('guard: a remembered ExerciseAlias that crosses a variant is ignored', { skip }, () => {
  assert.strictEqual(resolve('Iso Press Thing', { aliases: new Map([['iso press thing', 'Leg Press']]) }), null);
});

test('a remembered ExerciseAlias resolves, ahead of the static table', { skip }, () => {
  assert.strictEqual(resolve('Row', { aliases: new Map([['row', 'Seated Cable Row']]) }), 'Seated Cable Row');
});

test('an own row with no muscles falls through to the alias', { skip }, () => {
  const d = defs(); d.push({ id: 9999, name: 'Bench Press', category: 'strength', primaryMuscles: '[]', secondaryMuscles: '[]' });
  assert.strictEqual(makeResolver(d)('Bench Press').name, 'Barbell Bench Press');
});

test('quick-log still reads bar + N as plates plus the bar: 135, 135, 155', () => {
  const r = parseWorkout('Bench press 45lb bar:\nBar + 90lb x 10\nBar + 90lb x 10\nBar + 110lb x 8');
  assert.deepStrictEqual(r.exercises[0].sets.map(s => s.weight), [135, 135, 155]);
});
