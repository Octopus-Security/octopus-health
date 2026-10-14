'use strict';

/**
 * Catching a near-duplicate exercise name before it becomes one.
 *
 * The real names this was built from, all present on one account:
 *
 *   Bench Press / Barbell Bench Press                  same lift, 205 vs 185
 *   Tricep Pushdown / Cable Tricep Pushdown            same lift
 *   Lateral Raise / Dumbbell Lateral Raise             same lift
 *   Cable Face Pull / Resistance Band Face Pull        DIFFERENT lifts
 *   Romanian Deadlift / Dumbbell Romanian Deadlift     DIFFERENT lifts
 *
 * Note that the same shape — one name is the other plus an equipment word —
 * appears in both the "same" and "different" lists. Nothing about the strings
 * can tell those apart, which is exactly why this asks instead of deciding.
 *
 * Run: node --test test/exercise-names.test.js
 */

const { test } = require('node:test');
const assert   = require('node:assert');

const {
  canonicalKey, baseKey, resolveExerciseName, resolveExerciseNames, questionText, qualifies } = require('../api/exercise-names');

// The account AFTER the duplicates were merged, which is the state this guard
// is meant to hold. Note what that implies and why the order mattered: an exact
// match always wins, so while both `Bench Press` and `Barbell Bench Press`
// existed, logging "Bench Press" matched one of them exactly and asked nothing.
// The guard stops new duplicates forming; it cannot un-form the old ones. That
// is the merge's job, and it had to go first.
const KNOWN = [
  'Barbell Bench Press', 'Cable Face Pull', 'Resistance Band Face Pull',
  'Dumbbell Lateral Raise', 'Leg Press', 'Leg Curl', 'Dips', 'Barbell Romanian Deadlift',
  'Dumbbell Romanian Deadlift', 'Cable Row (Seated, Close Grip)', 'Incline Dumbbell Press',
];

test('case, punctuation and plurals are not disagreements', () => {
  for (const spelling of ['dips', 'DIPS', 'Dips.', 'Dip']) {
    const r = resolveExerciseName(spelling, KNOWN);
    assert.equal(r.status, 'known', `${spelling} should resolve silently`);
    assert.equal(r.name, 'Dips');
  }
  // A word that already ends in a double s must survive singularising, or
  // "press" becomes "pres" and stops matching itself.
  assert.equal(canonicalKey('Bench Press'), 'bench press');
  assert.equal(canonicalKey('Bicep Curls'), 'bicep curl');
});

test('an equipment word makes it a question, never a merge', () => {
  // The case that actually happened: logged as "Bench Press", already have
  // "Barbell Bench Press" too. Both exist, so it cannot be guessed.
  const r = resolveExerciseName('Bench Press', ['Barbell Bench Press']);
  assert.equal(r.status, 'ambiguous');
  assert.deepEqual(r.candidates, ['Barbell Bench Press']);
  assert.equal(r.name, null, 'nothing is chosen on the caller\'s behalf');

  // And the one that must NOT be merged, which has the identical shape.
  const f = resolveExerciseName('Face Pull', KNOWN);
  assert.equal(f.status, 'ambiguous');
  assert.deepEqual(f.candidates, ['Cable Face Pull', 'Resistance Band Face Pull']);
});

test('a genuinely new exercise is not interrogated', () => {
  // Asking about everything unfamiliar trains the answer "yes, whatever".
  const r = resolveExerciseName('Zercher Squat', KNOWN);
  assert.equal(r.status, 'new');
  assert.equal(r.name, 'Zercher Squat');
  assert.deepEqual(r.candidates, []);
});

test('different exercises that merely rhyme are left alone', () => {
  // Leg Press and Leg Curl share a word and are not the same thing. If this
  // asks, the guard is noise.
  const r = resolveExerciseName('Leg Extension', KNOWN);
  assert.equal(r.status, 'new', 'shares "leg" with two known lifts and is still its own');
});

test('a typo is caught, a short different name is not', () => {
  assert.equal(resolveExerciseName('Bech Press', ['Bench Press']).status, 'ambiguous');
  // Short names differ for real reasons — Dips vs Dip is handled by plurals,
  // but Curl vs Crul should not drag in every four-letter lift.
  assert.equal(resolveExerciseName('Row', ['Dips']).status, 'new');
});

test('a variation is not the base lift', () => {
  // Incline changes the exercise; equipment-stripping must not reach it.
  assert.notEqual(baseKey('Incline Dumbbell Press'), baseKey('Dumbbell Press'));
  const r = resolveExerciseName('Incline Barbell Press', ['Incline Dumbbell Press']);
  assert.equal(r.status, 'ambiguous', 'same variation, different kit — ask');
});

test('every ambiguity in one workout is collected before anything is written', () => {
  // The point: a workout is logged as a unit. Asking about the second exercise
  // after saving the first leaves a half-logged session.
  const submitted = ['Bench Press', 'Face Pull', 'Zercher Squat', 'Dips'];
  const { resolved, questions, allKnown } = resolveExerciseNames(submitted, KNOWN);

  assert.equal(allKnown, false);
  assert.equal(questions.length, 2, 'both problems asked at once, not one per round trip');
  assert.deepEqual(questions.map(q => q.exerciseName), ['Bench Press', 'Face Pull']);

  // The unambiguous ones still resolve, so the answer only has to cover the rest.
  assert.equal(resolved.get('Zercher Squat'), 'Zercher Squat');
  assert.equal(resolved.get('Dips'), 'Dips');
});

test('one question per name, however many sets it had', () => {
  const { questions } = resolveExerciseNames(['Bench Press', 'bench press', 'Bench Press.'], KNOWN);
  assert.equal(questions.length, 1);
});

test('a clean workout asks nothing', () => {
  const { questions, allKnown, resolved } = resolveExerciseNames(['Dips', 'Leg Press'], KNOWN);
  assert.equal(allKnown, true);
  assert.equal(questions.length, 0);
  assert.equal(resolved.get('Leg Press'), 'Leg Press');
});

test('the question names every ambiguity and says nothing was saved', () => {
  const { questions } = resolveExerciseNames(['Bench Press', 'Face Pull'], KNOWN);
  const text = questionText(questions);
  assert.match(text, /Bench Press/);
  assert.match(text, /Face Pull/);
  assert.match(text, /Cable Face Pull/);
  assert.match(text, /Resistance Band Face Pull/);
  assert.match(text, /Nothing has been saved/);

  assert.equal(questionText([]), null);
  // Single ambiguity still reads as a sentence rather than a bulleted list of one.
  assert.doesNotMatch(questionText([{ exerciseName: 'Bench Press', candidates: ['Barbell Bench Press'] }]), /•/);
});

// ── 2026-10-14: the question that listed 23 exercises and could not be answered ──
test('a one-letter fragment is ambiguous against nothing', () => {
  // The real list, from the account. Every one of them contains the letter x,
  // so `kk.includes('x')` made every one of them a candidate for an exercise
  // the parser had mistakenly called "X" — and the owner was asked to choose.
  const xs = [
    'Ankle Dorsiflexion Wall Drill', 'Banded Ankle Dorsiflexion', 'Box Jump',
    'Deep Hip External Rotation PAILs', 'Elbow Flexion/Extension', 'Explosive Pull-up',
    'Finger Extension Stretch', 'Foam Roll Hip Flexors', 'Half-Kneeling Hip Flexor Stretch',
    'Heavy Bag — Boxing Combos', 'Hip Flexor / Psoas Release', 'Hip Flexor CARS',
    'Leg Extension', 'Overhead Tricep Extension', 'Pad Work — Boxing',
    'Resistance Band Tricep Extension', 'Seated Hip Internal/External Rotation',
    'Shadow Boxing', 'Shadow Boxing — Muay Thai', 'Standing Hip Flexor PAILs/RAILs',
    'Terminal Knee Extension (TKE)', 'Thoracic Extension over Roller', 'Wrist Flexor Stretch',
  ];
  const r = resolveExerciseName('X', xs);
  assert.deepStrictEqual(r.candidates, []);
  assert.notEqual(r.status, 'ambiguous', 'a question with 23 options is not a question');
});

test('containment is on word boundaries, not anywhere in the string', () => {
  // What the rule is FOR, and must keep doing.
  assert.equal(resolveExerciseName('Incline Bench Press', ['Bench Press']).status, 'ambiguous');
  assert.equal(resolveExerciseName('Ring Dips', ['Dips']).status, 'ambiguous');
  assert.equal(resolveExerciseName('Front Squat', ['Squat']).status, 'ambiguous');
  // What it must stop doing: matching a word fragment mid-word.
  assert.equal(qualifies('box jump', 'x'), false);
  assert.equal(qualifies('shadow boxing', 'box'), false, '"box" is inside "boxing", not a word of it');
  assert.equal(qualifies('bench press', 'bench'), true);
});
