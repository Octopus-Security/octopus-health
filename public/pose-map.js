/*
 * Which stick-figure animation (public/poses/<key>.json) an exercise shows.
 *
 * One copy, used by the library, the stretch page and the tests. There used to
 * be two hand-kept name→pose tables, one per page, that had already drifted
 * apart, and anything missing from them fell back to a standing figure that
 * barely moved — which is why most cards looked the same.
 *
 * Matching is by rule on the name (first match wins), then by category, so an
 * exercise someone adds later still gets a movement that fits. RULES order
 * matters: specific before general ("Jump Squat" before "Squat").
 * test/stick-figure.test.js checks every seeded exercise lands on a real pose
 * by a name rule rather than the category fallback.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PoseMap = api;
}(this, function () {
  'use strict';

  var RULES = [
    // ── foam rolling, hangs, specific stretches (before the strength words they contain) ──
    [/foam roll|over roller|itb|thoracic extension/i, 'foam-roll'],
    [/decompression hang|dead hang|lat stretch on (pull-?up )?bar/i, 'dead-hang'],
    [/doorway chest/i, 'doorway-chest'],
    [/cross-?body|sleeper|shoulder er\b/i, 'cross-body'],
    [/wall slide/i, 'wall-slide'],
    [/cat-? ?cow/i, 'cat-cow'],
    [/thread the needle|open book/i, 'thread-needle'],
    [/bird dog|quadruped hip|fire hydrant/i, 'bird-dog'],
    [/child'?s pose|frog stretch/i, 'childs-pose'],
    [/cobra|upward dog|scorpion/i, 'cobra'],
    [/down(ward)? dog/i, 'downward-dog'],
    [/pigeon/i, 'pigeon'],
    [/90\/90|seated hip internal|seated hip.*rotation/i, 'ninety-ninety'],
    [/butterfly (stretch|leg)|groin|adductor slide/i, 'butterfly'],
    [/couch stretch|hip flexor stretch|lizard|world'?s greatest|psoas|hip flexor pails/i, 'kneeling-hip-flexor'],
    [/dorsiflexion/i, 'ankle-dorsiflexion'],
    [/ankle cars|ankle circle/i, 'ankle-circle'],
    [/knee cars|terminal knee/i, 'knee-cars'],
    [/hip circle|hip flexor cars|figure-?4 stretch|hip external rotation pails/i, 'hip-circle'],
    [/wrist|finger|pronation|supination|elbow flexion/i, 'wrist-circle'],
    [/neck|cervical|chin tuck|levator|upper trap/i, 'neck-circle'],
    [/shoulder cars|dislocate|windmill|arm circle|shrug roll|shoulder elevation/i, 'arm-circle'],
    [/supine (spinal )?twist|supine hip internal/i, 'supine-twist'],
    [/knee-to-chest|knee to chest|piriformis/i, 'knee-to-chest'],
    [/seated forward fold|seated spine|bretzel|hamstring floss/i, 'seated-fold'],
    [/side bend|overhead banded shoulder/i, 'side-bend'],
    [/forward fold|toe touch|jefferson|hamstring stretch/i, 'forward-fold'],
    [/deep squat hold/i, 'deep-squat-hold'],
    [/cossack/i, 'cossack'],
    [/band pull-?apart/i, 'chest-fly'],
    [/breath/i, 'stand-breathe'],

    // ── BJJ ("mount" is a whole word: Mountain Climber is not a BJJ position) ──
    [/mountain climber/i, 'mountain-climber'],
    [/footwork|shadow boxing/i, 'fight-stance'],
    [/ab roller/i, 'rollout'],
    [/shrimp|hip escape|mount escape|side control escape|hip shift|guard retention/i, 'shrimp'],
    [/bridge and roll|hip bump/i, 'glute-bridge'],
    [/front roll|back roll|granby|inversion/i, 'forward-roll'],
    [/technical stand|guard get-?up|turkish get-?up/i, 'technical-stand-up'],
    [/guard|armbar|triangle choke|omoplata|scissor|de la riva|x-guard|butterfly\)|hook sweep|tripod|heel hook|ankle lock|bow and arrow/i, 'guard'],
    [/pass\b|\bmount\b|americana|kimura|choke|turtle|back take|hand fighting|takedown|rolling|bjj drilling|bjj hip/i, 'grappling-base'],
    [/sprawl/i, 'sprawl'],

    // ── striking ──
    [/teep|push kick|spinning back kick/i, 'teep'],
    [/kick check/i, 'kick-check'],
    [/roundhouse|switch kick|low kick|kick work|shin conditioning/i, 'roundhouse'],
    [/knee|clinch|plum|dteh chiang/i, 'knee-strike'],
    [/elbow|sok /i, 'elbow-strike'],
    [/uppercut/i, 'uppercut'],
    [/hook drill|teep-cross-hook/i, 'hook'],
    [/slip|parry/i, 'slip'],
    [/jab|cross drill|1-2|boxing combos|pad work|mma combos|speed bag/i, 'jab-cross'],
    [/sparring/i, 'fight-stance'],

    // ── conditioning ──
    [/burpee/i, 'burpee'],
    [/mountain climber/i, 'mountain-climber'],
    [/jumping jack/i, 'jumping-jack'],
    [/jump rope|double unders/i, 'jump-rope'],
    [/box jump|jump squat/i, 'jump-squat'],
    [/kettlebell swing/i, 'kb-swing'],
    [/slam/i, 'ball-slam'],
    [/battle rope/i, 'battle-ropes'],
    [/wood chop|rotational/i, 'wood-chop'],
    [/assault bike|bike|cycling/i, 'bike'],
    [/rowing machine|erg/i, 'rower'],
    [/treadmill|sprint|\brun\b|basketball|high knees/i, 'run'],
    [/carry|walk \+|walking$/i, 'walk'],

    // ── strength: core ──
    [/hanging leg raise|knee raise/i, 'hanging-leg-raise'],
    [/lying leg raise|leg raise/i, 'lying-leg-raise'],
    [/hollow/i, 'hollow-body'],
    [/v-?up/i, 'v-up'],
    [/dead bug/i, 'dead-bug'],
    [/rollout|ab roller/i, 'rollout'],
    [/crunch|sit-?up/i, 'crunch'],
    [/side plank/i, 'side-plank'],
    [/plank/i, 'plank'],

    // ── strength: upper ──
    [/pike push|wall walk/i, 'pike-push-up'],
    [/push-?up/i, 'push-up'],
    [/\bdips?\b/i, 'dip'],
    [/inverted row/i, 'inverted-row'],
    [/pull-?up|chin-?up/i, 'pull-up'],
    [/pulldown/i, 'lat-pulldown'],
    [/face pull/i, 'face-pull'],
    [/seated cable row|band row|cable row/i, 'seated-row'],
    [/row/i, 'bent-row'],
    [/bench press|chest press|dumbbell press|incline|decline|pullover/i, 'bench-press'],
    [/fly|pec deck/i, 'chest-fly'],
    [/lateral raise/i, 'lateral-raise'],
    [/front raise/i, 'front-raise'],
    [/shrug/i, 'arm-circle'],
    [/overhead tricep|tricep overhead|skull/i, 'tricep-overhead'],
    [/pushdown|tricep extension|kickback/i, 'pushdown'],
    [/leg curl|hamstring curl/i, 'leg-curl'],
    [/curl/i, 'curl'],
    [/overhead press|shoulder press|arnold|military/i, 'overhead-press'],

    // ── strength: lower ──
    [/hip thrust/i, 'hip-thrust'],
    [/glute bridge|bridge/i, 'glute-bridge'],
    [/leg press/i, 'leg-press'],
    [/leg extension/i, 'leg-extension'],
    [/calf raise/i, 'calf-raise'],
    [/romanian|rdl|good morning|hinge/i, 'rdl'],
    [/deadlift/i, 'deadlift'],
    [/lunge|split squat|step-?up/i, 'lunge'],
    [/squat/i, 'squat'],
  ];

  // An exercise no rule names still gets a figure that moves and fits roughly.
  var BY_CATEGORY = {
    strength: 'squat', conditioning: 'burpee', cardio: 'run', mma: 'fight-stance',
    muay_thai: 'fight-stance', bjj: 'grappling-base', recovery: 'stand-breathe',
  };
  var FALLBACK = 'stand-breathe';

  function match(name) {
    if (!name) return null;
    for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(name)) return RULES[i][1];
    return null;
  }
  function keyFor(name, category) {
    return match(name) || BY_CATEGORY[category] || FALLBACK;
  }
  function keys() {
    var seen = {};
    RULES.forEach(function (r) { seen[r[1]] = true; });
    for (var c in BY_CATEGORY) seen[BY_CATEGORY[c]] = true;
    seen[FALLBACK] = true;
    return Object.keys(seen).sort();
  }

  return { keyFor: keyFor, match: match, keys: keys, RULES: RULES, BY_CATEGORY: BY_CATEGORY };
}));
