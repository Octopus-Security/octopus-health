'use strict';

/**
 * sides.js — is an exercise done one side at a time, and what does that do to
 * the numbers?
 *
 * Two different facts were both logged as the set note "each side":
 *
 *   - the LOAD is per hand: "DB bench 3x10 35lb pair of dumbbells". Both arms
 *     move together; 10 reps is 10 reps, but 35 lb is in each hand.
 *   - the REPS are per side: "Bulgarian split squat 3x10 each side". Ten for
 *     the left leg, then ten for the right.
 *
 * Both double the load moved. Only the second doubles reps and hold time. The
 * note alone cannot tell them apart; the exercise can, so the exercise carries
 * the flag `sides`:
 *
 *   'unilateral'  each side is done separately; a logged rep count or hold is
 *                 per side. Reps, seconds and tonnage count both sides.
 *   'bilateral'   both sides together. A set note "each side" still means the
 *                 load was per hand, so tonnage counts both hands.
 *   null          not decided yet: the note alone decides tonnage, as above.
 *
 * Hard SETS are never doubled: a set of split squats is one set for the quads,
 * done twice. That is how set-volume guidelines count unilateral work.
 *
 * Read when numbers are computed, not when a set is saved, so flagging an
 * exercise corrects its whole history at once.
 */

const SIDES = ['unilateral', 'bilateral'];

const NOTE_RE = /\beach side\b/i;

/** A set's own note says the load or count was per side. */
function noteSaysPerSide(set) {
  return !!(set && set.notes && NOTE_RE.test(String(set.notes)));
}

/** Multipliers for one set: reps and seconds, and the load moved. */
function multipliers(set, def) {
  const uni = !!(def && def.sides === 'unilateral');
  const perSideNote = noteSaysPerSide(set);
  return {
    reps: uni ? 2 : 1,
    seconds: uni ? 2 : 1,
    tonnage: uni || perSideNote ? 2 : 1,
  };
}

// Names that almost always mean one side at a time. A SUGGESTION for the fixer
// page, never applied on its own: a wrong flag doubles numbers.
const UNILATERAL_RE = new RegExp([
  '\\b(?:single|one|1)[- ](?:arm|leg|hand|side)',
  '\\bunilateral\\b',
  '\\bsplit squats?\\b', '\\bbulgarian\\b', '\\blunges?\\b', '\\bstep[- ]?ups?\\b',
  '\\bpistol\\b', '\\bside planks?\\b', '\\bcossack\\b', '\\bcurtsy\\b', '\\bsuitcase\\b',
  '\\bkickstand\\b', '\\bcopenhagen\\b', '\\bclamshells?\\b', '\\bskater\\b',
  '\\bconcentration curls?\\b', '\\bpallof\\b', '\\bturkish get[- ]?ups?\\b',
  '\\b(?:kb|kettlebell|dumbbell|db) (?:snatch|clean|windmill)', '\\bwindmills?\\b',
].join('|'), 'i');

// Names that are clearly both sides at once (a bar or both hands on one thing).
const BILATERAL_RE = /\b(?:barbell|trap bar|hex bar|smith|ez[- ]?bar|leg press|pull[- ]?ups?|chin[- ]?ups?|push[- ]?ups?|dips?|deadlifts?|back squats?|front squats?|hip thrusts?|lat pulldowns?|seated rows?|bench press)\b/i;

/**
 * What the flag probably is, and why. `notes` is { perSide, total } for the
 * exercise's logged sets. Returns { sides, why } or null.
 */
function suggest(name, notes) {
  const n = String(name || '');
  if (UNILATERAL_RE.test(n) && !/\b(?:alternating|both)\b/i.test(n)) return { sides: 'unilateral', why: 'the name says one side at a time' };
  if (notes && notes.total >= 2 && notes.perSide / notes.total >= 0.5 && !BILATERAL_RE.test(n)) {
    return { sides: 'unilateral', why: `${notes.perSide} of ${notes.total} logged sets say "each side"` };
  }
  if (BILATERAL_RE.test(n)) return { sides: 'bilateral', why: 'the name says both sides together' };
  return null;
}

module.exports = { SIDES, multipliers, noteSaysPerSide, suggest, UNILATERAL_RE, BILATERAL_RE };
