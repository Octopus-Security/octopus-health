'use strict';
/**
 * nutrition.js — resolve recipe ingredients to macros using USDA FoodData Central.
 *
 * Why USDA rather than asking a model: it is free (no per-call cost), and for known
 * foods it is measured data instead of an estimate. The cost moves from money to
 * matching — which is where all the real difficulty in this file lives.
 *
 * Two matching problems, and both can be wrong in ways that look right:
 *
 *   1. NAME -> FOOD RECORD. "heavy cream" matches dozens of entries across the
 *      Foundation, SR Legacy and Branded datasets, and the top hit is frequently a
 *      branded product whose macros differ substantially. We prefer the curated
 *      datasets and cache the choice, so a bad match is corrected once rather than
 *      re-guessed on every log.
 *
 *   2. QUANTITY -> GRAMS. "1 1/2 cups" of flour and of water are different masses.
 *      USDA ships per-food portion weights, so where they exist we use the food's
 *      own numbers. Where they do not, we fall back to volume-as-water and MARK THE
 *      RESULT APPROXIMATE rather than pretending otherwise.
 *
 * The governing rule: an unmatched or unconvertible ingredient is reported, never
 * silently counted as zero. A cheesecake missing its cream should say so, not claim
 * 400 calories — nutrition coaching reads these totals as fact.
 */

const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';

// USDA nutrient ids. Stable across datasets.
const N_KCAL    = 1008;
const N_PROTEIN = 1003;
const N_FAT     = 1004;
const N_CARB    = 1005;

// Curated datasets first. Branded is a last resort: it is user-submitted label data,
// so a search for "butter" can return a specific brand's cookie before real butter.
const DATASET_RANK = { 'Foundation': 0, 'SR Legacy': 1, 'Survey (FNDDS)': 2, 'Branded': 3 };

// ── Quantity parsing ─────────────────────────────────────────────────────────

// Mass units convert exactly, with no food-specific knowledge needed.
const MASS_G = { g: 1, gram: 1, grams: 1, kg: 1000, oz: 28.3495, ounce: 28.3495, ounces: 28.3495, lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592 };

// Volume in millilitres. Converting ml to grams needs the food's density, which is
// exactly what USDA portion data provides — these are only used for the fallback.
const VOL_ML = { tsp: 4.929, teaspoon: 4.929, teaspoons: 4.929, tbsp: 14.787, tablespoon: 14.787, tablespoons: 14.787, cup: 236.588, cups: 236.588, ml: 1, l: 1000, litre: 1000, liter: 1000, 'fl oz': 29.5735, pint: 473.176, quart: 946.353 };

/**
 * "1 1/2 cups" -> { value: 1.5, unit: 'cups' }
 *
 * Handles mixed fractions ("1 1/2"), bare fractions ("1/2"), decimals, unicode
 * fractions, and ranges ("2-3", taking the midpoint). Returns null when there is
 * no number at all — "to taste" and "a pinch" are not quantities, and guessing a
 * gram weight for them would be inventing data.
 */
function parseQuantity(measure) {
  if (!measure) return null;
  let str = String(measure).toLowerCase().trim();

  // Unicode fractions appear in scraped recipes.
  const UNI = { '¼': ' 1/4', '½': ' 1/2', '¾': ' 3/4', '⅓': ' 1/3', '⅔': ' 2/3', '⅛': ' 1/8' };
  for (const [k, v] of Object.entries(UNI)) str = str.split(k).join(v);

  // Drop parenthetical asides: "2 1/4 tsp (1 packet)" -> "2 1/4 tsp"
  str = str.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

  // Range -> midpoint. "2-3 cloves" is 2.5 cloves; picking an end would bias.
  const range = str.match(/^(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (range) {
    const v = (parseFloat(range[1]) + parseFloat(range[2])) / 2;
    return { value: v, unit: (range[3] || '').trim(), approximate: true };
  }

  // Mixed fraction: "1 1/2 cups"
  let m = str.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  if (m) return { value: parseInt(m[1]) + parseInt(m[2]) / parseInt(m[3]), unit: (m[4] || '').trim() };

  // Bare fraction: "1/2 cup"
  m = str.match(/^(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  if (m) return { value: parseInt(m[1]) / parseInt(m[2]), unit: (m[3] || '').trim() };

  // Plain number: "4 1/2" already handled above; "2 tsp", "3", "0.5 cup"
  m = str.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (m) return { value: parseFloat(m[1]), unit: (m[2] || '').trim() };

  return null;
}

/** Normalise unit spelling so 'Tbsp.' and 'tablespoons' hit the same table entry. */
function cleanUnit(unit) {
  return String(unit || '').toLowerCase().replace(/\./g, '').trim();
}

// ── USDA client ──────────────────────────────────────────────────────────────

async function fdc(path, params, apiKey) {
  const url = new URL(FDC_BASE + path);
  url.searchParams.set('api_key', apiKey);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`FDC ${res.status} on ${path}`);
  return res.json();
}

function nutrientsFrom(food) {
  const out = { kcal: null, protein: null, carbs: null, fats: null };
  for (const n of food.foodNutrients || []) {
    // Search results and detail responses nest this differently.
    const id  = n.nutrientId ?? n.nutrient?.id;
    const val = n.value ?? n.amount;
    if (val == null) continue;
    if (id === N_KCAL)    out.kcal    = val;
    if (id === N_PROTEIN) out.protein = val;
    if (id === N_CARB)    out.carbs   = val;
    if (id === N_FAT)     out.fats    = val;
  }
  return out;
}

/**
 * Strip a recipe ingredient down to something searchable.
 * "active dry yeast (1 packet)" -> "active dry yeast"
 * "large eggs, beaten"          -> "large eggs"
 */
function searchTerm(name) {
  return String(name)
    .replace(/\([^)]*\)/g, ' ')
    .split(',')[0]
    .replace(/\b(fresh|frozen|chopped|minced|diced|sliced|melted|softened|beaten|packed|divided|optional|to taste|room temperature)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Resolution ───────────────────────────────────────────────────────────────

/**
 * Find the best USDA food for an ingredient name, using the cache first.
 * Returns { fdcId, foodName, dataType, kcal, protein, carbs, fats } per 100g, or null.
 */
async function resolveFood(name, { IngredientMatch, apiKey }) {
  const query = searchTerm(name).toLowerCase();
  if (!query) return null;

  const cached = await IngredientMatch.findOne({ where: { query } });
  // A confirmed row is authoritative — never re-resolve a human decision. An
  // unconfirmed row with a null fdcId means "we looked and found nothing", which is
  // also worth remembering so we do not re-query it every time.
  if (cached) {
    if (!cached.fdcId) return null;
    return { fdcId: cached.fdcId, foodName: cached.foodName, dataType: cached.dataType,
             kcal: cached.kcal, protein: cached.protein, carbs: cached.carbs, fats: cached.fats };
  }

  let best = null;
  try {
    const r = await fdc('/foods/search', {
      query,
      dataType: 'Foundation,SR Legacy,Survey (FNDDS),Branded',
      pageSize: 10,
    }, apiKey);
    const foods = r.foods || [];
    // Rank by dataset quality, then by USDA's own relevance ordering.
    foods.sort((a, b) => (DATASET_RANK[a.dataType] ?? 9) - (DATASET_RANK[b.dataType] ?? 9));
    best = foods.find(f => {
      const n = nutrientsFrom(f);
      return n.kcal != null || n.protein != null;   // useless without macros
    }) || null;
  } catch (e) {
    // A network failure must not be cached as "no such food".
    throw e;
  }

  if (!best) {
    await IngredientMatch.create({ query, fdcId: null }).catch(() => {});
    return null;
  }

  const n = nutrientsFrom(best);
  const row = { query, fdcId: best.fdcId, foodName: best.description, dataType: best.dataType, ...n };
  await IngredientMatch.create(row).catch(() => {});
  return { fdcId: best.fdcId, foodName: best.description, dataType: best.dataType, ...n };
}

/**
 * Convert a parsed quantity to grams for a specific food.
 *
 * Order of preference:
 *   1. Mass units — exact, no food knowledge needed.
 *   2. The food's own USDA portion weights — "1 cup" of THIS food.
 *   3. Volume treated as water. Marked approximate, because flour is ~0.53 g/ml
 *      and honey ~1.42, so this can be out by a factor of three.
 */
async function toGrams(qty, food, { apiKey }) {
  const unit = cleanUnit(qty.unit);

  if (!unit) {
    // A bare count: "3 eggs". Only USDA portion data can turn that into grams.
    const g = await portionGrams(food, qty.value, '', { apiKey });
    return g ? { grams: g, approximate: !!qty.approximate, basis: 'usda-portion' } : null;
  }

  for (const [u, factor] of Object.entries(MASS_G)) {
    if (unit === u) return { grams: qty.value * factor, approximate: !!qty.approximate, basis: 'mass' };
  }

  const p = await portionGrams(food, qty.value, unit, { apiKey });
  if (p) return { grams: p, approximate: !!qty.approximate, basis: 'usda-portion' };

  const ml = VOL_ML[unit];
  if (ml) return { grams: qty.value * ml, approximate: true, basis: 'volume-as-water' };

  return null;
}

/** Look for a USDA foodPortion matching this unit; returns grams or null. */
async function portionGrams(food, value, unit, { apiKey }) {
  if (!food?.fdcId) return null;
  try {
    const detail = await fdc(`/food/${food.fdcId}`, {}, apiKey);
    const portions = detail.foodPortions || [];
    if (!portions.length) return null;

    const want = unit || '';
    const hit = portions.find(p => {
      const pu = cleanUnit(p.measureUnit?.name || p.modifier || '');
      if (!want) return pu === 'undetermined' || !pu || /each|whole|medium|large/.test(pu);
      return pu === want || pu.startsWith(want) || want.startsWith(pu);
    });
    if (!hit || !hit.gramWeight) return null;
    // gramWeight is for hit.amount of that unit, usually 1.
    const per = hit.gramWeight / (hit.amount || 1);
    return per * value;
  } catch {
    return null;   // detail lookup is best-effort; the caller falls back
  }
}

/**
 * Resolve a normalised ingredient list to summed macros.
 *
 * Ingredients are the canonical { name, measure } shape shopper's API returns.
 * Returns totals plus an explicit account of what could NOT be counted — the
 * caller is expected to surface that, not hide it.
 */
async function macrosForIngredients(ingredients, { IngredientMatch, apiKey }) {
  const totals   = { kcal: 0, protein: 0, carbs: 0, fats: 0 };
  const counted  = [];
  const skipped  = [];
  let approximate = false;

  for (const ing of ingredients || []) {
    const name = ing?.name;
    if (!name) continue;

    let food;
    try {
      food = await resolveFood(name, { IngredientMatch, apiKey });
    } catch (e) {
      skipped.push({ name, reason: `USDA lookup failed: ${e.message}` });
      continue;
    }
    if (!food) { skipped.push({ name, reason: 'no USDA match' }); continue; }

    const qty = parseQuantity(ing.measure);
    if (!qty) { skipped.push({ name, reason: ing.measure ? `could not parse "${ing.measure}"` : 'no quantity recorded' }); continue; }

    const conv = await toGrams(qty, food, { apiKey });
    if (!conv) { skipped.push({ name, reason: `no gram conversion for "${qty.unit || 'count'}"` }); continue; }
    if (conv.approximate || conv.basis === 'volume-as-water') approximate = true;

    const f = conv.grams / 100;   // USDA macros are per 100 g
    totals.kcal    += (food.kcal    || 0) * f;
    totals.protein += (food.protein || 0) * f;
    totals.carbs   += (food.carbs   || 0) * f;
    totals.fats    += (food.fats    || 0) * f;

    counted.push({ name, matchedTo: food.foodName, dataType: food.dataType,
                   grams: Math.round(conv.grams), basis: conv.basis });
  }

  return {
    // Rounded because a tenth of a gram of protein is false precision on top of a
    // volume-as-water guess.
    totals: {
      kcal:    Math.round(totals.kcal),
      protein: Math.round(totals.protein * 10) / 10,
      carbs:   Math.round(totals.carbs   * 10) / 10,
      fats:    Math.round(totals.fats    * 10) / 10,
    },
    counted, skipped, approximate,
    coverage: counted.length + skipped.length
      ? Math.round((counted.length / (counted.length + skipped.length)) * 100)
      : 0,
  };
}

module.exports = { macrosForIngredients, parseQuantity, searchTerm, resolveFood, MASS_G, VOL_ML };
