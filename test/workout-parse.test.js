'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { parseWorkout, buildPreview, parseSets, parseClause, matchExercise, normKey, pickLoad } = require('../api/workout-parse');

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

// ── 2026-10-14: the day a declined approval card was pasted back in to approve it ──
//
// The owner's message was clean. cortex preferred the LIVE chat message over the
// model's copy (it is supposed to — that is what stops a model dropping a line),
// and the live message was the owner re-sending the card: "Neith wanted to: •
// log_workout_text — text: Bench press 45lb bar: …, date: 2026-10-14, type:
// strength / ⌛ No response — not run. / Please log". Every guard downstream then
// did its job on the wrong input. cortex no longer substitutes a quoted card;
// these are the locks on this side of that door.

test('the owner\'s own reps-first block: 10 x 50 + bar is TEN reps, not ten sets', () => {
  const r = parseWorkout('Bench press 45lb bar:\n10 x 50 + bar \n10 x 90 + bar \n1 x 140 + bar\n10 x 90 + bar');
  assert.deepStrictEqual(r.exercises.map(e => [e.name, e.sets.map(s => [s.reps, s.weight])]), [
    ['Bench Press', [[10, 95], [10, 135], [1, 185], [10, 135]]],
  ]);
  assert.deepStrictEqual(r.unparsed, []);
});

test('a unit-less NxM set line reads the same both ways round', () => {
  const sets = t => parseWorkout(t).exercises[0].sets.map(s => [s.reps, s.weight]);
  // reps first (2026-10-14) and weight first (2026-10-11) are the same person.
  assert.deepStrictEqual(sets('dumbbell curl:\n10 x 25\n10 x 30'), [[10, 25], [10, 30]]);
  assert.deepStrictEqual(sets('chest fly machine:\n50 x 10\n70 x 10'), [[10, 50], [10, 70]]);
  // Before this, "10 x 25" under a header logged TEN SETS OF TWENTY-FIVE REPS.
  assert.strictEqual(parseWorkout('dumbbell curl:\n10 x 25').exercises[0].sets.length, 1);
});

test('a set line whose numbers could be either goes unread, never guessed', () => {
  // "3 x 10" on a line that is one set: 3 reps at 10 lb, or 10 reps at 3 lb?
  // Nothing in the text says, so nothing is written and the person is asked.
  const r = parseWorkout('curls:\n3 x 10\n30 x 25');
  assert.deepStrictEqual(r.exercises, []);
  assert.deepStrictEqual(r.unparsed, ['curls:', '3 x 10', '30 x 25']);
  // An explicit unit removes the ambiguity entirely, and still works.
  assert.deepStrictEqual(parseWorkout('curls:\n3 x 10 lbs').exercises[0].sets.map(s => [s.reps, s.weight]),
    [[3, 10]]);
});

test('pickLoad: exactly one candidate load, or nothing', () => {
  assert.deepStrictEqual(pickLoad(10, 50), [10, 50]);
  assert.deepStrictEqual(pickLoad(50, 10), [10, 50]);
  assert.deepStrictEqual(pickLoad(1, 140), [1, 140]);
  assert.deepStrictEqual(pickLoad(25, 135), [25, 135]);
  assert.strictEqual(pickLoad(3, 10), null);     // both too small to be a load
  assert.strictEqual(pickLoad(30, 25), null);    // both could be either
});

test('a pasted approval card logs NOTHING, and says every line is unread', () => {
  const card = 'Neith wanted to:\n• log_workout_text — text: Bench press 45lb bar:\n'
    + '10 x 50 + bar \n10 x 90 + bar \n1 x 140 + bar\n10 x 90 + bar, date: 2026-10-14, type: strength\n\n'
    + '⌛ No response — not run.\n\nPlease log';
  const r = parseWorkout(card);
  // Not one exercise: not "Log Workout Text Text Bench Press", not "10 X 50 Bar",
  // not "Date:" at 2026 reps, and above all not an exercise called "X".
  assert.deepStrictEqual(r.exercises, []);
  assert.ok(r.unparsed.length > 0, 'the lines are reported unread, not silently dropped');
});

test('plumbing, separators and out-of-range numbers are not exercises', () => {
  // A snake_case identifier is the agent quoting itself.
  assert.deepStrictEqual(parseWorkout('log_workout_text — text: bench press 3x10 135lbs').exercises, []);
  // "x" is a separator. It became an exercise name, and then matched all 23 of
  // the account's names containing the letter x.
  assert.deepStrictEqual(parseClause('x 90'), null);
  // "date: 2026-10-14" parsed as 2026 reps at 10 lb.
  assert.deepStrictEqual(parseSets('2026-10-14'), []);
  assert.deepStrictEqual(parseWorkout('date: 2026-10-14').exercises, []);
});
