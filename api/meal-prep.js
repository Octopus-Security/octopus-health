'use strict';

/**
 * meal-prep.js — a batch cooked from a saved meal.
 *
 * "I made three of these on Sunday", then on three separate days, "eat one".
 *
 * The reason this is a separate thing from a saved meal rather than a count on
 * one: a template is deliberately LIVE. The tub of protein behind the shake
 * changes whenever something else is on sale, and swapping it is one field on
 * one slot so that every FUTURE log is right. A batch is the opposite — those
 * portions are already in the fridge, made with whatever was open that day.
 * Recomputing them from the template later would silently restate Sunday's
 * dinner in terms of Thursday's yogurt.
 *
 * So the macros are resolved ONCE, at prep time, and frozen on the row.
 * Everything here is pure: it turns already-resolved numbers into the row to
 * write, and a row into the meal to log. The nutrition lookups happen in
 * meal-template.js before any of this is called, which is also what lets this
 * be tested without a database or a network.
 */

const MACROS = ['kcal', 'protein', 'carbs', 'fats'];

/** Whole portions, within what the batch actually held. */
function clampPortions(value, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;      // 'two' is not none, but it is not a number
  return Math.max(0, Math.min(max, n));
}

/** How many a new batch may claim to be. Upper bound is a typo guard, not a rule. */
function portionsMade(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(50, n);
}

/**
 * The MealPrep row for a batch just cooked.
 *
 * `result` is what macrosForTemplate returned for ONE portion. It is costed per
 * portion rather than per batch on purpose: that is the number every later log
 * needs, and storing a batch total would mean dividing it back by a portion
 * count that can be corrected after the fact — so a correction would silently
 * restate the macros of portions already eaten.
 */
function snapshotFor(template, slots, result, { portions, preppedOn, notes } = {}) {
  const made = portionsMade(portions);
  const row = {
    name: template.name,
    templateId: template.id ?? null,
    mealType: template.mealType || 'snack',
    portions: made,
    portionsLeft: made,
    preppedOn: preppedOn || new Date().toISOString().slice(0, 10),
    slots: JSON.stringify(Array.isArray(slots) ? slots : []),
    notes: notes || template.notes || null,
  };
  // `|| null` rather than `|| 0`: a slot that could not be resolved is already
  // absent from the total, and writing a confident 0 kcal is how a batch that
  // lost its peanut butter stops looking like one that lost anything.
  for (const k of MACROS) row[k] = (result?.totals?.[k]) || null;
  return row;
}

/** Nothing left to eat. Its own function because 0 is a normal state, not an error. */
const isFinished = prep => !prep || Number(prep.portionsLeft) < 1;

/**
 * The Meal row for eating one portion — the frozen numbers, copied not recomputed.
 *
 * The description names the prep date rather than today's, because "chicken and
 * rice" three days running is otherwise three identical rows, and the thing you
 * want to know later is which batch it came from.
 */
function mealFor(prep, { date, time, mealType } = {}) {
  const now = new Date();
  return {
    date: date || now.toISOString().slice(0, 10),
    time: time || now.toTimeString().slice(0, 8),
    mealType: ['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType) ? mealType : prep.mealType,
    description: `${prep.name} (meal prep from ${prep.preppedOn})`,
    calories: prep.kcal,
    protein:  prep.protein,
    carbs:    prep.carbs,
    fats:     prep.fats,
    notes: [prep.notes, prep.provenance].filter(Boolean).join('\n') || null,
  };
}

module.exports = { clampPortions, portionsMade, snapshotFor, isFinished, mealFor, MACROS };
