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
  // `dates` is additive (2026-10-14): what a date LINE in the text said, for a
  // caller that wants it. Asserted by exact shape on purpose — a new field
  // appearing here should make someone look, since `unparsed` growing a
  // sibling is how a caller silently stops reading half the answer.
  const empty = { exercises: [], unparsed: [], dates: [] };
  assert.deepStrictEqual(parseWorkout(''),    empty);
  assert.deepStrictEqual(parseWorkout('   '), empty);
  assert.deepStrictEqual(parseWorkout(null),  empty);
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

// ── 2026-10-14, later: a leg day written the way the owner actually writes one ──
//
// Four more phrasings, and three of them were storing or dropping real numbers:
// "10 x Deep squats" named the exercise `X Deep Squats With`, "Bar = 45 lbs"
// became an exercise called `Bar =` holding 45 lb, "90lb + bar" inline logged
// 90 for a 135 lb lift, and a `Shoulder press` block whose set lines ended in
// "dumbbells" was dropped whole. Both `X` names then went out as "which did you
// mean?" questions about the letter x, and nothing was saved.
test('the owner\'s leg day, verbatim', () => {
  const r = parseWorkout([
    'Leg extension:', '10 x 50lbs', '10 x 70lbs', '10 x 100lbs', '',
    'Leg curl:', '10 x 50lbs', '10 x 70lbs', '',
    '10 x Deep squats with 70lb', '',
    'Bar = 45 lbs', '10 x Barbell back squats 90lb + bar x 10', '',
    'Shoulder press ', '10 x 40lb dumbbells ', '10 x 40lb dumbbells', '',
    '5 pull ups', '5 L sit pull ups', '', '15 dips',
  ].join('\n'));
  assert.deepStrictEqual(r.exercises.map(e => [e.name, e.sets.map(s => [s.reps, s.weight])]), [
    ['Leg Extension',        [[10, 50], [10, 70], [10, 100]]],
    ['Leg Curl',             [[10, 50], [10, 70]]],
    ['Deep Squats',          [[10, 70]]],
    ['Barbell Back Squats',  [[10, 135]]],
    ['Shoulder Press',       [[10, 40], [10, 40]]],
    ['Pull Ups',             [[5, null]]],
    ['L Sit Pull Ups',       [[5, null]]],
    ['Dips',                 [[15, null]]],
  ]);
  assert.deepStrictEqual(r.unparsed, []);
  // The inline +bar keeps its reading, exactly as the block form does.
  assert.strictEqual(r.exercises[3].sets[0].note, '90 + 45lb bar');
});

test('"N x name" is N reps of that exercise, not an exercise called X', () => {
  const sh = t => parseWorkout(t).exercises.map(e => [e.name, e.sets.map(s => [s.reps, s.weight])]);
  assert.deepStrictEqual(sh('10 x Deep squats with 70lb'), [['Deep Squats', [[10, 70]]]]);
  assert.deepStrictEqual(sh('5 x pull ups'), [['Pull Ups', [[5, null]]]]);
  // "with"/"holding" introduce the load and are not part of the movement.
  assert.deepStrictEqual(sh('10 goblet squats holding 50lb'), [['Goblet Squats', [[10, 50]]]]);
  // The plain form still works and still wins where there is no x.
  assert.deepStrictEqual(sh('20 pull ups'), [['Pull Ups', [[20, null]]]]);
});

test('an inline "+ bar" is expanded, like the block form', () => {
  const sets = t => parseWorkout(t).exercises[0].sets.map(s => [s.reps, s.weight, s.note]);
  assert.deepStrictEqual(sets('10 x Barbell back squats 90lb + bar x 10'), [[10, 135, '90 + 45lb bar']]);
  assert.deepStrictEqual(sets('bench 135 + bar x 5'), [[5, 180, '135 + 45lb bar']]);
});

test('"Bar = 45 lbs" declares the bar for the lines below it and logs nothing', () => {
  // Consumed, NOT unparsed: it has a number in it, and service.js refuses to
  // save a workout with an unread numeric line, so leaving it there would
  // reject the whole message.
  const r = parseWorkout('Bar = 35 lbs\nBack squat:\n90+bar x 5');
  assert.deepStrictEqual(r.exercises.map(e => [e.name, e.sets.map(s => [s.reps, s.weight])]),
    [['Back Squat', [[5, 125]]]]);
  assert.deepStrictEqual(r.unparsed, []);
  // A bar named in the HEADER still wins over one declared earlier.
  assert.strictEqual(parseWorkout('Bar = 35 lbs\nsquat 45lb bar:\n90+bar x 5')
    .exercises[0].sets[0].weight, 135);
  // And it is never an exercise of its own.
  assert.deepStrictEqual(parseWorkout('Bar = 45 lbs').exercises, []);
  assert.deepStrictEqual(parseWorkout('Bar = 45 lbs').unparsed, []);
});

test('a set line may end in an equipment word without naming an exercise', () => {
  const sets = t => parseWorkout(t).exercises[0].sets.map(s => [s.reps, s.weight]);
  assert.deepStrictEqual(sets('Shoulder press:\n10 x 40lb dumbbells\n10 x 40lb dumbbells'),
    [[10, 40], [10, 40]]);
  // REGRESSION, caught before it shipped: stripping "each" as an equipment word
  // ran BEFORE SIDE_RE, leaving the word "side" behind — which reads as a name,
  // so the whole block went unread. The version this replaced got it right.
  const side = parseWorkout('Shoulder press:\n10 x 40lbs each side\n10 x 50lbs each side');
  assert.deepStrictEqual(side.exercises.map(e => [e.name, e.sets.map(x => [x.reps, x.weight, x.note])]),
    [['Shoulder Press', [[10, 40, 'each side'], [10, 50, 'each side']]]]);
  assert.deepStrictEqual(side.unparsed, []);
  // "each hand" is the same claim about the same set, and was carrying no note
  // at all — so nothing recorded that 40 meant 40 PER HAND.
  assert.deepStrictEqual(sets('Shoulder press:\n10 x 40lb each hand'), [[10, 40]]);
  assert.strictEqual(parseWorkout('Shoulder press:\n10 x 40lb each hand').exercises[0].sets[0].note,
    'each side');
  // But a line with a real movement word in it is still its own exercise.
  const r = parseWorkout('Shoulder press:\n10 x 40lb dumbbells\n10 dumbbell curls 25lbs');
  assert.deepStrictEqual(r.exercises.map(e => e.name), ['Shoulder Press', 'Dumbbell Curls']);
});

test('a date line labels the message, it does not destroy it', () => {
  // Writing the date at the top is the obvious thing to do, and it silently
  // refused the whole workout: the line landed in `unparsed`, and
  // routes/service.js treats ANY unread line containing a number as reason to
  // save nothing. Found 2026-10-14 while writing two catch-up messages —
  // "Log for 2026-10-11:" killed all five exercises under it.
  for (const prefix of ['Log for 2026-10-11:', '2026-10-11', '10/11', 'for 10/11/26',
                        'logging this for 2026-10-11']) {
    const r = parseWorkout(`${prefix}\nchest fly Machine:\n100lb x 10\n\n10 pull ups`);
    assert.deepStrictEqual(r.exercises.map(e => e.name), ['Chest Fly Machine', 'Pull Ups'], prefix);
    // The killer condition, asserted exactly as service.js computes it.
    const unread = r.unparsed.filter(l => /\d/.test(l) && !/^\s*\d{5,}\s*$/.test(l));
    assert.deepStrictEqual(unread, [], `${prefix} must not be an unread numeric line`);
    assert.ok(r.dates.length, 'and what it said is handed back');
  }
  // It reports, it does not decide: the caller owns the date.
  assert.deepStrictEqual(parseWorkout('2026-10-11\n10 dips').dates, ['2026-10-11']);
  // A set line that merely contains a slash or a number is still a set.
  assert.deepStrictEqual(parseWorkout('Curls:\n10 x 25lbs').exercises[0].sets.length, 1);
  assert.deepStrictEqual(parseWorkout('3 sets of something 4/5').unparsed, ['3 sets of something 4/5']);
  // And the digit-free phrasing that was the workaround still works.
  const w = parseWorkout('log this for last Sunday the eleventh, not today\n10 dips');
  assert.deepStrictEqual(w.exercises.map(e => e.name), ['Dips']);
});

test('"with"/"holding" ends the name only when a LOAD follows', () => {
  const sh = t => parseWorkout(t).exercises.map(e => [e.name, e.sets.map(s => [s.reps, s.weight])]);
  // A weight: the word introduces the load and is not part of the movement.
  assert.deepStrictEqual(sh('10 x Deep squats with 70lb'), [['Deep Squats', [[10, 70]]]]);
  assert.deepStrictEqual(sh('10 goblet squats holding 50lb'), [['Goblet Squats', [[10, 50]]]]);
  // A POSITION: the same word, and breaking on it produced an exercise called
  // "Pull Ups While" (2026-10-14 — "I did pull ups while holding an L sit").
  assert.deepStrictEqual(sh('5 pull ups while holding an L sit'),
    [['Pull Ups While Holding An L Sit', [[5, null]]]]);
  // The short form he should use in a log line, unchanged.
  assert.deepStrictEqual(sh('5 L sit pull ups'), [['L Sit Pull Ups', [[5, null]]]]);
});

test('a bar named in words is the bar\'s weight, inline and as a set line', () => {
  const sets = t => parseWorkout(t).exercises[0].sets.map(s => [s.reps, s.weight, s.note]);
  // It used to stay in the name — "Squats With The Bar", carrying no weight.
  assert.deepStrictEqual(sets('10 squats with the bar'), [[10, 45, 'just the 45lb bar']]);
  assert.deepStrictEqual(sets('10 squats with just the bar'), [[10, 45, 'just the 45lb bar']]);
  // Same sources as "+bar": a declared bar beats the 45 lb assumption...
  assert.deepStrictEqual(sets('Bar = 35 lbs\n10 squats with the bar'), [[10, 35, 'just the 35lb bar']]);
  // ...and a header bar beats both, mixed with the "+bar" form in one block.
  assert.deepStrictEqual(parseWorkout('bench press 45lb bar:\n10 with the bar\n50+bar x 10')
    .exercises[0].sets.map(s => [s.reps, s.weight]), [[10, 45], [10, 95]]);
  assert.deepStrictEqual(parseWorkout('bench press 45lb bar:\n10 with the bar\n50+bar x 10').unparsed, []);
});

test('"pair of dumbbells" on a set line is per-hand load, not an exercise name', () => {
  // 2026-10-15, verbatim. Every set line went unread, so the owner was asked to
  // rewrite a workout he had written correctly — three times.
  const msg = 'Dumbbell incline chest press:\n10 x 35lb pair of dumbbells \n10 x 45lb pair of dumbbells \n' +
              '10 x 50lb pair of dumbbells \n\nBicep curls:\n10 x 25lb pair of dumbbells';
  const r = parseWorkout(msg);
  assert.deepStrictEqual(r.unparsed, []);
  assert.deepStrictEqual(shape(r), [
    ['Dumbbell Incline Chest Press', [[10, 35, 'lbs', null, 'each side'], [10, 45, 'lbs', null, 'each side'], [10, 50, 'lbs', null, 'each side']]],
    ['Bicep Curls', [[10, 25, 'lbs', null, 'each side']]],
  ]);
  // Inline, as he re-sent it.
  assert.deepStrictEqual(shape(parseWorkout('Bicep curls 10 x 25lb pair of dumbbells')),
    [['Bicep Curls', [[10, 25, 'lbs', null, 'each side']]]]);
});

test('a block flattened onto one line is asked about, never read as sets x reps', () => {
  // Read before this as TEN SETS OF FORTY-FIVE REPS at 35 lb.
  const r = parseWorkout('Dumbbell incline chest press: 10 x 35lb pair of dumbbells  10 x 45lb pair of dumbbells  10 x 50lb pair of dumbbells');
  assert.deepStrictEqual(r.exercises, []);
  assert.strictEqual(r.unparsed.length, 1);
  // The inline grammar it must not disturb.
  assert.deepStrictEqual(shape(parseWorkout('bench 3x10 @135')), [['Bench', [[10, 135, 'lbs', null, null], [10, 135, 'lbs', null, null], [10, 135, 'lbs', null, null]]]]);
  assert.deepStrictEqual(shape(parseWorkout('squat 5x5 225')).map(e => e[1].length), [5]);
});

test('set lines read the phrasings the inline grammar already reads', () => {
  const sets = b => { const r = parseWorkout('Incline press:\n' + b); return r.unparsed.length ? 'UNREAD' : r.exercises[0].sets.map(s => [s.reps, s.weight]); };
  assert.deepStrictEqual(sets('12 reps 40lb'), [[12, 40]]);
  assert.deepStrictEqual(sets('10 reps @ 50lb'), [[10, 50]]);
  assert.deepStrictEqual(sets('10x30lb DBs'), [[10, 30]]);
  assert.deepStrictEqual(sets('10 x 25lb ez bar'), [[10, 25]]);
  assert.deepStrictEqual(sets('10 x 135 on the bar'), [[10, 135]]);
  assert.deepStrictEqual(sets('15 x bodyweight'), [[15, null]]);
  // A named load plus NxM is sets × reps; forcing it to one set lost two.
  assert.deepStrictEqual(sets('3x8 @135'), [[8, 135], [8, 135], [8, 135]]);
  assert.deepStrictEqual(sets('3 sets of 10 @ 135'), [[10, 135], [10, 135], [10, 135]]);
  // Without one, still one set, and still not guessed when size cannot tell.
  assert.deepStrictEqual(sets('10 x 50'), [[10, 50]]);
  assert.strictEqual(sets('3 x 10'), 'UNREAD');
});

test('inline: "30s" after NxM is not guessed, and a trailing colon is not part of the name', () => {
  // Was TEN SETS OF THIRTY REPS.
  assert.deepStrictEqual(parseWorkout('hammer curls 10 x 30s').exercises, []);
  assert.deepStrictEqual(shape(parseWorkout('Dumbbell bicep curls: 10 x 25lb')),
    [['Dumbbell Bicep Curls', [[10, 25, 'lbs', null, null]]]]);
});

test('matchExercise resolves shorthand aliases to the canonical library entry', () => {
  const lib = [
    { id: 1, name: 'Bench Press' }, { id: 2, name: 'Overhead Press' }, { id: 3, name: 'Deadlift' },
    { id: 4, name: 'Romanian Deadlift' }, { id: 5, name: 'Bulgarian Split Squat' },
    { id: 6, name: 'Stationary Bike' }, { id: 7, name: 'Inverted Row' },
  ];
  assert.deepStrictEqual(matchExercise('bench', lib), { id: 1, name: 'Bench Press' });
  assert.deepStrictEqual(matchExercise('OHP', lib), { id: 2, name: 'Overhead Press' });
  assert.deepStrictEqual(matchExercise('DL', lib), { id: 3, name: 'Deadlift' });
  assert.deepStrictEqual(matchExercise('RDL', lib), { id: 4, name: 'Romanian Deadlift' });
  assert.deepStrictEqual(matchExercise('BSS', lib), { id: 5, name: 'Bulgarian Split Squat' });
  assert.deepStrictEqual(matchExercise('bike', lib), { id: 6, name: 'Stationary Bike' });
  assert.strictEqual(matchExercise('row', lib), null); // still no substring grab
});

test('an alias never links when the library lacks the canonical exercise', () => {
  assert.strictEqual(matchExercise('bench', [{ id: 9, name: 'Squat' }]), null);
  assert.strictEqual(matchExercise('constructor', [{ id: 9, name: 'Squat' }]), null);
});

test('an exact library name wins over an alias', () => {
  const lib = [{ id: 1, name: 'Bench Press' }, { id: 2, name: 'Bench' }];
  assert.deepStrictEqual(matchExercise('bench', lib), { id: 2, name: 'Bench' });
});
