'use strict';

/**
 * session-titles.js — "is this session title one you already use?"
 *
 * Same house pattern as api/exercise-names.js, applied to a much smaller
 * vocabulary. The Logs page shows a session's title as its headline, and
 * without this it is whatever got typed that day — a bare "Strength", or a
 * single exercise name standing in as the title for the whole session. Both
 * are the same failure the exercise log already had: a thing that should be
 * one of a handful of known values instead grows a new spelling every time
 * someone phrases it slightly differently.
 *
 * Reuses exercise-names.js's normalisation rather than re-deriving it — case,
 * punctuation and plurals are not disagreements for a title either — but does
 * NOT pull in its equipment stripping (baseKey): a title has no equipment to
 * strip.
 *
 * ── Why "unknown" is one bucket, not two ──────────────────────────────────
 * exercise-names.js splits into `ambiguous` (something close exists — ask)
 * and `new` (nothing close — just log it), because the exercise vocabulary is
 * open-ended and asking about every unfamiliar exercise would be worthless.
 * Titles are the opposite: the user's own instruction is "it should use known
 * titles, if one isn't known it should ask to add them to the db" — i.e.
 * EVERY unrecognised title is a question, whether or not anything resembles
 * it. So this exposes one status, `unknown`, carrying `candidates` that are a
 * courtesy (near misses worth naming in the question) rather than a gate.
 */

const { canonicalKey, editDistance } = require('./exercise-names');

/** A typo, not a different title. Titles are short, so the floor is lower
 * than exercise-names' (4 chars, not 6) — "Core" and "Pull" must not be
 * mistaken for typos of each other at distance 2, and they aren't: they
 * differ by more than that. */
function looksLikeTypo(a, b) {
  if (a.length < 4 || b.length < 4) return false;
  const d = editDistance(a, b);
  return d > 0 && d <= 2;
}

/**
 * Resolve one session title against the titles this account already uses.
 *
 * @returns {{asked:string, status:'known'|'unknown', name:string|null, candidates:string[]}}
 *
 *   known   — the same title, allowing for case, punctuation and plurals.
 *   unknown — not recognised. Ask before writing, candidates or not.
 */
function resolveSessionTitle(input, knownTitles = []) {
  const asked = String(input == null ? '' : input).trim();
  const key = canonicalKey(asked);
  if (!key) return { asked, status: 'known', name: asked, candidates: [] };

  const exact = knownTitles.find(t => canonicalKey(t) === key);
  if (exact) return { asked, status: 'known', name: exact, candidates: [] };

  const candidates = knownTitles.filter(t => {
    const tk = canonicalKey(t);
    if (tk.includes(key) || key.includes(tk)) return true; // one qualifies the other
    return looksLikeTypo(tk, key);
  });
  return { asked, status: 'unknown', name: null, candidates: [...candidates].sort() };
}

/** The question text for one unrecognised title. */
function titleQuestionText(asked, candidates) {
  if (candidates.length) {
    return `"${asked}" is not a title you've used before — did you mean `
      + `${candidates.map(c => `"${c}"`).join(', or ')}? (or is "${asked}" a new title to add?) `
      + 'Nothing has been saved yet.';
  }
  return `"${asked}" is not a title you've used before. Is it a new title to add? `
    + 'Nothing has been saved yet.';
}

// A sensible starting set. Not exhaustive — `newTitle: true` grows it — just
// enough that a typical week's split resolves without ever asking.
const SEED_TITLES = [
  'Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Arms', 'Core',
  'Conditioning', 'Recovery', 'BJJ', 'Open Mat',
];

/**
 * Create each default title once. Additive merge, the same shape as
 * database.js's own ExerciseDefinition seeding: insert any seed title whose
 * canonical form isn't already present, and never touch a row that is
 * already there. Compared canonically (not by exact string) so a title
 * already added under different case or punctuation is not duplicated.
 *
 * Deliberately lighter than fitness-store.js's seedBenchmarks, which keeps a
 * separate seed-log table so a deleted default never comes back. There is no
 * delete path for a title yet, so that second table would track nothing;
 * when one exists, seeding should move to the same seed-log shape.
 */
async function seedSessionTitles(db) {
  const existing = await db.SessionTitle.findAll({ attributes: ['name'] });
  const existingKeys = new Set(existing.map(t => canonicalKey(t.name)));
  const toInsert = SEED_TITLES.filter(t => !existingKeys.has(canonicalKey(t)));
  if (toInsert.length) {
    await db.SessionTitle.bulkCreate(toInsert.map(name => ({ name })));
  }
}

module.exports = { resolveSessionTitle, titleQuestionText, seedSessionTitles, SEED_TITLES };
