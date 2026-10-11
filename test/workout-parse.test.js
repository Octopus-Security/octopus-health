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

// ── 2026-10-11: the owner's block format, and phrasings that were confidently wrong ──
test('block format: header line, set lines under it, +bar, ea side, chatter and a 2FA code', () => {
  const r = parseWorkout('chest fly Machine:\n100lb x 10\n\nBench press 45lb bar:\n50+bar x 10\n70+bar x 10\n90+bar x 10\n\n'
    + '10 pull ups\n\n10 leg raises\n\n10 bicep curls ea side 30 lbs\n\nIs the full session right now for today so far\n\n719981');
  assert.deepStrictEqual(r.exercises.map(e => [e.name, e.sets.map(s => [s.reps, s.weight])]), [
    ['Chest Fly Machine', [[10, 100]]],
    ['Bench Press', [[10, 95], [10, 115], [10, 135]]],
    ['Pull Ups', [[10, null]]],
    ['Leg Raises', [[10, null]]],
    ['Bicep Curls', [[10, 30]]],
  ]);
  assert.strictEqual(r.exercises[1].sets[0].note, '50 + 45lb bar');
  assert.strictEqual(r.exercises[4].sets[0].note, 'each side');
  assert.deepStrictEqual(r.unparsed, ['Is the full session right now for today so far', '719981']);
});

test('+bar without a stated bar weight assumes a 45 lb bar; a stated one wins', () => {
  assert.strictEqual(parseWorkout('squat:\n90+bar x 5').exercises[0].sets[0].weight, 135);
  assert.strictEqual(parseWorkout('squat 35lb bar:\n90+bar x 5').exercises[0].sets[0].weight, 125);
});

test('phrasings that used to log the WRONG numbers', () => {
  const sh = t => parseWorkout(t).exercises.map(e => [e.name, e.sets.map(s => [s.reps, s.weight])]);
  assert.deepStrictEqual(sh('bench 3 sets of 10 at 135'), [['Bench', [[10, 135], [10, 135], [10, 135]]]]);
  assert.deepStrictEqual(sh('3 sets of 10 pushups'), [['Pushups', [[10, null], [10, null], [10, null]]]]);
  assert.deepStrictEqual(sh('deadlift 225x5'), [['Deadlift', [[5, 225]]]]);
  assert.deepStrictEqual(sh('3x10 dips'), [['Dips', [[10, null], [10, null], [10, null]]]]);
});

test('what it cannot store or read goes to unparsed, never a guess', () => {
  for (const t of ['ran 2 miles', '3 sets of something 4/5']) {
    const r = parseWorkout(t);
    assert.deepStrictEqual(r.exercises, [], t);
    assert.deepStrictEqual(r.unparsed, [t]);
  }
});
