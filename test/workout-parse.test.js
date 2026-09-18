'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { parseWorkout, buildPreview, parseSets, matchExercise, normKey } = require('../api/workout-parse');

// Compact view: [name, [[reps, weight, weightUnit, duration, note], ...]]
const shape = r => r.exercises.map(e => [e.name, e.sets.map(s => [s.reps, s.weight, s.weightUnit, s.duration, s.note])]);

// ── The headline positive control: the EXACT message that failed through the AI
// path. If this ever regresses, the deterministic logger is broken. ───────────
test('parses the real Discord workout message end to end', () => {
  const r = parseWorkout('20 pull ups, 5 min bag work punches/kicks/elbows/knees, bicep curls 10 each side 20lbs and 10 each side 25lbs');
  assert.deepStrictEqual(shape(r), [
    ['Pull Ups',    [[20, null, null, null, null]]],
    ['Bag Work',    [[null, null, null, 300, 'punches/kicks/elbows/knees']]],
    ['Bicep Curls', [[10, 20, 'lbs', null, 'each side'], [10, 25, 'lbs', null, 'each side']]],
  ]);
  assert.deepStrictEqual(r.unparsed, []);
  // setNumbers are assigned per exercise
  assert.deepStrictEqual(r.exercises[2].sets.map(s => s.setNumber), [1, 2]);
  // 5 min really is 300 seconds, not 5 reps — the unit that broke it before
  assert.strictEqual(r.exercises[1].sets[0].duration, 300);
});

test('reps-first vs name-first both work', () => {
  assert.deepStrictEqual(shape(parseWorkout('20 pull ups')), [['Pull Ups', [[20, null, null, null, null]]]]);
  assert.deepStrictEqual(shape(parseWorkout('pull ups 20')), [['Pull Ups', [[20, null, null, null, null]]]]);
});

test('sets x reps expands to that many rows, sharing the weight', () => {
  assert.deepStrictEqual(shape(parseWorkout('bench press 3x10 135lbs')), [
    ['Bench Press', [[10, 135, 'lbs', null, null], [10, 135, 'lbs', null, null], [10, 135, 'lbs', null, null]]],
  ]);
});

test('unit-less weight after NxM is read as weight, not reps', () => {
  assert.deepStrictEqual(shape(parseWorkout('squats 5x5 225')), [
    ['Squats', Array.from({ length: 5 }, () => [5, 225, 'lbs', null, null])],
  ]);
});

test('kg is preserved as its own unit', () => {
  assert.deepStrictEqual(shape(parseWorkout('curls 10 20kg')), [['Curls', [[10, 20, 'kg', null, null]]]]);
});

test('timed set name-first: "plank 30 sec" is a 30s hold, not 30 reps', () => {
  assert.deepStrictEqual(shape(parseWorkout('plank 30 sec')), [['Plank', [[null, null, null, 30, null]]]]);
  assert.deepStrictEqual(shape(parseWorkout('2 min plank')),  [['Plank', [[null, null, null, 120, null]]]]);
});

test('"and" joins SETS of one exercise when the right side has no name', () => {
  assert.deepStrictEqual(shape(parseWorkout('curls 10 20lbs and 8 25lbs')), [
    ['Curls', [[10, 20, 'lbs', null, null], [8, 25, 'lbs', null, null]]],
  ]);
});

test('"and" joins two EXERCISES when the right side has a name', () => {
  assert.deepStrictEqual(shape(parseWorkout('20 pushups and 20 situps')), [
    ['Pushups', [[20, null, null, null, null]]],
    ['Situps',  [[20, null, null, null, null]]],
  ]);
});

test('weighted bodyweight: leading reps + a weight tail', () => {
  assert.deepStrictEqual(shape(parseWorkout('20 pushups 15lbs')), [['Pushups', [[20, 15, 'lbs', null, null]]]]);
});

test('order is assigned across the whole message', () => {
  const r = parseWorkout('20 pull ups, squats 5x5 225, plank 30 sec');
  assert.deepStrictEqual(r.exercises.map(e => e.order), [0, 1, 2]);
});

// ── Conservative: never invent a set. Prose or number-less text is UNPARSED. ──
test('a fragment with no numbers is left unparsed, never guessed', () => {
  const r = parseWorkout('felt great today');
  assert.deepStrictEqual(r.exercises, []);
  assert.deepStrictEqual(r.unparsed, ['felt great today']);
});

test('mixed loggable + prose: log the loggable, surface the rest for the user', () => {
  const r = parseWorkout('20 pull ups, felt strong');
  assert.deepStrictEqual(shape(r), [['Pull Ups', [[20, null, null, null, null]]]]);
  assert.deepStrictEqual(r.unparsed, ['felt strong']);
});

test('empty / whitespace input yields nothing, no throw', () => {
  assert.deepStrictEqual(parseWorkout(''),   { exercises: [], unparsed: [] });
  assert.deepStrictEqual(parseWorkout('   '), { exercises: [], unparsed: [] });
  assert.deepStrictEqual(parseWorkout(null), { exercises: [], unparsed: [] });
});

// ── Library matching is exact-after-normalise: loose on spaces/hyphens/plurals,
// but never a substring (so "row" does not match "Inverted Row"). ─────────────
test('matchExercise normalises spaces, hyphens and trailing plural', () => {
  const lib = [{ id: 7, name: 'Pull-up' }, { id: 9, name: 'Inverted Row' }];
  assert.deepStrictEqual(matchExercise('pull ups', lib), { id: 7, name: 'Pull-up' });
  assert.deepStrictEqual(matchExercise('Pull-Up', lib),  { id: 7, name: 'Pull-up' });
});

test('matchExercise does not substring-match a different exercise', () => {
  const lib = [{ id: 9, name: 'Inverted Row' }];
  assert.strictEqual(matchExercise('row', lib), null);
  assert.strictEqual(matchExercise('bag work', lib), null);
});

// ── buildPreview: matching + the exact rows the route writes to WorkoutSet ────
test('buildPreview maps to WorkoutSet fields and matches the library', () => {
  const parsed = parseWorkout('20 pull ups, bench press 3x10 135lbs');
  const lib = [{ id: 7, name: 'Pull-up' }, { id: 3, name: 'Bench Press' }];
  const preview = buildPreview(parsed, lib);
  assert.strictEqual(preview[0].name, 'Pull-up');       // canonical from library
  assert.strictEqual(preview[0].exerciseId, 7);
  assert.strictEqual(preview[0].matched, true);
  assert.deepStrictEqual(preview[0].sets[0], { setNumber: 1, reps: 20, weight: null, weightUnit: 'lbs', duration: null, notes: null });
  // full name matches; a partial like "bench" would NOT (no substring match) — that is deliberate
  assert.strictEqual(preview[1].name, 'Bench Press');
  assert.strictEqual(preview[1].exerciseId, 3);
  assert.strictEqual(preview[1].sets.length, 3);
  assert.strictEqual(preview[1].sets[2].weight, 135);
});

test('buildPreview keeps an unmatched exercise as typed, id null', () => {
  const preview = buildPreview(parseWorkout('5 min bag work punches/kicks'), []);
  assert.strictEqual(preview[0].name, 'Bag Work');
  assert.strictEqual(preview[0].exerciseId, null);
  assert.strictEqual(preview[0].matched, false);
  assert.strictEqual(preview[0].sets[0].duration, 300);
  assert.strictEqual(preview[0].sets[0].notes, 'punches/kicks');
});

test('parseSets is exported and standalone-correct for a single set', () => {
  assert.deepStrictEqual(parseSets('10 each side 20lbs'), [
    { reps: 10, weight: 20, weightUnit: 'lbs', duration: null, note: 'each side' },
  ]);
  assert.deepStrictEqual(parseSets('nothing here'), []);
  assert.strictEqual(normKey('Pull-Ups'), 'pullup');
});
