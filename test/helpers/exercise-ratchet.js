// Known offenders for test/exercise-guards.test.js. Each entry: key, the audit finding it comes from
// (docs/EXERCISE-AUDIT.md), and why it is tolerated for now. Lists only shrink: fixing an offender
// makes its entry stale, and a stale entry fails the suite until it is deleted.

const FALLBACK = [
  { key: "library:Toe Yoga", finding: "#15", reason: "foot drill; the stick figure has no toe or arch segment, so there is no honest figure to draw. The null rule only stops a wrong match" },
  { key: "library:Short Foot Exercise", finding: "#15", reason: "foot drill; the stick figure has no toe or arch segment, so there is no honest figure to draw. The null rule only stops a wrong match" },
  { key: "library:Banded Ankle Eversion", finding: "#15", reason: "foot drill; the stick figure has no toe or arch segment, so there is no honest figure to draw. The null rule only stops a wrong match" },
  { key: "library:Lymph Drainage: Diaphragmatic Breathing", finding: "#1, #15", reason: "skin strokes and breathing; no figure drawn on purpose, the null rule stops a neck-circle figure" },
  { key: "library:Lymph Drainage: Collarbone Strokes", finding: "#1, #15", reason: "skin strokes and breathing; no figure drawn on purpose, the null rule stops a neck-circle figure" },
  { key: "library:Lymph Drainage: Side-of-Neck Strokes", finding: "#1, #15", reason: "skin strokes and breathing; no figure drawn on purpose, the null rule stops a neck-circle figure" },
  { key: "library:Lymph Drainage: Ear and Jawline Strokes", finding: "#1, #15", reason: "skin strokes and breathing; no figure drawn on purpose, the null rule stops a neck-circle figure" },
  { key: "library:Lymph Drainage: Shoulder Rolls", finding: "#1, #15", reason: "skin strokes and breathing; no figure drawn on purpose, the null rule stops a neck-circle figure" },
  { key: "library:Lymph Drainage: Gentle Neck Tilts and Turns", finding: "#1, #15", reason: "skin strokes and breathing; no figure drawn on purpose, the null rule stops a neck-circle figure" },
  { key: "mobility:lh-breath-start", finding: "#1, #15", reason: "skin strokes and breathing; no figure drawn on purpose, the null rule stops a neck-circle figure" },
  { key: "mobility:lh-collar", finding: "#1, #15", reason: "skin strokes and breathing; no figure drawn on purpose, the null rule stops a neck-circle figure" },
  { key: "mobility:lh-side-neck", finding: "#1, #15", reason: "skin strokes and breathing; no figure drawn on purpose, the null rule stops a neck-circle figure" },
  { key: "mobility:lh-ear-jaw", finding: "#1, #15", reason: "skin strokes and breathing; no figure drawn on purpose, the null rule stops a neck-circle figure" },
  { key: "mobility:lh-shoulders", finding: "#1, #15", reason: "skin strokes and breathing; no figure drawn on purpose, the null rule stops a neck-circle figure" },
  { key: "mobility:lh-neck-move", finding: "#1, #15", reason: "skin strokes and breathing; no figure drawn on purpose, the null rule stops a neck-circle figure" },
  { key: "mobility:lh-breath-end", finding: "#1, #15", reason: "skin strokes and breathing; no figure drawn on purpose, the null rule stops a neck-circle figure" },
  { key: "library:Dumbbell Upright Row", finding: "catalogue-expansion", reason: "needs a pose: no upright-row figure; the bent-over row figure would be a different lift" },
  { key: "library:Barbell Upright Row", finding: "catalogue-expansion", reason: "needs a pose: no upright-row figure; the bent-over row figure would be a different lift" },
  { key: "library:Resistance Band Shoulder Adduction", finding: "catalogue-expansion", reason: "needs a pose: no figure for a band pulled down from overhead to the side" },
  { key: "library:Cable Glute Kickback", finding: "catalogue-expansion", reason: "needs a pose: the kickback figure is the triceps one" },
  { key: "library:Seated Hip Abduction (Machine)", finding: "catalogue-expansion", reason: "needs a pose: no seated machine figure for the hips" },
  { key: "library:Seated Hip Adduction (Machine)", finding: "catalogue-expansion", reason: "needs a pose: no seated machine figure for the hips" },
  { key: "library:Barbell Hang Clean", finding: "catalogue-expansion", reason: "needs a pose: no clean figure" },
];

const IMPLEMENT = [
];

const ALIAS = [
];

const CLAIMS = [
  { key: "library:name|Hip Flexor / Psoas Release", finding: "#20", reason: "\"release\" in a name or cue (soft-tissue wording); reword or confirm it is a plain action verb" },
  { key: "library:cue|Teep (Front Push Kick)", finding: "#20", reason: "\"release\" in a name or cue (soft-tissue wording); reword or confirm it is a plain action verb" },
  { key: "library:cue|Double Collar Tie (Plum)", finding: "#20", reason: "\"Prevent\" in copy; reword without a claim" },
  { key: "library:name|Peanut Ball Upper Back Release", finding: "#20", reason: "\"release\" in a name or cue (soft-tissue wording); reword or confirm it is a plain action verb" },
  { key: "library:name|Lacrosse Ball Glute Release", finding: "#20", reason: "\"release\" in a name or cue (soft-tissue wording); reword or confirm it is a plain action verb" },
  { key: "library:name|Lacrosse Ball Chest and Shoulder Release", finding: "#20", reason: "\"release\" in a name or cue (soft-tissue wording); reword or confirm it is a plain action verb" },
  { key: "mobility:name|ball-upper-back", finding: "#20", reason: "\"release\" in a name or cue (soft-tissue wording); reword or confirm it is a plain action verb" },
  { key: "mobility:name|ball-glute", finding: "#20", reason: "\"release\" in a name or cue (soft-tissue wording); reword or confirm it is a plain action verb" },
  { key: "mobility:name|ball-chest", finding: "#20", reason: "\"release\" in a name or cue (soft-tissue wording); reword or confirm it is a plain action verb" },
  { key: "template:cooldown|thu:home", finding: "#20", reason: "\"release\" in a name or cue (soft-tissue wording); reword or confirm it is a plain action verb" },
  { key: "template:cooldown|sun:home", finding: "#20", reason: "\"release\" in a name or cue (soft-tissue wording); reword or confirm it is a plain action verb" },
];

// Muscle tags the Body Map cannot place (they resolve to no muscle and no joint in lib/muscles.js).
const MUSCLE_TAGS = [
  { key: "balance", finding: "#16", reason: "a quality, not a body region; deliberately nothing to click" },
  { key: "cardio", finding: "#16", reason: "a quality, not a body region; deliberately nothing to click" },
];

module.exports = { FALLBACK, IMPLEMENT, ALIAS, CLAIMS, MUSCLE_TAGS };
