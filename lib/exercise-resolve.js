'use strict';

/**
 * exercise-resolve.js — which exercise definition does a logged NAME mean?
 *
 * Used by the muscle-volume report (api/volume.js) and the Fix exercises page
 * (api/exercise-fix.js) so "Bench Press" is not "Not in your library" while
 * "Barbell Bench Press" sits in it. Order, first CREDITED hit wins (a row with
 * no muscles is remembered, and returned only if nothing better turns up):
 *
 *   1. exerciseId      the set's own link
 *   2. exact name      case-insensitive
 *   3. canonicalKey    plurals and punctuation (api/exercise-names.js)
 *   4. the account's ExerciseAlias rows ("when I say X I mean Y")
 *   5. the static alias table (lib/exercise-aliases.js)
 *   6. a conservative fallback: equipment words and shorthand (DB, BB) removed,
 *      word ORDER ignored, and it must name exactly ONE exercise.
 *
 * The fallback never crosses a variant (iso / single-arm / single-leg are their
 * own exercises), never resolves a one-word movement ("Row", "Curl"), and gives
 * up when two exercises fit, because "BB Rows" fits a bent-over row and an
 * upright row and they work different muscles. A near name is a question for
 * the Fix page, not a guess here.
 */

const M = require('./muscles');
const { canonicalKey, baseKey, variantSig, variantsDiffer } = require('../api/exercise-names');
const { normKey, EXERCISE_ALIASES } = require('./exercise-aliases');

const ABBREV = { db: 'dumbbell', kb: 'kettlebell', bb: 'barbell', bw: 'bodyweight', flye: 'fly', flie: 'fly', tri: 'tricep', bi: 'bicep' };
const lower = (s) => String(s == null ? '' : s).toLowerCase();
const muscleList = (d) => (d ? M.normalize(d.primaryMuscles).muscles : []);
const hasMuscles = (d) => muscleList(d).length > 0 && d.category !== 'recovery';

/** Movement words, sorted: equipment and shorthand removed, order ignored. */
function wordSet(name) {
  const expanded = canonicalKey(name).split(' ').map(w => ABBREV[w] || w).join(' ');
  return baseKey(expanded).split(' ').filter(Boolean).sort().join(' ');
}

const musclesKey = (d) => muscleList(d).slice().sort().join(',');

/**
 * @param {object[]} defs            this account's ExerciseDefinition rows
 * @param {object} [opts]
 * @param {Map|object} [opts.published]  catalogue entries by lowercase name
 * @param {Map|object} [opts.aliases]    this account's ExerciseAlias: canonicalKey -> meant name
 * @returns {(name:string, exerciseId?:any) => object|null}
 */
function makeResolver(defs, opts = {}) {
  const published = opts.published instanceof Map ? opts.published : new Map(Object.entries(opts.published || {}));
  const aliases = opts.aliases instanceof Map ? opts.aliases : new Map(Object.entries(opts.aliases || {}));
  const byId = new Map();
  const byLower = new Map();
  const byCanon = new Map();
  for (const d of defs) {
    byId.set(d.id, d);
    if (!byLower.has(lower(d.name))) byLower.set(lower(d.name), d);
    const k = canonicalKey(d.name);
    if (!byCanon.has(k)) byCanon.set(k, d);
  }
  const named = (n) => byLower.get(lower(n)) || byCanon.get(canonicalKey(n)) || published.get(lower(n)) || null;

  // Candidate pool for the fallback: this account's rows, then catalogue entries it does not hold.
  const pool = defs.slice();
  for (const p of published.values()) if (!byLower.has(lower(p.name))) pool.push(p);
  const bySet = new Map();
  for (const d of pool) {
    if (!hasMuscles(d)) continue;
    const k = `${wordSet(d.name)}|${variantSig(d.name)}`;
    if (!bySet.has(k)) bySet.set(k, []);
    bySet.get(k).push(d);
  }

  function fallback(name) {
    const ws = wordSet(name);
    if (!ws || !ws.includes(' ')) return null;           // a bare "Row" / "Curl" is never resolved
    const cands = bySet.get(`${ws}|${variantSig(name)}`) || [];
    if (cands.length !== 1) return null;                 // none, or several: a question, not a guess
    return cands[0];
  }

  return function resolve(name, exerciseId) {
    let first = null;
    const take = (d) => {
      if (!d) return null;
      if (hasMuscles(d)) return d;
      if (!first) first = d;
      return null;
    };
    const asked = String(name == null ? '' : name);
    let hit = null;
    if (exerciseId != null) hit = take(byId.get(exerciseId) || byId.get(Number(exerciseId)));
    if (!hit && asked) hit = take(byLower.get(lower(asked)));
    if (!hit && asked) hit = take(byCanon.get(canonicalKey(asked)));
    if (!hit && asked) hit = take(published.get(lower(asked)));
    if (!hit && asked) {
      const meant = aliases.get(canonicalKey(asked));
      if (meant && !variantsDiffer(asked, meant)) hit = take(named(meant));
    }
    if (!hit && asked) {
      const meant = EXERCISE_ALIASES[normKey(asked)];
      if (meant && !variantsDiffer(asked, meant)) hit = take(named(meant));
    }
    if (!hit && asked) hit = take(fallback(asked));
    return hit || first || null;
  };
}

module.exports = { makeResolver, wordSet };
