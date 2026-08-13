'use strict';

/**
 * Meal preps: a batch already in the fridge.
 *
 * A saved meal is deliberately LIVE — the tub behind the shake changes whenever
 * something else is on sale, and swapping it is one field on one slot so every
 * FUTURE log is right. A batch is the opposite: three portions cooked on Sunday
 * were made with whatever was open on Sunday, and they stay that way no matter
 * what the template says on Thursday.
 *
 * That is the invariant worth testing, because it is invisible when it breaks.
 * Nothing errors; the numbers just quietly restate last week's dinner in terms
 * of this week's yogurt, and a nutrition log that does that is not worth
 * keeping — the same reasoning the whole slot/product split rests on.
 *
 * No database and no network: snapshotFor takes numbers meal-template.js has
 * already resolved, so the freezing can be tested as the pure transformation it
 * is. (It also has to be — the deps here need a GitHub Packages token.)
 *
 * Run: node --test test/meal-prep.test.js
 */

const { test } = require('node:test');
const assert   = require('node:assert');

const { clampPortions, portionsMade, snapshotFor, isFinished, mealFor } = require('../api/meal-prep');

const TEMPLATE = { id: 7, name: 'Chicken and rice', mealType: 'dinner', notes: 'sunday batch' };
const SLOTS    = [{ name: 'rice', measure: '1 cup' }, { name: 'chicken', measure: '200 g' }];
const RESULT   = { totals: { kcal: 600, protein: 45, carbs: 60, fats: 18 }, skipped: [], counted: [] };

test('a batch freezes the macros it was made with', () => {
  const row = snapshotFor(TEMPLATE, SLOTS, RESULT, { portions: 3, preppedOn: '2026-08-09' });

  assert.equal(row.kcal, 600);
  assert.equal(row.protein, 45);
  assert.equal(row.portions, 3);
  assert.equal(row.portionsLeft, 3, 'a fresh batch has eaten none of itself');
  assert.equal(row.preppedOn, '2026-08-09');

  // The slots are copied in, not referenced. Editing the template afterwards
  // must not reach the portions already in the fridge.
  assert.deepEqual(JSON.parse(row.slots), SLOTS);
  SLOTS.push({ name: 'quinoa', measure: '2 cups' });
  assert.equal(JSON.parse(row.slots).length, 2, 'the batch did not follow the template');
  SLOTS.pop();
});

test('a batch carries its own name, so it outlives the template', () => {
  const row = snapshotFor(TEMPLATE, SLOTS, RESULT, { portions: 2 });
  assert.equal(row.name, 'Chicken and rice');
  assert.equal(row.templateId, 7, 'kept only to offer "prep this again"');

  // A template with no id — deleted, or never saved — still yields a valid row,
  // because the portions are real whatever happened to the recipe.
  const orphan = snapshotFor({ name: 'Leftovers', mealType: 'lunch' }, [], RESULT, { portions: 1 });
  assert.equal(orphan.templateId, null);
  assert.equal(orphan.name, 'Leftovers');
});

test('an unresolved slot leaves null, never a confident zero', () => {
  // The peanut butter case: no label, no USDA match, so it is absent from the
  // total. Writing 0 would make a batch that lost an ingredient look like one
  // that had none — the exact failure api/nutrition.js exists to avoid.
  const partial = { totals: { kcal: 0, protein: 0, carbs: 0, fats: 0 }, skipped: [{ name: 'peanut butter' }] };
  const row = snapshotFor(TEMPLATE, SLOTS, partial, { portions: 3 });
  assert.equal(row.kcal, null);
  assert.equal(row.protein, null);
});

test('portion counts are whole, bounded, and survive nonsense', () => {
  assert.equal(portionsMade(3), 3);
  assert.equal(portionsMade(0), 1, 'a batch of none is not a batch');
  assert.equal(portionsMade(-4), 1);
  assert.equal(portionsMade('five'), 1);
  assert.equal(portionsMade(999), 50, 'a typo guard, not a rule');
  assert.equal(portionsMade(2.6), 3);

  // Correcting the count: ate two, or threw the last one out.
  assert.equal(clampPortions(2, 4), 2);
  assert.equal(clampPortions(99, 4), 4, 'cannot invent portions that were never cooked');
  assert.equal(clampPortions(-3, 4), 0, 'and cannot owe anybody dinner');
  assert.equal(clampPortions('two', 4), 0, 'unparseable is none left, not NaN in the column');
});

test('finished is a state, not an error', () => {
  assert.equal(isFinished({ portionsLeft: 0 }), true);
  assert.equal(isFinished({ portionsLeft: 1 }), false);
  assert.equal(isFinished(null), true, 'nothing there is also nothing to eat');
});

test('eating one logs the frozen numbers, copied rather than recomputed', () => {
  const prep = {
    name: 'Chicken and rice', preppedOn: '2026-08-09', mealType: 'dinner',
    kcal: 600, protein: 45, carbs: 60, fats: 18,
    notes: 'sunday batch', provenance: 'label: rice',
  };
  const meal = mealFor(prep, { date: '2026-08-12', time: '12:30:00' });

  assert.equal(meal.calories, 600);
  assert.equal(meal.protein, 45);
  assert.equal(meal.date, '2026-08-12');
  assert.equal(meal.mealType, 'dinner', 'inherited from the batch when not overridden');
  // Names the batch it came from: three identical rows across three days are
  // otherwise indistinguishable, and which batch it was is the thing you want.
  assert.match(meal.description, /meal prep from 2026-08-09/);
  assert.match(meal.notes, /sunday batch/);
  assert.match(meal.notes, /label: rice/);

  // An override is honoured, but only to a real meal type.
  assert.equal(mealFor(prep, { mealType: 'lunch' }).mealType, 'lunch');
  assert.equal(mealFor(prep, { mealType: 'brunch' }).mealType, 'dinner', 'junk falls back, never lands in the enum');
});
