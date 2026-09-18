'use strict';

/**
 * Deterministic workout-text parser — NO model, NO network.
 *
 * Turns free text like
 *   "20 pull ups, 5 min bag work, bicep curls 10 each side 20lbs and 10 each side 25lbs"
 * into structured sets the workout logger can write straight to WorkoutSet rows.
 * This replaces routing every workout through an LLM tool loop (slow, costs
 * tokens, and — when the local GPU model was missing/too slow — failed outright).
 *
 * Design rules, matching the estate's data-integrity stance:
 *   • CONSERVATIVE. A fragment it cannot read with confidence is returned in
 *     `unparsed` for the user to tap in by hand — it is NEVER guessed. Logging a
 *     wrong number is worse than logging nothing (cf. the Neith re-log incident:
 *     enforcement/parse lives in the service that owns the data, never in a
 *     model's discretion).
 *   • PURE. No DB, no I/O — so it is fully unit-tested (test/workout-parse.test.js),
 *     including the exact real-world message above as a positive control.
 *   • duration is stored in SECONDS (WorkoutSet.duration is "seconds, for timed
 *     sets"), so "5 min" → 300.
 *
 * Output shape:
 *   parseWorkout(text) => {
 *     exercises: [ { name, order, note, sets: [ { setNumber, reps, weight,
 *                    weightUnit, duration, note } ], raw } ],
 *     unparsed: [ "raw fragment", ... ]
 *   }
 * The route layer maps each set to a WorkoutSet row and (optionally) matches the
 * name to the exercise library via matchExercise().
 */

const WEIGHT_UNIT = {
  lb: 'lbs', lbs: 'lbs', pound: 'lbs', pounds: 'lbs',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg',
};
// unit → seconds
const DUR_SEC = {
  s: 1, sec: 1, secs: 1, second: 1, seconds: 1,
  min: 60, mins: 60, minute: 60, minutes: 60,
  hr: 3600, hrs: 3600, hour: 3600, hours: 3600,
};
const WEIGHT_UNIT_RE = 'lbs?|pounds?|kgs?|kilos?';
const DUR_UNIT_RE    = 'secs?|seconds?|mins?|minutes?|hrs?|hours?';
const SIDE_RE = /\b(?:each side|per side|both sides|e\/s|ea side)\b/i;

// Split the whole message into top-level segments. Commas, semicolons, newlines
// and list bullets separate exercises; "and"/"&"/"then" are handled INSIDE a
// segment, because they join sets of ONE exercise as often as they join two
// exercises ("10 20lb and 10 25lb" vs "20 pushups and 20 situps").
function splitSegments(text) {
  return String(text || '')
    .split(/[\n,;]+|(?:^|\s)[•\-\*]\s+|\s+\d+[.)]\s+/g)
    .map(s => (s || '').trim())
    .filter(Boolean);
}

// Does this fragment introduce a NEW exercise (i.e. contains a real name word),
// as opposed to being just another set of the current one (pure numbers/units)?
function hasNameWord(frag) {
  const stripped = frag
    .replace(new RegExp(`\\b\\d+(?:\\.\\d+)?\\s*(?:${WEIGHT_UNIT_RE}|${DUR_UNIT_RE})\\b`, 'gi'), ' ')
    .replace(SIDE_RE, ' ')
    .replace(/@\s*\d+(?:\.\d+)?/g, ' ')
    .replace(/\b\d+\s*x\s*\d+\b/gi, ' ')
    .replace(/\b\d+(?:\.\d+)?\b/g, ' ')
    .replace(/[^a-z]/gi, ' ')
    .trim();
  return /[a-z]{2,}/i.test(stripped);
}

// Parse the numeric tail of a clause (everything after the exercise name) into
// one or more sets. Returns [] when there is nothing loggable.
function parseSets(tail) {
  let s = ` ${String(tail || '').toLowerCase()} `;
  const note = SIDE_RE.test(s) ? 'each side' : null;
  s = s.replace(SIDE_RE, ' ');

  // timed set: "30 sec", "2 min" — pulled first so its number is not read as reps
  let duration = null;
  const dm = s.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${DUR_UNIT_RE})\\b`, 'i'));
  if (dm) { duration = Math.round(parseFloat(dm[1]) * (DUR_SEC[dm[2].toLowerCase()] || 1)); s = s.replace(dm[0], ' '); }

  // explicit weight: "20lbs", "20 kg", "@135"
  let weight = null, weightUnit = null;
  const wm = s.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${WEIGHT_UNIT_RE})\\b`, 'i'));
  if (wm) { weight = parseFloat(wm[1]); weightUnit = WEIGHT_UNIT[wm[2].toLowerCase()] || 'lbs'; s = s.replace(wm[0], ' '); }
  else {
    const at = s.match(/@\s*(\d+(?:\.\d+)?)/);
    if (at) { weight = parseFloat(at[1]); weightUnit = 'lbs'; s = s.replace(at[0], ' '); }
  }

  // sets x reps ("3x10"), else the first bare number is the rep count
  let count = 1, reps = null;
  const nx = s.match(/(\d+)\s*x\s*(\d+)/i);
  if (nx) { count = parseInt(nx[1], 10); reps = parseInt(nx[2], 10); s = s.replace(nx[0], ' '); }
  else {
    const r = s.match(/(\d+)/);
    if (r) { reps = parseInt(r[1], 10); s = s.replace(r[0], ' '); }
  }

  // a bare number still left, with no explicit unit, is the weight ("5x5 225", "10 135")
  if (weight == null) {
    const w2 = s.match(/(\d+(?:\.\d+)?)/);
    if (w2) { weight = parseFloat(w2[1]); weightUnit = 'lbs'; s = s.replace(w2[0], ' '); }
  }

  if (reps == null && weight == null && duration == null) return [];   // nothing loggable
  if (!Number.isFinite(count) || count < 1 || count > 50) count = 1;

  const out = [];
  for (let i = 0; i < count; i++) out.push({ reps, weight, weightUnit: weight != null ? weightUnit : null, duration, note });
  return out;
}

// Parse ONE exercise clause: name + its set(s). `note` may carry a slash-style
// descriptor ("punches/kicks/elbows/knees"). Returns null if no name is found.
function parseClause(clause) {
  const raw = clause.trim();
  if (!raw) return null;
  let s = raw.toLowerCase().replace(/×/g, 'x');

  // (a) leading duration → a timed set: "5 min bag work", "30 sec plank"
  let leadDuration = null;
  let m = s.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${DUR_UNIT_RE})\\b`, 'i'));
  if (m) { leadDuration = Math.round(parseFloat(m[1]) * (DUR_SEC[m[2].toLowerCase()] || 1)); s = s.slice(m[0].length).trim(); }

  // (b) leading reps before a name: "20 pull ups"
  let leadReps = null;
  if (leadDuration == null) {
    const lr = s.match(/^(\d+)\s+(?=[a-z])/);
    if (lr) { leadReps = parseInt(lr[1], 10); s = s.slice(lr[0].length).trim(); }
  }

  // Name = the leading run of word tokens, stopping at the first number/set-spec.
  // A token containing "/" starts a descriptive note ("bag work punches/kicks/...").
  const words = s.split(/\s+/);
  const nameParts = [];
  let noteParts = [];
  let i = 0;
  for (; i < words.length; i++) {
    const w = words[i];
    if (/\d/.test(w) || /^x\d/i.test(w) || w.startsWith('@')) break;   // a set spec begins
    if (w.includes('/')) { noteParts = words.slice(i); i = words.length; break; }
    nameParts.push(w);
  }
  const tail = words.slice(i).join(' ');
  let name = nameParts.join(' ').replace(/\s+/g, ' ').trim();
  if (!name) return null;                               // a set with no exercise — caller handles

  const note = noteParts.length ? noteParts.join(' ').trim() : null;

  // Build the sets.
  let sets = [];
  if (leadDuration != null) {
    sets = [{ reps: null, weight: null, weightUnit: null, duration: leadDuration, note }];
    const more = parseSets(tail);                       // e.g. "30 sec plank 3 rounds" — rare
    if (more.length && more[0].reps != null) sets = more.map(x => ({ ...x, duration: leadDuration }));
  } else if (leadReps != null && !tail.trim()) {
    sets = [{ reps: leadReps, weight: null, weightUnit: null, duration: null, note }];
  } else if (leadReps != null) {
    const ts = parseSets(tail);
    sets = ts.length ? ts.map(x => ({ ...x, reps: x.reps == null ? leadReps : x.reps, note: x.note || note }))
                     : [{ reps: leadReps, weight: null, weightUnit: null, duration: null, note }];
  } else {
    sets = parseSets(tail).map(x => ({ ...x, note: x.note || note }));
  }
  if (!sets.length) return null;

  return { name: titleCase(name), note, sets, raw };
}

// Parse a segment, which may hold several "and"/"&"-joined pieces: the first is
// the exercise; each following piece is either another SET (pure numbers) or a
// NEW exercise (has a name word).
function parseSegment(segment) {
  const pieces = segment.split(/\s+(?:and|&|then|plus)\s+/i).map(p => p.trim()).filter(Boolean);
  if (!pieces.length) return { exercises: [], leftover: segment };

  const exercises = [];
  let current = null;
  let failed = false;

  for (let k = 0; k < pieces.length; k++) {
    const piece = pieces[k];
    if (current && !hasNameWord(piece)) {
      // another set of the current exercise
      const more = parseSets(piece);
      if (more.length) current.sets.push(...more);
      else failed = true;
      continue;
    }
    const parsed = parseClause(piece);
    if (!parsed) { failed = true; continue; }
    exercises.push(parsed);
    current = parsed;
  }

  // Renumber sets per exercise.
  for (const ex of exercises) ex.sets.forEach((st, idx) => { st.setNumber = idx + 1; });
  return { exercises, leftover: (failed || !exercises.length) ? segment : null };
}

function parseWorkout(text) {
  const exercises = [];
  const unparsed = [];
  let order = 0;
  for (const seg of splitSegments(text)) {
    const { exercises: exs, leftover } = parseSegment(seg);
    for (const ex of exs) { ex.order = order++; exercises.push(ex); }
    if (leftover) unparsed.push(leftover);
  }
  return { exercises, unparsed };
}

// ── Exercise-library matching (pure; the route passes the library) ─────────────
// Loose match: case/space/hyphen-insensitive, trailing-plural-insensitive, and
// EXACT after normalising — never a substring, so "row" does not swallow
// "Inverted Row". Returns { id, name } (canonical) or null.
function normKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');
}
function matchExercise(name, library) {
  if (!name || !Array.isArray(library)) return null;
  const key = normKey(name);
  if (!key) return null;
  for (const e of library) {
    if (normKey(e.name) === key) return { id: e.id != null ? e.id : null, name: e.name };
  }
  return null;
}

function titleCase(s) {
  return String(s).replace(/\w[\w'/-]*/g, w => w.charAt(0).toUpperCase() + w.slice(1));
}

// Turn parseWorkout() output + the exercise library into the preview/commit rows
// the route writes. Pure (library is passed in), so the name-matching and the
// row mapping are both unit-tested without a database. `notes` uses the DB field
// name; the route hands these straight to WorkoutSet.create.
function buildPreview(parsed, library) {
  return (parsed.exercises || []).map(ex => {
    const hit = matchExercise(ex.name, library);
    return {
      name: hit ? hit.name : ex.name,
      exerciseId: hit ? hit.id : null,
      matched: Boolean(hit),
      order: ex.order,
      note: ex.note,
      sets: ex.sets.map(s => ({
        setNumber: s.setNumber, reps: s.reps, weight: s.weight,
        weightUnit: s.weightUnit || 'lbs', duration: s.duration, notes: s.note,
      })),
    };
  });
}

module.exports = { parseWorkout, buildPreview, parseSets, parseClause, matchExercise, normKey, splitSegments };
