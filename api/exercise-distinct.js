'use strict';

/**
 * exercise-distinct.js — "these two are NOT the same exercise".
 *
 * The Review & consolidate page suggests merges ("Possibly the same?"). A person who knows that Barbell and
 * Dumbbell Bench Press are two lifts had no way to say so, so the suggestion sat there for ever. A dismissal
 * is stored as a PAIR of group keys (api/exercise-names.js groupKey: spelling-insensitive, variant-sensitive),
 * sorted so (a,b) and (b,a) are one row. Pairs, not names: a brand-new spelling of either exercise is a
 * different pair and is still suggested. This only HIDES a suggestion; it never blocks a merge the person
 * asks for, and it is not consulted when copying muscles (api/exercise-fix.js).
 *
 * One table per user database (ExerciseDistinct), created additively by sync(); never altered or dropped.
 */

const MAX_PAIRS = 200;
const MAX_KEY = 200;

/** Order-independent pair: [a, b] sorted, or null when it is not a usable pair. */
function pairOf(x, y) {
  const a = String(x == null ? '' : x), b = String(y == null ? '' : y);
  if (!a || !b || a === b || a.length > MAX_KEY || b.length > MAX_KEY) return null;
  return a < b ? [a, b] : [b, a];
}
const pairKey = (p) => `${p[0]}\u0000${p[1]}`;

/** Validate a request body's `pairs: [[a,b],...]`. */
function cleanPairs(input) {
  if (!Array.isArray(input) || !input.length) return { error: 'pairs must be a non-empty list' };
  if (input.length > MAX_PAIRS) return { error: `at most ${MAX_PAIRS} pairs at a time` };
  const seen = new Map();
  for (const p of input) {
    const c = Array.isArray(p) && p.length === 2 ? pairOf(p[0], p[1]) : null;
    if (!c) return { error: 'each pair is two different exercise keys' };
    seen.set(pairKey(c), c);
  }
  return { pairs: [...seen.values()] };
}

/** Set of pairKey() for every dismissed pair. Missing table or model reads as "none dismissed". */
async function loadDistinct(db) {
  if (!db || !db.ExerciseDistinct) return new Set();
  const rows = await db.ExerciseDistinct.findAll({ raw: true }).catch(() => []);
  return new Set(rows.map(r => pairKey([r.a, r.b])));
}

async function dismiss(db, pairs) {
  let added = 0;
  for (const [a, b] of pairs) {
    const [, created] = await db.ExerciseDistinct.findOrCreate({ where: { a, b }, defaults: { a, b } });
    if (created) added++;
  }
  return { ok: true, added };
}

async function restore(db, pairs) {
  let removed = 0;
  for (const [a, b] of pairs) removed += await db.ExerciseDistinct.destroy({ where: { a, b } });
  return { ok: true, removed };
}

/**
 * Drop dismissed pairs from one suggestion's groups. A group stays while it has at least one pair with another
 * group that is NOT dismissed; fewer than two survivors and the suggestion disappears.
 * @param {{key:string}[]} groups
 * @returns {{key:string}[]} the surviving groups ([] when nothing is left to suggest)
 */
function survivors(groups, dismissed) {
  if (!dismissed || !dismissed.size) return groups;
  const keep = groups.filter((g, i) => groups.some((h, j) => {
    if (i === j) return false;
    const p = pairOf(g.key, h.key);
    return p && !dismissed.has(pairKey(p));
  }));
  return keep.length >= 2 ? keep : [];
}

module.exports = { pairOf, pairKey, cleanPairs, loadDistinct, dismiss, restore, survivors };
