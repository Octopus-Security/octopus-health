'use strict';

/**
 * exercise-names.js — "have I seen this exercise before, under another name?"
 *
 * The log grew seven pairs of near-duplicates: `Bench Press` alongside
 * `Barbell Bench Press`, `Tricep Pushdown` alongside `Cable Tricep Pushdown`.
 * Nothing was wrong with any single entry; they were logged from a chat, where
 * the name is whatever got said that day. But each spelling keeps its own
 * history, so a 205 lb bench and a 185 lb bench sat in the table as two
 * different lifts and neither one was the record.
 *
 * The fix is not fuzzier matching at read time. It is asking at WRITE time,
 * when the person who knows is still in the conversation — the account already
 * holds its own exercise names, so the question "is this the one you mean?" can
 * be answered before the row exists rather than reconstructed months later.
 *
 * Deliberately conservative in both directions:
 *
 *   - Equipment is never assumed away. `Cable Face Pull` and
 *     `Resistance Band Face Pull` share a base name and are different lifts at
 *     different loads. Sharing a base makes them a QUESTION, never a merge.
 *   - A name nothing resembles is just new. Asking about every unfamiliar
 *     exercise would train the answer "yes, whatever" and the guard would be
 *     worth nothing.
 *
 * Case, punctuation and plurals are not disagreements: `dips`, `Dips` and
 * `Dips.` are one exercise and resolve silently. Everything else that lands
 * near something known is asked about.
 */

// Words that describe what the lift is done WITH. Stripped only to find
// candidates — never to decide two names are the same, because the equipment is
// frequently the whole difference between them.
const EQUIPMENT = [
  'barbell', 'dumbbell', 'db', 'cable', 'machine', 'smith machine', 'smith',
  'resistance band', 'band', 'kettlebell', 'kb', 'ez bar', 'ezbar', 'bodyweight',
];

// NOT stripped: incline, decline, seated, standing, close grip, wide grip,
// single arm, paused. Those change the exercise rather than the hardware, and
// folding `Incline Bench Press` into `Bench Press` would lose a real record.

/** Lowercase, depunctuate, collapse whitespace. */
function normalise(name) {
  return String(name == null ? '' : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The form two spellings of one exercise share.
 *
 * Singularises each word, so `curls` and `curl` match — but only where the word
 * does not already end in a double s, or `press` becomes `pres` and stops
 * matching itself.
 */
function canonicalKey(name) {
  return normalise(name)
    .split(' ')
    .filter(Boolean)
    .map(w => w.replace(/([^s])s$/, '$1'))
    .join(' ');
}

/** The key with equipment words removed: what is left is the movement. */
function baseKey(name) {
  let k = ' ' + canonicalKey(name) + ' ';
  for (const e of EQUIPMENT) {
    k = k.split(' ' + canonicalKey(e) + ' ').join(' ');
  }
  return k.trim().replace(/\s+/g, ' ');
}

/** Edit distance, capped — only ever asked about short gym names. */
function editDistance(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * Does one name QUALIFY the other — `Incline Bench Press` against `Bench Press`,
 * `Ring Dips` against `Dips`?
 *
 * Containment on WORD BOUNDARIES, never a bare substring. 2026-10-14: a parse
 * slip handed this an exercise called `X`, and `kk.includes('x')` made every one
 * of the account's 23 names containing the letter x a candidate — Box Jump,
 * Shadow Boxing, Thoracic Extension over Roller. The question that reached the
 * owner listed all 23 and was unanswerable, and nothing was saved.
 *
 * A one-character fragment is also rejected outright: it is not a qualified
 * version of anything. That is belt-and-braces — the parser should never emit
 * such a name (api/workout-parse.js now refuses to), and the word boundary
 * alone already kills the explosion — but this is the half that decides whether
 * a question is ANSWERABLE, so it does not rely on the other half being right.
 */
function qualifies(a, b) {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 2) return false;
  return ` ${long} `.includes(` ${short} `);
}

/**
 * Unilateral / iso-lateral markers. `Iso Leg Press` is a different MACHINE from
 * `Leg Press`; `Single-arm Row` a different lift from `Row`. 2026-11-12: Neith
 * renamed 2 sets of Iso Leg Press to Leg Press, which erased a real record.
 * Names whose variant signature differs are DISTINCT canonical exercises:
 * never candidates for each other, never aliased, never merged.
 */
const VARIANTS = [
  ['iso', /\b(iso|isolateral|iso lateral|isolat?eral)\b/],
  ['single', /\b(single|one|1) (arm|leg|hand)\b|\bunilateral\b/],
];
function variantSig(name) {
  const n = normalise(name);
  return VARIANTS.filter(([, re]) => re.test(n)).map(([t]) => t).join(',');
}
const variantsDiffer = (a, b) => variantSig(a) !== variantSig(b);

/**
 * The identity of an exercise for COUNTING: spelling-insensitive (case,
 * punctuation, plurals) but variant-sensitive (iso / single-arm are their own
 * exercises). Two names with the same groupKey are one exercise; PRs, stats and
 * the log's spelling are all decided per groupKey.
 */
const groupKey = name => `${canonicalKey(name)}|${variantSig(name)}`;

/** The equipment-stripped movement, still variant-sensitive. Used for SUGGESTIONS only, never to merge. */
const movementKey = name => `${baseKey(name)}|${variantSig(name)}`;

/**
 * The dominant spelling among names that are one exercise: most sets, ties to
 * the most recent, then to the name that sorts first (so it never flips).
 *
 * @param {string[]} names
 * @param {Array<{name:string, sets:number, last?:string|null}>} stats  usage; names absent from it count 0
 */
function dominantSpelling(names, stats = []) {
  const use = new Map(stats.map(r => [r.name, r]));
  const sets = n => (use.get(n) ? Number(use.get(n).sets) || 0 : 0);
  const last = n => (use.get(n) && use.get(n).last) || '';
  return [...names].sort((a, b) =>
    (sets(b) - sets(a)) || String(last(b)).localeCompare(String(last(a))) || a.localeCompare(b))[0] || null;
}

/** A typo, not a different exercise. Strict: `Leg Press` and `Leg Curl` are not this. */
function looksLikeTypo(a, b) {
  if (a.length < 6 || b.length < 6) return false;   // short names differ for real
  const d = editDistance(a, b);
  return d > 0 && d <= 2;
}

/**
 * Resolve one name against the names this account already uses.
 *
 * @returns {{asked:string, status:'known'|'ambiguous'|'new', name:string|null, candidates:string[]}}
 *
 *   known      — the same exercise, allowing for case, punctuation and plurals.
 *   ambiguous  — it resembles something already logged. Ask; do not write.
 *   new        — nothing like it exists. Log it as sent.
 */
function resolveExerciseName(input, knownNames = [], stats = []) {
  const asked = String(input == null ? '' : input).trim();
  const key = canonicalKey(asked);
  if (!key) return { asked, status: 'new', name: asked, candidates: [] };

  // A spelling variant (case, punctuation, plural) of something already logged
  // is that exercise: it is logged under the DOMINANT existing spelling and
  // never asked about (2026-11-12: "Single arm row" was asked against "Single
  // Arm Row" / "Single-Arm Row"). Where several spellings already exist, the
  // one with the most sets wins, so history converges instead of forking again.
  const gk = groupKey(asked);
  const same = knownNames.filter(k => groupKey(k) === gk);
  if (same.length) return { asked, status: 'known', name: dominantSpelling(same, stats), candidates: [] };

  const base = baseKey(asked);
  const candidates = knownNames.filter(k => {
    if (variantsDiffer(k, asked)) return false;         // iso / single-arm: a different exercise
    const kk = canonicalKey(k);
    if (baseKey(k) === base) return true;               // same movement, different kit
    if (qualifies(kk, key)) return true;                // one qualifies the other
    return looksLikeTypo(kk, key);
  });

  // Several spellings of ONE candidate exercise are one candidate: offer the dominant.
  const byGroup = new Map();
  for (const c of candidates) {
    const g = groupKey(c);
    byGroup.set(g, [...(byGroup.get(g) || []), c]);
  }
  candidates.length = 0;
  for (const names of byGroup.values()) candidates.push(dominantSpelling(names, stats));

  if (candidates.length) {
    // Sorted so the question reads the same way twice, which matters when the
    // answer is being matched back to it by a language model.
    return { asked, status: 'ambiguous', name: null, candidates: [...candidates].sort() };
  }
  return { asked, status: 'new', name: asked, candidates: [] };
}

/**
 * Resolve every exercise in one submitted workout.
 *
 * All of them, before any of them are written. A workout is logged as a unit —
 * asking about the second exercise after saving the first leaves a half-logged
 * session, and the person then has to work out which half. So this collects
 * every question in the message and the caller asks them together.
 *
 * @param {string[]} names   exercise names in the submitted log
 * @param {string[]} known   names this account already uses
 * @returns {{resolved:Map<string,string>, questions:Array, allKnown:boolean}}
 */
function resolveExerciseNames(names, known = [], stats = []) {
  const resolved = new Map();
  const questions = [];
  const seen = new Set();
  const firstNew = new Map();

  for (const raw of names) {
    const key = groupKey(raw);
    const r = resolveExerciseName(raw, known, stats);
    if (r.status === 'ambiguous') {
      if (seen.has(key)) continue;    // one question per name, not per set
      seen.add(key);
      questions.push({ exerciseName: r.asked, candidates: r.candidates });
    } else if (r.status === 'new') {
      // Two spellings of one NEW exercise in the same message: the first one typed wins.
      if (!firstNew.has(key)) firstNew.set(key, r.name);
      resolved.set(raw, firstNew.get(key));
    } else {
      resolved.set(raw, r.name);
    }
  }
  return { resolved, questions, allKnown: questions.length === 0 };
}

/**
 * Is this "name" a line of conversation rather than an exercise? (2026-11-12.)
 *
 * On 2026-10-29 a reply to a naming question - "yes but it was with dumbbells" - reached the
 * rename route as the NEW name and became an exercise with one set. Health is the service that
 * owns the data, so health refuses to CREATE such a name (the model upstream can decline to be
 * careful; this cannot be argued with). A name the account already uses is never refused.
 *
 * @returns {string|null} why it is not an exercise name, or null if it could be one
 */
function conversationalReason(nameIn) {
  const name = String(nameIn == null ? '' : nameIn).trim();
  if (!name) return null;
  if (/\?\s*$/.test(name)) return 'it is a question';
  if (/^(yes|no|yeah|yep|yup|nope|nah|ok|okay|sure|but|it was|i did|i do|i didn't|that was|that's|thats)(?=[\s,.!;:]|$)/i.test(name)) return 'it starts like a reply, not a name';
  if (name.split(/\s+/).length > 8) return 'it is too long to be an exercise name';
  return null;
}

/** One line per ambiguity, so several can be asked in a single reply. */
function questionText(questions) {
  if (!questions.length) return null;
  const lines = questions.map(q =>
    `"${q.exerciseName}" — did you mean ${q.candidates.map(c => `"${c}"`).join(', or ')}? (or is it a new exercise?)`);
  if (lines.length === 1) return `${lines[0]} Nothing has been saved yet.`;
  return `${lines.length} of these match exercises you already log, under different names:\n`
       + lines.map(l => `  • ${l}`).join('\n')
       + '\nAnswer each one. Nothing has been saved yet.';
}

module.exports = {
  normalise, canonicalKey, baseKey, editDistance, qualifies,
  resolveExerciseName, resolveExerciseNames, questionText, conversationalReason,
  EQUIPMENT, variantSig, variantsDiffer, groupKey, movementKey, dominantSpelling,
};
