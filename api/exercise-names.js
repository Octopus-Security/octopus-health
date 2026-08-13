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
function resolveExerciseName(input, knownNames = []) {
  const asked = String(input == null ? '' : input).trim();
  const key = canonicalKey(asked);
  if (!key) return { asked, status: 'new', name: asked, candidates: [] };

  const exact = knownNames.find(k => canonicalKey(k) === key);
  if (exact) return { asked, status: 'known', name: exact, candidates: [] };

  const base = baseKey(asked);
  const candidates = knownNames.filter(k => {
    const kk = canonicalKey(k);
    if (baseKey(k) === base) return true;               // same movement, different kit
    if (kk.includes(key) || key.includes(kk)) return true; // one qualifies the other
    return looksLikeTypo(kk, key);
  });

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
function resolveExerciseNames(names, known = []) {
  const resolved = new Map();
  const questions = [];
  const seen = new Set();

  for (const raw of names) {
    const key = canonicalKey(raw);
    if (seen.has(key)) continue;    // one question per name, not per set
    seen.add(key);

    const r = resolveExerciseName(raw, known);
    if (r.status === 'ambiguous') {
      questions.push({ exerciseName: r.asked, candidates: r.candidates });
    } else {
      resolved.set(raw, r.name);
    }
  }
  return { resolved, questions, allKnown: questions.length === 0 };
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
  normalise, canonicalKey, baseKey, editDistance,
  resolveExerciseName, resolveExerciseNames, questionText,
  EQUIPMENT,
};
