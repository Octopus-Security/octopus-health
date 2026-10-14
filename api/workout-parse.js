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
// Per-limb phrasing, which becomes the note "each side" however it was written.
// "each hand" was missing, so "10 x 40lb each hand" logged 40 with no note and
// nothing recorded that it was 40 PER HAND (2026-10-14).
const SIDE_RE = /\b(?:each|per|ea|both)\s+(?:sides?|hands?|arms?|legs?)\b|\be\/s\b/i;

// A snake_case identifier is the agent's own plumbing quoted back, not an
// exercise. 2026-10-14: a declined approval card was pasted into the chat to
// approve it, cortex preferred the live message over the model's copy (it is
// supposed to — the model cannot then drop a line), and this parser read
// `• log_workout_text — text: Bench press 45lb bar:` as an exercise called
// `Log Workout Text Text Bench Press`. No exercise name contains an underscore;
// cortex no longer sends this, and this is the second lock on the same door.
const TOOL_ECHO_RE = /[a-z]+_[a-z_]+/i;

// Sanity bounds. The same paste put `date: 2026-10-14` through as 2026 reps at
// 10 lb — one `res.json` away from a set nobody could have done sitting in the
// history forever. A number this far out is a misread line, not data, so the
// line goes UNREAD and is asked about. Never stored, never rounded into range.
const REPS_LIMIT = 500;
const WEIGHT_LIMIT = 2000;

// Which half of a unit-less `A x B` is the load, on a line that is ONE set.
//   GYM_WEIGHT_MIN — at or above this a number can be a load; below it, on a
//                    single set, it is a rep count.
//   REPS_PLAUSIBLE — above this it cannot be a rep count at all.
// Exactly one candidate load → that is the weight. Neither or both → the line
// is genuinely ambiguous and goes unread.
const GYM_WEIGHT_MIN = 20;
const REPS_PLAUSIBLE = 30;

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

/**
 * For a unit-less `A x B` on a single set, which number is the load?
 * Returns [reps, weight], or null when it genuinely cannot be told:
 *   10 x 50 → [10, 50]      50 x 10 → [10, 50]      1 x 140 → [1, 140]
 *   25 x 135 → [25, 135]    3 x 10  → null          30 x 25 → null
 */
function pickLoad(a, b) {
  if (a > REPS_PLAUSIBLE && b <= REPS_PLAUSIBLE) return [b, a];
  if (b > REPS_PLAUSIBLE && a <= REPS_PLAUSIBLE) return [a, b];
  if (a >= GYM_WEIGHT_MIN && b < GYM_WEIGHT_MIN) return [b, a];
  if (b >= GYM_WEIGHT_MIN && a < GYM_WEIGHT_MIN) return [a, b];
  return null;
}

// Parse the numeric tail of a clause (everything after the exercise name) into
// one or more sets. `opts.oneSet` marks a set LINE under a block header, where
// the line is one set and `NxM` cannot mean sets × reps. Returns [] when there
// is nothing loggable, or when the numbers cannot be read with confidence.
function parseSets(tail, opts = {}) {
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
  const nx = s.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+)/i);
  if (nx) {
    const a = parseFloat(nx[1]), b = parseInt(nx[2], 10);
    if (opts.oneSet && weight == null) {
      // A set LINE under a header IS one set, so `a` cannot be a set count —
      // and the owner writes the two numbers in BOTH orders: `50+bar x 10` on
      // 2026-10-11 and `10 x 50 + bar` on 2026-10-14. Position therefore says
      // nothing about which is the load, and reading `10 x 50` as the inline
      // grammar does gave TEN SETS OF FIFTY REPS. Size is the only honest
      // signal, and where size cannot tell either, the line is not guessed.
      const load = pickLoad(a, b);
      if (!load) return [];
      [reps, weight] = load;
      weightUnit = 'lbs';
    }
    // "225x5" is weight × reps, not 225 sets — nobody does twenty sets of
    // one thing in a log line. Below 20 it is sets × reps ("3x10").
    else if (a >= 20 && weight == null) { weight = a; weightUnit = 'lbs'; reps = b; }
    else { count = Math.round(a); reps = b; }
    s = s.replace(nx[0], ' ');
  }
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
  if (reps   != null && (!Number.isFinite(reps)   || reps   < 1 || reps   > REPS_LIMIT))   return [];
  if (weight != null && (!Number.isFinite(weight) || weight < 0 || weight > WEIGHT_LIMIT)) return [];
  if (!Number.isFinite(count) || count < 1 || count > 50) count = 1;
  if (opts.oneSet) count = 1;                       // one line, one set — by definition

  const out = [];
  for (let i = 0; i < count; i++) out.push({ reps, weight, weightUnit: weight != null ? weightUnit : null, duration, note });
  return out;
}

// Ways of saying sets and reps that the core grammar ("NxM", "@W") does not
// read, rewritten into it. Each one was CONFIDENTLY WRONG before — the worst
// failure for a log: "bench 3 sets of 10 at 135" logged 3 reps at 10 lb.
const DIST_RE = /\d\s*(?:mi|miles?|km|kms|kilometers?|meters?|metres?|yds?|yards?)\b/i;
function normalisePhrasing(s) {
  return s
    .replace(/(\d+)\s*sets?\s*(?:of|x)\s*(\d+)(?:\s*reps?)?/g, '$1x$2')   // 3 sets of 10 → 3x10
    .replace(/(\d+)\s*reps?\b/g, '$1')                                     // 10 reps → 10
    .replace(/\bat\s+(\d)/g, '@$1')                                         // at 135 → @135
    .replace(/^(\d+x\d+(?:\s*@\s*\d+(?:\.\d+)?)?)\s+([a-z].*)$/, '$2 $1')  // 3x10 dips → dips 3x10
    .replace(/\s+/g, ' ').trim();
}

// Parse ONE exercise clause: name + its set(s). `note` may carry a slash-style
// descriptor ("punches/kicks/elbows/knees"). Returns null if no name is found.
function parseClause(clause, bar = { weight: 45, unit: 'lbs' }) {
  const raw = clause.trim();
  if (!raw) return null;
  if (TOOL_ECHO_RE.test(raw)) return null;            // `log_workout_text — text: …`
  let s = normalisePhrasing(raw.toLowerCase().replace(/×/g, 'x'));
  // Distance is not something this parser stores; "ran 2 miles" must not
  // become 2 reps of "Ran". Unparsed → the person is asked, never guessed.
  if (DIST_RE.test(s)) return null;
  // "4/5" is a fraction, a score or a date — not reps and weight.
  if (/\d\s*\/\s*\d/.test(s)) return null;
  // "10 bicep curls ea side 30 lbs": the side words are a NOTE, not part of the
  // name — left in, they made an exercise called "Bicep Curls Ea Side".
  const sideNote = SIDE_RE.test(s) ? 'each side' : null;
  s = s.replace(SIDE_RE, ' ').replace(/\s+/g, ' ').trim();

  // (a) leading duration → a timed set: "5 min bag work", "30 sec plank"
  let leadDuration = null;
  let m = s.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${DUR_UNIT_RE})\\b`, 'i'));
  if (m) { leadDuration = Math.round(parseFloat(m[1]) * (DUR_SEC[m[2].toLowerCase()] || 1)); s = s.slice(m[0].length).trim(); }

  // (b) leading reps before a name: "20 pull ups", and "10 x Deep squats".
  // The owner writes the `x` form freely (2026-10-14: "10 x Deep squats with
  // 70lb", "10 x Barbell back squats 90lb + bar x 10"). Without the `x` branch
  // the separator was taken as the start of the name, giving exercises called
  // `X Deep Squats With` and `X Barbell Back Squats` — both of which then went
  // out as "which did you mean?" questions about the letter x.
  let leadReps = null;
  if (leadDuration == null) {
    const lr = s.match(/^(\d+)\s*x\s+(?=[a-z])/i) || s.match(/^(\d+)\s+(?=[a-z])/);
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
    // "with" introduces the load, it is not part of the movement: "deep squats
    // with 70lb" named an exercise `Deep Squats With`.
    if (/^(?:with|holding|using)$/i.test(w)) break;
    if (w.includes('/')) { noteParts = words.slice(i); i = words.length; break; }
    nameParts.push(w);
  }
  // "+bar" is not only a BLOCK thing: "10 x Barbell back squats 90lb + bar x 10"
  // is one line, and reading it without expanding the bar logged 90 lb for a
  // 135 lb lift — a wrong number, silently, which is the worst outcome here.
  const rawTail = words.slice(i).join(' ');
  const expanded = expandPlusBar(rawTail, bar);
  const tail = expanded.line;
  const barNote = expanded.note;
  let name = nameParts.join(' ').replace(/\s+/g, ' ').trim();
  if (!name) return null;                               // a set with no exercise — caller handles
  // One letter is not an exercise. `10 x 90 + bar, date: 2026-10-14` split on
  // its comma, orphaning `10 x 90 + bar` from the tail that followed it; the
  // leading `10` was taken as reps and the separator `x` became the name. That
  // `X` then matched all 23 of the account's names containing the letter.
  if (!/[a-z]{2,}/i.test(name)) return null;
  // "sets"/"reps" left IN the name means the phrasing was not understood.
  if (/\b(?:sets?|reps?)\b/.test(name)) return null;

  const note = [noteParts.length ? noteParts.join(' ').trim() : sideNote, barNote]
    .filter(Boolean).join('; ') || null;

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
function parseSegment(segment, bar = { weight: 45, unit: 'lbs' }) {
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
    const parsed = parseClause(piece, bar);
    if (!parsed) { failed = true; continue; }
    exercises.push(parsed);
    current = parsed;
  }

  // Renumber sets per exercise.
  for (const ex of exercises) ex.sets.forEach((st, idx) => { st.setNumber = idx + 1; });
  return { exercises, leftover: (failed || !exercises.length) ? segment : null };
}

// ── Block format ─────────────────────────────────────────────────────────────
// How the owner actually writes a workout on a phone:
//
//   Bench press 45lb bar:        ← header: the exercise, maybe the bar
//   50+bar x 10                  ← set lines under it, no name of their own
//   70+bar x 10
//
//   chest fly Machine:
//   100lb x 10
//
// Read line by line, none of the set lines has a name, so each was dropped to
// `unparsed` and the header became a "45 lb" set of nothing. 2026-10-11.
//
// "N+bar" is plates PLUS the bar: the bar's weight comes from the header
// ("45lb bar"), else 45 lb. Stored as the total load, because that is what
// the lift is and what PRs compare; the note keeps "50 + 45lb bar" so the
// original reading is never lost.

const BAR_SPEC_RE = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${WEIGHT_UNIT_RE})\\s*(?:olympic\\s+)?bar\\b`, 'i');
const PLUS_BAR_RE = /(\d+(?:\.\d+)?)\s*(?:lbs?|kgs?)?\s*\+\s*(?:the\s+)?bar\b/i;

/** Rewrite "50+bar x 10" as "95lbs x 10", returning the note it came from. */
function expandPlusBar(line, bar) {
  const m = line.match(PLUS_BAR_RE);
  if (!m) return { line, note: null };
  const plates = parseFloat(m[1]);
  const total = Math.round((plates + bar.weight) * 100) / 100;
  return {
    line: line.replace(m[0], `${total}${bar.unit}`),
    note: `${plates} + ${bar.weight}${bar.unit === 'kg' ? 'kg' : 'lb'} bar`,
  };
}

// A line that DECLARES the bar for the lines after it, rather than logging a
// set: "Bar = 45 lbs". 2026-10-14 it became an exercise called `Bar =` holding
// 45 lb and no reps, and the "+bar" line below it was read without it — so the
// declaration was both junk data AND useless. It is consumed, never unparsed:
// it has a number in it, and service.js treats an unread numeric line as reason
// to save NOTHING, so leaving it in `unparsed` would reject the whole workout.
const BAR_DECL_RE = new RegExp(`^(?:the\\s+)?bar\\s*[:=]\\s*(\\d+(?:\\.\\d+)?)\\s*(${WEIGHT_UNIT_RE})?\\.?$`, 'i');

// Equipment nouns that can TRAIL a set line without naming an exercise:
// "10 x 40lb dumbbells" is a set of shoulder press, not an exercise called
// dumbbells. Stripped only for the is-this-a-set-line question — a line like
// "10 dumbbell curls" still has "curls" left and stays an exercise.
const EQUIP_NOUN_RE = /\b(?:dumbbells?|dbs?|kettlebells?|kbs?|barbells?|bars?|plates?|bands?|machines?|cables?|weights?|total|each|hands?|sides?)\b/gi;

/** Pure set spec, no exercise name of its own ("100lb x 10", "95lbs x 10", "3x8 @135"). */
function isSetOnly(line) {
  if (/^\d{5,}$/.test(line.trim())) return false;   // a pasted 2FA code is not a set of 719981 reps
  // SIDE_RE FIRST. Stripping "each" ahead of it broke "10 x 40lbs each side"
  // into a line still carrying the word "side", which reads as a name — so the
  // whole Shoulder press block went unread by the very change meant to rescue
  // it, and the version this replaced handled it correctly.
  const stripped = line.replace(/\bx\b/gi, ' ').replace(SIDE_RE, ' ').replace(EQUIP_NOUN_RE, ' ');
  return /\d/.test(line) && !hasNameWord(stripped);
}

function parseHeaderBlock(header, setLines, declaredBar = { weight: 45, unit: 'lbs' }) {
  let h = header.replace(/:\s*$/, '').trim();
  if (TOOL_ECHO_RE.test(h)) return null;
  const bm = h.match(BAR_SPEC_RE);
  // A bar named in the HEADER wins over one declared earlier in the message,
  // which wins over the 45 lb assumption.
  const bar = bm ? { weight: parseFloat(bm[1]), unit: WEIGHT_UNIT[bm[2].toLowerCase()] || 'lbs' }
                 : declaredBar;
  if (bm) h = h.replace(bm[0], ' ').replace(/\s+/g, ' ').trim();

  // The header may carry its own first set ("bicep curls 10 20lbs").
  const own = parseClause(h, bar);
  const name = own ? own.name : titleCase(h.replace(SIDE_RE, ' ').replace(/[^a-z0-9 '/-]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase());
  if (!name || !/[a-z]{2,}/i.test(name)) return null;
  // The fallback name is whatever words the header had left after the bar spec,
  // so it is the one path that can name an exercise after a SET. With the tool
  // echo above rejected, `10 x 50 + bar` was promoted to a header of its own and
  // became an exercise called `10 X 50 Bar`. A header parseClause could not read
  // AND that still carries a number was not a header.
  if (!own && /\d/.test(name)) return null;
  const sideNote = SIDE_RE.test(h) ? 'each side' : null;

  const sets = own ? [...own.sets] : [];
  const bad = [];
  for (const raw of setLines) {
    const { line, note } = expandPlusBar(raw.replace(/×/g, 'x'), bar);
    const got = parseSets(line, { oneSet: true });
    if (!got.length) { bad.push(raw); continue; }
    for (const g of got) sets.push({ ...g, note: [g.note || sideNote, note].filter(Boolean).join('; ') || null });
  }
  sets.forEach((st, i) => { st.setNumber = i + 1; });
  return { exercise: sets.length ? { name, note: own ? own.note : sideNote, sets, raw: [header, ...setLines].join('\n') } : null, bad };
}

function parseWorkout(text) {
  const exercises = [];
  const unparsed = [];
  let order = 0;
  const push = ex => { ex.order = order++; exercises.push(ex); };

  const lines = String(text || '').split(/\r?\n/);
  // The bar in force for "+bar", until a line declares another one.
  let bar = { weight: 45, unit: 'lbs' };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const decl = line.match(BAR_DECL_RE);
    if (decl) {
      bar = { weight: parseFloat(decl[1]), unit: WEIGHT_UNIT[(decl[2] || 'lbs').toLowerCase()] || 'lbs' };
      continue;                                       // consumed, not unread
    }

    // A header: ends in ":" or is followed by set-only lines. Its sets are the
    // run of set-only lines that follow (blank lines between them allowed).
    const next = [];
    let j = i + 1;
    while (j < lines.length) {
      const t = lines[j].trim();
      if (!t) { j++; continue; }
      // A bar declaration is not a set of the block above it. "bar" is one of
      // the equipment nouns isSetOnly strips, so "Bar = 45 lbs" looked like a
      // pure set spec and was swallowed as a second, repless 45 lb set of the
      // exercise before it — while the declaration itself never ran.
      if (BAR_DECL_RE.test(t)) break;
      const probe = expandPlusBar(t, bar).line;
      if (!isSetOnly(probe)) break;
      next.push(t); j++;
    }
    const looksHeader = /:\s*$/.test(line) || (next.length > 0 && hasNameWord(line.replace(BAR_SPEC_RE, ' ')));
    if (looksHeader && (next.length || /:\s*$/.test(line))) {
      const r = parseHeaderBlock(line, next, bar);
      if (r && r.exercise) {
        push(r.exercise);
        unparsed.push(...r.bad);
        i = j - 1;
        continue;
      }
      if (!next.length) { unparsed.push(line); continue; }
    }

    // Anything else: the original comma/"and"-aware path, one line at a time.
    for (const seg of splitSegments(line)) {
      const { exercises: exs, leftover } = parseSegment(seg, bar);
      for (const ex of exs) push(ex);
      if (leftover) unparsed.push(leftover);
    }
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

module.exports = { parseWorkout, expandPlusBar, buildPreview, parseSets, parseClause, matchExercise, normKey, splitSegments, pickLoad };
