'use strict';

/**
 * Saved meals: the arithmetic has to be right, and where it can't be, it has to
 * say so.
 *
 * The shake this was built for is:
 *
 *     2 scoops protein powder      ← brand changes; label is authoritative
 *     1/2 cup whole milk           ← USDA knows this
 *     1/2 cup greek yogurt         ← USDA knows this
 *     1/2 cup frozen berries       ← USDA knows this
 *     2 spoonfuls peanut butter    ← "spoonful" is not a unit anywhere but this kitchen
 *     1 serving creatine           ← no macros at all
 *
 * Half of it cannot be resolved by any nutrition database, which is why slots
 * carry their own product labels. The other half should NOT carry labels, because
 * USDA's measured cup weights beat anything typed by hand.
 *
 * The rule inherited from nutrition.js and enforced below: a slot that cannot be
 * counted appears in `skipped`. It is never quietly worth zero — a shake missing
 * its peanut butter reads as a 400 kcal snack instead of a 600 kcal one, and a
 * coach acting on that number gives worse advice than one given no number.
 *
 * No network: every test here either uses labelled slots (offline by design) or
 * passes no apiKey, which must degrade to `skipped` rather than to silence.
 *
 * Run: node --test test/meal-template.test.js
 */

const { test } = require('node:test');
const assert   = require('node:assert');

const {
  macrosForTemplate, describe: describeMeal, provenance, normaliseSlots, slotsFromForm,
  servingsFor, normUnit, hasProduct,
} = require('../api/meal-template');

const labelled = (name, measure, product) => ({ name, measure, product });

// A tub of protein: 1 scoop = 120 kcal, 24 P, 3 C, 1.5 F.
const POWDER = { label: 'Gold Standard vanilla', per: 1, unit: 'scoop', kcal: 120, protein: 24, carbs: 3, fats: 1.5 };
// Peanut butter measured the way it is actually eaten.
const PB     = { label: 'Skippy chunky', per: 1, unit: 'spoonful', kcal: 190, protein: 7, carbs: 7, fats: 16 };

// ── unit handling ────────────────────────────────────────────────────────────

test('scoops, scoop and Scoops. are one unit', () => {
  assert.equal(normUnit('scoops'), 'scoop');
  assert.equal(normUnit('Scoops.'), 'scoop');
  assert.equal(normUnit(' SERVING '), 'serving');
});

test('a mass unit is not de-pluralised into nonsense', () => {
  // 'grams', 'lbs' and 'oz' are in the mass table under those exact spellings;
  // stripping the s would make 'lbs' -> 'lb' (fine) but 'grams' -> 'gram' (also
  // fine) while 'oz' must survive untouched. What must NOT happen is a unit
  // falling out of the table and silently becoming unconvertible.
  for (const u of ['g', 'grams', 'oz', 'lbs']) {
    assert.ok(servingsFor(`2 ${u}`, { per: 1, unit: 'g', kcal: 1 }) != null,
      `${u} lost its mass conversion`);
  }
});

test('"2 scoops" against a per-scoop label is two servings', () => {
  assert.equal(servingsFor('2 scoops', POWDER), 2);
});

test('a bare number means the label\'s own unit', () => {
  // "2" written against a per-scoop product is two scoops. Rejecting it would
  // reject the most natural way to write the line.
  assert.equal(servingsFor('2', POWDER), 2);
});

test('half a scoop is half a serving', () => {
  assert.equal(servingsFor('1/2 scoop', POWDER), 0.5);
});

test('a label written per 2 scoops divides correctly', () => {
  // Most tubs print macros per 2 scoops, not per 1. Getting this backwards
  // doubles every shake.
  const perTwo = { ...POWDER, per: 2, kcal: 240, protein: 48 };
  assert.equal(servingsFor('2 scoops', perTwo), 1);
  assert.equal(servingsFor('1 scoop',  perTwo), 0.5);
});

test('grams convert into a gram-based label', () => {
  const perGram = { per: 30, unit: 'g', kcal: 120 };
  assert.equal(servingsFor('60 g', perGram), 2);
  assert.equal(Math.round(servingsFor('1 oz', perGram) * 1000) / 1000, 0.945);
});

test('cups convert into a tablespoon-based label', () => {
  const perTbsp = { per: 1, unit: 'tbsp', kcal: 10 };
  // 1 cup = 236.588 ml, 1 tbsp = 14.787 ml -> 16 tbsp.
  assert.equal(Math.round(servingsFor('1 cup', perTbsp)), 16);
});

test('a cup against a per-scoop label is refused, not guessed', () => {
  // Nobody knows how many cups a scoop is. Inventing a factor here is exactly how
  // a log becomes fiction, so this must be null and surface as `skipped`.
  assert.equal(servingsFor('1/2 cup', POWDER), null);
});

test('"to taste" has no quantity and cannot be counted', () => {
  assert.equal(servingsFor('to taste', POWDER), null);
  assert.equal(servingsFor('', POWDER), null);
});

// ── what counts as a product ─────────────────────────────────────────────────

test('a brand name with no numbers is not a label', () => {
  // Treating this as a label would compute the slot as zero calories, which is
  // worse than looking the ingredient up generically.
  assert.equal(hasProduct({ name: 'x', product: { label: 'Skippy chunky' } }), false);
});

test('a label with a serving size and one macro is enough', () => {
  assert.equal(hasProduct({ name: 'x', product: { per: 1, unit: 'scoop', protein: 24 } }), true);
});

test('an all-zero label is a real label — creatine has no macros', () => {
  const creatine = { label: 'creatine monohydrate', per: 1, unit: 'serving', kcal: 0, protein: 0, carbs: 0, fats: 0 };
  assert.equal(hasProduct({ name: 'creatine', product: creatine }), true,
    'zero is a measured value, not a missing one');
});

// ── totals ───────────────────────────────────────────────────────────────────

test('labelled slots total exactly, with no network', async () => {
  const r = await macrosForTemplate([
    labelled('protein powder', '2 scoops', POWDER),
    labelled('peanut butter',  '2 spoonfuls', PB),
  ]);   // no apiKey, no IngredientMatch — nothing here needs one
  assert.equal(r.totals.kcal,    120 * 2 + 190 * 2);
  assert.equal(r.totals.protein, 24 * 2 + 7 * 2);
  assert.equal(r.totals.fats,    1.5 * 2 + 16 * 2);
  assert.deepEqual(r.skipped, []);
  assert.equal(r.coverage, 100);
});

test('servings scale the whole meal', async () => {
  const one  = await macrosForTemplate([labelled('protein powder', '2 scoops', POWDER)]);
  const half = await macrosForTemplate([labelled('protein powder', '2 scoops', POWDER)], { servings: 0.5 });
  assert.equal(half.totals.kcal, one.totals.kcal / 2);
  assert.equal(half.servings, 0.5);
});

test('a slot that cannot be converted is reported, not counted as zero', async () => {
  const r = await macrosForTemplate([
    labelled('protein powder', '2 scoops', POWDER),
    labelled('peanut butter',  '1/2 cup',  PB),   // cup vs spoonful — unconvertible
  ]);
  assert.equal(r.totals.kcal, 240, 'the convertible slot still counts');
  assert.equal(r.skipped.length, 1);
  assert.equal(r.skipped[0].name, 'peanut butter');
  assert.match(r.skipped[0].reason, /cannot be converted/);
  assert.equal(r.coverage, 50);
});

test('unlabelled slots with no USDA key are skipped, not silently dropped', async () => {
  // This is the failure that matters most: without the key the milk, yogurt and
  // berries have no macros. Returning 240 kcal for a shake and saying nothing
  // would be a confidently wrong number.
  const r = await macrosForTemplate([
    labelled('protein powder', '2 scoops', POWDER),
    { name: 'whole milk',     measure: '1/2 cup' },
    { name: 'greek yogurt',   measure: '1/2 cup' },
    { name: 'frozen berries', measure: '1/2 cup' },
  ]);
  assert.equal(r.totals.kcal, 240);
  assert.equal(r.skipped.length, 3);
  for (const s of r.skipped) assert.match(s.reason, /USDA lookup is unavailable/);
});

test('the USDA half is delegated, and its skips come back too', async () => {
  // Stub IngredientMatch so the engine's cache path resolves offline. This proves
  // the two halves are summed rather than one replacing the other.
  const rows = {
    'whole milk':     { query: 'whole milk',     fdcId: 1, foodName: 'Milk, whole', dataType: 'SR Legacy', kcal: 61, protein: 3.2, carbs: 4.8, fats: 3.3 },
    'greek yogurt':   { query: 'greek yogurt',   fdcId: 2, foodName: 'Yogurt, Greek, plain', dataType: 'SR Legacy', kcal: 59, protein: 10, carbs: 3.6, fats: 0.4 },
    'frozen berries': { query: 'frozen berries', fdcId: null },   // known-unmatchable
  };
  const IngredientMatch = {
    findOne: async ({ where }) => rows[where.query] || null,
    create:  async () => {},
  };

  const r = await macrosForTemplate([
    labelled('protein powder', '2 scoops', POWDER),
    { name: 'whole milk',     measure: '1/2 cup' },
    { name: 'greek yogurt',   measure: '1/2 cup' },
    { name: 'frozen berries', measure: '1/2 cup' },
  ], { IngredientMatch, apiKey: 'test-key' });

  assert.ok(r.totals.kcal > 240, 'the milk and yogurt were added to the powder');
  assert.ok(r.totals.protein > 48);
  assert.equal(r.skipped.length, 1, 'only the unmatchable berries');
  assert.equal(r.skipped[0].name, 'frozen berries');
  assert.ok(r.counted.some(c => c.basis === 'product-label'), 'the label slot is in counted');
  assert.ok(r.counted.some(c => c.dataType === 'SR Legacy'), 'the USDA slots are in counted');
});

test('an empty template totals zero without claiming coverage', async () => {
  const r = await macrosForTemplate([]);
  assert.equal(r.totals.kcal, 0);
  assert.equal(r.coverage, 0);
});

test('nameless rows are ignored — an empty form row is not an ingredient', async () => {
  const r = await macrosForTemplate([{ name: '', measure: '1 cup' }, { name: null }]);
  assert.equal(r.counted.length, 0);
  assert.equal(r.skipped.length, 0);
});

// ── what gets written onto the meal ──────────────────────────────────────────

test('the description names the products actually used', async () => {
  const d = describeMeal('Protein Shake', [
    labelled('protein powder', '2 scoops', POWDER),
    { name: 'frozen berries', measure: '1/2 cup' },
  ]);
  assert.match(d, /Protein Shake/);
  assert.match(d, /2 scoops protein powder \(Gold Standard vanilla\)/,
    'which tub it was is the thing that changes, so it belongs in the record');
  assert.match(d, /1\/2 cup frozen berries/);
});

test('a fractional serving is visible in the description', async () => {
  assert.match(describeMeal('Protein Shake', [], 0.5), /0\.5× Protein Shake/);
});

test('provenance states outright what was NOT counted', async () => {
  const r = await macrosForTemplate([
    labelled('protein powder', '2 scoops', POWDER),
    labelled('peanut butter',  '1/2 cup',  PB),
  ]);
  const note = provenance(r);
  assert.match(note, /NOT counted/);
  assert.match(note, /totals are low/i,
    'the direction of the error matters — a reader must know the number is an underestimate');
  assert.match(note, /peanut butter/);
  assert.match(note, /2 × Gold Standard vanilla/, 'and which tub produced the number that IS there');
});

// ── form round-trip ──────────────────────────────────────────────────────────

test('normaliseSlots keeps only what the model understands', () => {
  const out = normaliseSlots([
    { name: '  protein powder ', measure: ' 2 scoops ', product: { label: 'X', per: '1', unit: 'scoop', kcal: '120', protein: '24', carbs: '', fats: null }, junk: 'dropped' },
    { name: 'whole milk', measure: '1/2 cup' },
    { name: '   ' },
  ]);
  assert.equal(out.length, 2, 'the blank row is dropped');
  assert.equal(out[0].name, 'protein powder');
  assert.equal(out[0].product.per, 1);
  assert.equal(out[0].product.kcal, 120);
  assert.equal(out[0].product.carbs, null, 'a blank macro stays blank rather than becoming 0');
  assert.equal(out[0].junk, undefined);
  assert.equal(out[1].product, undefined, 'a slot with no label carries no product');
});

test('a one-ingredient form posts a string, not an array', () => {
  // body-parser does not wrap a single occurrence in an array. Iterating the raw
  // value would walk the name character by character and produce one slot per
  // letter — the classic parallel-array form bug.
  const out = slotsFromForm({
    slotName: 'protein powder', slotMeasure: '2 scoops',
    prodPer: '1', prodUnit: 'scoop', prodKcal: '120', prodProtein: '24', prodCarbs: '', prodFats: '',
    prodLabel: 'Gold Standard',
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'protein powder');
  assert.equal(out[0].product.per, 1);
  assert.equal(out[0].product.kcal, 120);
});

test('rows stay aligned when only some of them carry a label', async () => {
  // The product inputs are hidden rather than absent so that every row posts a
  // value for every field. If a row could skip them, this test's yogurt would end
  // up wearing the peanut butter's label.
  const out = slotsFromForm({
    slotName:    ['protein powder', 'greek yogurt', 'peanut butter'],
    slotMeasure: ['2 scoops',       '1/2 cup',      '2 spoonfuls'],
    prodLabel:   ['Gold Standard',  '',             'Skippy chunky'],
    prodPer:     ['1',              '',             '1'],
    prodUnit:    ['scoop',          '',             'spoonful'],
    prodKcal:    ['120',            '',             '190'],
    prodProtein: ['24',             '',             '7'],
    prodCarbs:   ['3',              '',             '7'],
    prodFats:    ['1.5',            '',             '16'],
  });
  assert.equal(out.length, 3);
  assert.equal(out[0].product.label, 'Gold Standard');
  assert.equal(out[1].product, undefined, 'the middle row has no label and must not inherit one');
  assert.equal(out[2].product.label, 'Skippy chunky');
  assert.equal(out[2].product.unit, 'spoonful');

  // And it totals to the labelled rows only, with the yogurt reported as missing.
  const r = await macrosForTemplate(out);
  assert.equal(r.totals.kcal, 240 + 380);
  assert.deepEqual(r.skipped.map(s => s.name), ['greek yogurt']);
});

test('a long ingredient list survives qs turning the array into an object', () => {
  // Past 20 entries qs stops producing an array and hands back { '0': …, '1': … }.
  const n = 25;
  const idx = v => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), v(i)]));
  const out = slotsFromForm({
    slotName:    idx(i => `ing${i}`),
    slotMeasure: idx(() => '1 g'),
    prodPer:     idx(() => ''),
  });
  assert.equal(out.length, n, 'the whole list must survive, not collapse to one slot');
  assert.equal(out[0].name, 'ing0');
  assert.equal(out[24].name, 'ing24', 'and stay in order — 10 must not sort before 2');
});

test('an empty form yields no slots rather than one blank one', () => {
  assert.deepEqual(slotsFromForm({}), []);
  assert.deepEqual(slotsFromForm({ slotName: '', slotMeasure: '' }), []);
});

test('a blank macro is not turned into zero', async () => {
  // "" -> 0 would make a tub with unrecorded carbs look carb-free, which reads as
  // a measurement rather than as a gap.
  const [slot] = normaliseSlots([{ name: 'x', measure: '1 scoop', product: { per: 1, unit: 'scoop', kcal: 100, protein: '', carbs: '', fats: '' } }]);
  assert.equal(slot.product.protein, null);
  const r = await macrosForTemplate([slot]);
  assert.equal(r.totals.kcal, 100);
  assert.equal(r.totals.protein, 0, 'an unknown macro contributes nothing to the sum');
});
