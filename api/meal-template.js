'use strict';
/**
 * meal-template.js — saved meals whose INGREDIENTS are stable but whose PRODUCTS
 * are not.
 *
 * A shake is the same shake every morning: two scoops of protein, half a cup of
 * yogurt, half a cup of berries. What changes is which tub of protein was on sale.
 * Those are not the same fact and they should not be edited together, so a template
 * separates them:
 *
 *   the SLOT     — "protein powder", "2 scoops"   (written once, rarely touched)
 *   the PRODUCT  — the tub currently in the cupboard, with the macros off its label
 *
 * Swapping brands is then a one-field edit on one slot, and every future log is
 * right. Nothing else about the meal has to be re-entered.
 *
 * Why a per-slot label instead of just looking everything up in USDA:
 *
 *   - Supplements are not in the curated datasets in any useful form. A search for
 *     "protein powder" returns a branded soy isolate at 90 kcal/scoop when the tub
 *     in the kitchen is 120 — and USDA's scoop is not the tub's scoop either. The
 *     number would be confidently wrong, which nutrition.js exists to avoid.
 *   - Real foods (milk, yogurt, berries) ARE well covered, and their cup weights
 *     come from USDA's own portion data. Those slots should keep using it.
 *   - Kitchen units are not units. "2 spoonfuls of peanut butter" has no gram
 *     conversion anywhere in USDA, but it is perfectly well defined for the person
 *     who owns the spoon. A label lets them define it once.
 *
 * So a slot with a product is computed here, offline and exactly; a slot without
 * one goes to the USDA engine unchanged. The two are summed, and — following the
 * rule the rest of nutrition does — anything that could not be counted comes back
 * in `skipped` rather than being quietly treated as zero.
 */

const { macrosForIngredients, parseQuantity, MASS_G, VOL_ML } = require('./nutrition');

const MACROS = ['kcal', 'protein', 'carbs', 'fats'];

/**
 * "scoops" and "scoop" and "Scoops." are the same unit. So are "servings" and
 * "serving". Kitchen units are written however they are spoken, and a template
 * that only matched the exact spelling would silently fall through to USDA.
 */
function normUnit(unit) {
  const u = String(unit || '').toLowerCase().replace(/\./g, '').trim();
  // Only strip a plural 's' where doing so leaves something. 's' alone is not a
  // unit, and 'oz'/'lbs'/'grams' are handled by the mass table either way.
  if (u.length > 1 && u.endsWith('s') && !MASS_G[u] && !VOL_ML[u]) return u.slice(0, -1);
  return u;
}

/** Both units are masses -> convert exactly. Returns a factor or null. */
function massRatio(from, to) {
  const a = MASS_G[from], b = MASS_G[to];
  return a && b ? a / b : null;
}

/** Both units are volumes -> convert exactly. Cups to tablespoons needs no food. */
function volRatio(from, to) {
  const a = VOL_ML[from], b = VOL_ML[to];
  return a && b ? a / b : null;
}

/**
 * How many of the product's servings does this slot's measure amount to?
 *
 * Returns a number, or null when the two cannot be compared — which is a real
 * answer, not a failure to try. "1/2 cup" against a label written per scoop is not
 * convertible without knowing the scoop, and guessing is how a log becomes fiction.
 */
function servingsFor(measure, product) {
  const qty = parseQuantity(measure);
  if (!qty) return null;

  const per = Number(product.per);
  if (!per || per <= 0) return null;

  const want = normUnit(qty.unit);
  const have = normUnit(product.unit);

  // A bare number written against a label means that many of the label's own unit:
  // "2" on a per-scoop product is two scoops. This is what people actually mean,
  // and the alternative is rejecting the most natural way to write it.
  if (!want) return qty.value / per;

  if (want === have) return qty.value / per;

  const mass = massRatio(want, have);
  if (mass) return (qty.value * mass) / per;

  const vol = volRatio(want, have);
  if (vol) return (qty.value * vol) / per;

  return null;
}

/**
 * Macros for one slot that carries a product label. Offline and exact.
 * Returns { macros, detail } or { error }.
 */
function macrosFromProduct(slot) {
  const p = slot.product;
  const servings = servingsFor(slot.measure, p);
  if (servings == null) {
    return { error: `"${slot.measure || 'no quantity'}" cannot be converted to ${p.unit || 'the label unit'}` };
  }
  const macros = {};
  for (const k of MACROS) macros[k] = (Number(p[k]) || 0) * servings;
  return {
    macros,
    detail: {
      name: slot.name,
      matchedTo: p.label || 'label',
      dataType: 'label',
      servings: Math.round(servings * 100) / 100,
      basis: 'product-label',
    },
  };
}

/** A slot is only usable if it says what it is. */
function validSlot(s) {
  return s && typeof s === 'object' && String(s.name || '').trim();
}

/** A product must carry a serving size and at least one macro, or it says nothing. */
function hasProduct(slot) {
  const p = slot.product;
  if (!p || typeof p !== 'object') return false;
  if (!Number(p.per)) return false;
  return MACROS.some(k => p[k] != null && p[k] !== '');
}

/**
 * Total a template's slots.
 *
 * `servings` scales the whole thing — half a shake is half of everything. The USDA
 * half is delegated wholesale to macrosForIngredients so that engine stays the one
 * place that knows about grams, portions and datasets.
 *
 * Requires { IngredientMatch, apiKey } only when at least one slot lacks a product;
 * a template where every slot is labelled needs no network and no USDA key at all.
 */
async function macrosForTemplate(slots, { IngredientMatch, apiKey, servings = 1 } = {}) {
  const scale = Number(servings) > 0 ? Number(servings) : 1;
  const totals = { kcal: 0, protein: 0, carbs: 0, fats: 0 };
  const counted = [];
  const skipped = [];
  const needsLookup = [];
  let approximate = false;

  for (const slot of Array.isArray(slots) ? slots : []) {
    if (!validSlot(slot)) continue;
    if (!hasProduct(slot)) { needsLookup.push({ name: slot.name, measure: slot.measure }); continue; }

    const r = macrosFromProduct(slot);
    if (r.error) { skipped.push({ name: slot.name, reason: r.error }); continue; }
    for (const k of MACROS) totals[k] += r.macros[k];
    counted.push(r.detail);
  }

  if (needsLookup.length) {
    // No key means the unlabelled slots cannot be resolved. Say so per slot rather
    // than returning a total that silently omits half the meal.
    if (!apiKey || !IngredientMatch) {
      for (const ing of needsLookup) {
        skipped.push({ name: ing.name, reason: 'no product label set, and USDA lookup is unavailable' });
      }
    } else {
      const usda = await macrosForIngredients(needsLookup, { IngredientMatch, apiKey });
      totals.kcal    += usda.totals.kcal;
      totals.protein += usda.totals.protein;
      totals.carbs   += usda.totals.carbs;
      totals.fats    += usda.totals.fats;
      counted.push(...usda.counted);
      skipped.push(...usda.skipped);
      if (usda.approximate) approximate = true;
    }
  }

  return {
    totals: {
      kcal:    Math.round(totals.kcal * scale),
      protein: Math.round(totals.protein * scale * 10) / 10,
      carbs:   Math.round(totals.carbs   * scale * 10) / 10,
      fats:    Math.round(totals.fats    * scale * 10) / 10,
    },
    counted, skipped, approximate, servings: scale,
    coverage: counted.length + skipped.length
      ? Math.round((counted.length / (counted.length + skipped.length)) * 100)
      : 0,
  };
}

/** "2 scoops protein powder + 1/2 cup greek yogurt + …" — what the meal WAS. */
function describe(name, slots, servings = 1) {
  const parts = (Array.isArray(slots) ? slots : [])
    .filter(validSlot)
    .map(s => {
      const product = s.product?.label ? ` (${s.product.label})` : '';
      return `${s.measure ? s.measure + ' ' : ''}${s.name}${product}`;
    });
  const head = Number(servings) !== 1 ? `${servings}× ${name}` : name;
  return parts.length ? `${head} — ${parts.join(', ')}` : head;
}

/**
 * The note stored on the logged meal.
 *
 * A total is only as good as what went into it, and six months later nobody
 * remembers which tub was in the cupboard. Recording the matches means a wrong
 * number can be explained instead of merely doubted — and an uncounted ingredient
 * is stated outright, because that is the difference between a light meal and a
 * missing one.
 */
function provenance(result) {
  const lines = [];
  if (result.counted.length) {
    lines.push('Counted:');
    for (const c of result.counted) {
      const how = c.basis === 'product-label'
        ? `${c.servings} × ${c.matchedTo}`
        : `${c.grams}g ${c.matchedTo}${c.dataType ? ` [${c.dataType}]` : ''}`;
      lines.push(`  • ${c.name} → ${how}`);
    }
  }
  if (result.skipped.length) {
    lines.push('NOT counted (totals are low by these):');
    for (const s of result.skipped) lines.push(`  • ${s.name} — ${s.reason}`);
  }
  if (result.approximate) {
    lines.push('Some quantities were converted by volume-as-water and are approximate.');
  }
  return lines.join('\n');
}

/** Slots arrive from a form or from JSON; keep only what the model understands. */
function normaliseSlots(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.filter(validSlot).map(s => {
    const out = { name: String(s.name).trim(), measure: String(s.measure || '').trim() };
    if (hasProduct(s)) {
      const p = s.product;
      out.product = {
        label: String(p.label || '').trim(),
        per:   Number(p.per),
        unit:  String(p.unit || '').trim(),
      };
      for (const k of MACROS) {
        out.product[k] = p[k] == null || p[k] === '' ? null : Number(p[k]);
      }
    }
    return out;
  });
}

/**
 * Read slots out of a posted form.
 *
 * A repeating row group in plain HTML is parallel arrays — every row contributes
 * one entry to slotName, one to slotMeasure, one to prodPer and so on, and the
 * rows are joined back together by index. Two things make that fragile enough to
 * be worth doing here, under test, rather than inline in a route:
 *
 *   1. body-parser gives a STRING, not an array, when a field appears once. A
 *      single-ingredient meal would otherwise iterate its name character by
 *      character.
 *   2. The alignment only holds if every row submits every field. The product
 *      inputs are hidden, not absent, precisely so they still post an empty
 *      string and keep the indices lined up — a row that skipped them would shift
 *      every later row's label onto the wrong ingredient.
 *
 * A row whose `per` is blank has no label and is left for USDA. That is the
 * difference between "I don't know" and "zero", and it must not be flattened.
 */
function slotsFromForm(body) {
  const arr = k => {
    const v = body[k];
    if (Array.isArray(v)) return v;
    if (v == null) return [];
    // qs (which express.urlencoded uses with extended:true) turns an array longer
    // than its arrayLimit of 20 into an object keyed by index. Without this the
    // 21st ingredient would collapse the whole list into a single slot.
    if (typeof v === 'object') return Object.keys(v).sort((a, b) => a - b).map(i => v[i]);
    return [v];
  };
  const names = arr('slotName');
  return normaliseSlots(names.map((name, i) => {
    const at = k => arr(k)[i];
    const slot = { name, measure: at('slotMeasure') };
    const per = at('prodPer');
    if (per !== undefined && String(per).trim() !== '') {
      slot.product = {
        label:   at('prodLabel'),
        per,
        unit:    at('prodUnit'),
        kcal:    at('prodKcal'),
        protein: at('prodProtein'),
        carbs:   at('prodCarbs'),
        fats:    at('prodFats'),
      };
    }
    return slot;
  }));
}

module.exports = {
  macrosForTemplate, describe, provenance, normaliseSlots, slotsFromForm,
  // exported for tests
  servingsFor, normUnit, hasProduct,
};
