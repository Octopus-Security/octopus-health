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
    // ── movements that used to borrow a neighbour's figure (audit 2026-10-26) ──
    [/granby/i, 'granby-roll'],
    [/upward elbow|sok ngad/i, 'upward-elbow'],
    [/quadruped hip/i, 'quadruped-hip-cars'],
    [/back roll/i, 'back-roll'],
    [/inversion/i, 'inversion'],
    [/neck bridge|wrestler'?s bridge/i, 'neck-bridge'],
    [/hip bump/i, 'hip-bump'],
    [/shrug/i, 'shrug'],
    [/open book|shoulder windmill|bretzel/i, 'open-book'],
    [/sleeper/i, 'sleeper'],
    [/prone shoulder er\b|prone shoulder external/i, 'prone-shoulder-er'],
    [/pullover/i, 'pullover'],
    [/chest press machine|machine chest press/i, 'chest-press'],
    [/incline/i, 'incline-press'],
    [/cable crunch/i, 'cable-crunch'],
    [/kickback/i, 'kickback'],
    [/box jump/i, 'box-jump'],
    [/terminal knee|\btke\b/i, 'tke'],
    [/elbow flexion/i, 'elbow-flexion'],
    [/wall walk/i, 'wall-walk'],
    [/turkish/i, 'turkish-get-up'],
    [/spinning back kick/i, 'back-kick'],
    [/hamstring floss/i, 'half-kneel-hamstring'],
    [/seated spine rotation|seated (spinal )?twist/i, 'seated-twist'],
    [/speed bag/i, 'speed-bag'],
    [/1-2-low kick|shadow boxing\W+muay thai|pad work\W+muay thai|heavy bag\W+mma/i, 'muay-thai-combo'],
    [/dumbbell single-arm row|renegade/i, 'renegade-row'],
    [/dumbbell row/i, 'bench-row'],
    [/foam roll (hip flexors|adductors)/i, 'foam-roll-prone'],
    [/itb foam roll|foam roll itb/i, 'foam-roll-itb'],
    [/foam roll lats/i, 'foam-roll-lats'],
    [/turtle position/i, 'turtle'],
    [/takedown/i, 'double-leg'],
    [/adductor slide/i, 'frog'],
    [/hip external rotation pails|bjj hip mobility flow/i, 'ninety-ninety'],

    // ── specific stretches and mobility drills that used to share a generic figure ──
    // ── stretches & mobility added 2026-10-26 ──
    [/straddle|pancake/i, 'pancake'],
    [/prone quad|lying quad/i, 'prone-quad'],
    [/\bpnf\b|contract-?relax/i, 'pnf-hamstring'],
    [/90\/90 breathing/i, 'ninety-ninety-breathing'],
    [/supported bridge/i, 'supported-bridge'],
    [/sphinx/i, 'sphinx'],
    [/puppy/i, 'puppy'],
    [/side lunge (adductor )?stretch/i, 'side-lunge-stretch'],
    [/bench lat stretch/i, 'bench-lat-stretch'],
    [/legs up the wall/i, 'legs-up-wall'],
    [/adductor rock-?back/i, 'adductor-rock-back'],
    [/shin box get-?up/i, 'shin-box-get-up'],
    [/kneeling shin stretch|tibialis stretch/i, 'kneeling-shin-stretch'],
    [/thomas (stretch|test)/i, 'thomas-stretch'],
    [/squat to stand/i, 'squat-to-stand'],
    [/couch stretch/i, 'couch-stretch'],
    [/lizard/i, 'lizard'],
    [/world'?s greatest/i, 'worlds-greatest'],
    [/scorpion/i, 'scorpion'],
    [/frog stretch/i, 'frog'],
    [/figure-?(4|four)/i, 'figure-four'],
    [/happy baby/i, 'happy-baby'],
    [/thoracic extension|over roller/i, 'thoracic-extension'],
    [/calf foam roll|foam roll calf/i, 'foam-roll-calf'],
    [/triceps? stretch/i, 'triceps-stretch'],
    [/overhead banded shoulder|overhead shoulder stretch/i, 'overhead-shoulder-stretch'],
    [/supine hamstring|hamstring.*supine/i, 'supine-hamstring'],
    [/hamstring stretch/i, 'standing-hamstring'],
    [/quad(riceps)? stretch/i, 'quad-stretch'],
    [/calf stretch/i, 'calf-stretch'],
    [/chin tuck/i, 'chin-tuck'],
    [/neck isometric/i, 'neck-isometric'],
    [/levator|upper trap|neck side/i, 'neck-side-stretch'],
    [/wrist flexor|doorway wrist|finger extension/i, 'wrist-flexor-stretch'],
    [/bulgarian/i, 'bulgarian-split-squat'],

    // ── foam rolling, hangs, specific stretches (before the strength words they contain) ──
    [/foam roll|itb/i, 'foam-roll'],
    [/decompression hang|dead hang|lat stretch on (pull-?up )?bar/i, 'dead-hang'],
    [/doorway chest/i, 'doorway-chest'],
    [/cross-?body/i, 'cross-body'],
    [/wall slide/i, 'wall-slide'],
    [/cat-? ?cow/i, 'cat-cow'],
    [/thread the needle/i, 'thread-needle'],
    [/bird dog|fire hydrant/i, 'bird-dog'],
    [/child'?s pose|frog stretch/i, 'childs-pose'],
    [/cobra|upward dog|scorpion/i, 'cobra'],
    [/down(ward)? dog/i, 'downward-dog'],
    [/pigeon/i, 'pigeon'],
    [/90\/90|seated hip internal|seated hip.*rotation/i, 'ninety-ninety'],
    [/butterfly (stretch|leg)/i, 'butterfly'],
    [/couch stretch|hip flexor stretch|lizard|world'?s greatest|psoas|hip flexor pails/i, 'kneeling-hip-flexor'],
    [/dorsiflexion/i, 'ankle-dorsiflexion'],
    [/ankle cars|ankle circle/i, 'ankle-circle'],
    [/knee cars/i, 'knee-cars'],
    [/hip circle|hip flexor cars|figure-?4 stretch/i, 'hip-circle'],
    [/wrist|finger|pronation|supination/i, 'wrist-circle'],
    [/neck|cervical/i, 'neck-circle'],
    [/shoulder cars|dislocate|arm circle/i, 'arm-circle'],
    [/supine (spinal )?twist|supine hip internal/i, 'supine-twist'],
    [/knee-to-chest|knee to chest|piriformis/i, 'knee-to-chest'],
    [/seated forward fold/i, 'seated-fold'],
    [/side bend/i, 'side-bend'],
    [/forward fold|toe touch|jefferson/i, 'forward-fold'],
    [/deep squat hold/i, 'deep-squat-hold'],
    [/cossack/i, 'cossack'],
    [/band pull-?apart/i, 'chest-fly'],
    [/breath/i, 'stand-breathe'],

    // ── BJJ ("mount" is a whole word: Mountain Climber is not a BJJ position) ──
    [/mountain climber/i, 'mountain-climber'],
    [/shadow boxing/i, 'shadow-boxing'],
    [/footwork/i, 'fight-stance'],
    [/ab roller/i, 'rollout'],
    [/shrimp|hip escape|mount escape|side control escape|hip shift|guard retention/i, 'shrimp'],
    [/bridge and roll/i, 'glute-bridge'],
    [/front roll|forward roll/i, 'forward-roll'],
    [/technical stand|guard get-?up/i, 'technical-stand-up'],
    [/guard|armbar|triangle choke|omoplata|scissor|de la riva|x-guard|butterfly\)|hook sweep|tripod|heel hook|ankle lock|bow and arrow/i, 'guard'],
    [/pass\b|\bmount\b|americana|kimura|choke|turtle|back take|hand fighting|takedown|rolling|bjj drilling|bjj hip/i, 'grappling-base'],
    [/sprawl/i, 'sprawl'],

    // ── striking ──
    // ── striking & conditioning added 2026-10-26 ──
    [/hook to the body|body hook/i, 'body-hook'],
    [/uppercut to the body|body uppercut/i, 'body-uppercut'],
    [/overhand/i, 'overhand'],
    [/superman punch/i, 'superman-punch'],
    [/spinning back ?fist/i, 'spinning-back-fist'],
    [/side kick/i, 'side-kick'],
    [/oblique kick/i, 'oblique-kick'],
    [/question.?mark kick/i, 'question-mark-kick'],
    [/switch knee/i, 'switch-knee'],
    [/parry and catch/i, 'parry-catch'],
    [/bob and weave|roll under/i, 'bob-weave'],
    [/catch and return/i, 'catch-kick'],
    [/pull counter/i, 'pull-counter'],
    [/sit-?out/i, 'sit-out'],
    [/bear crawl/i, 'bear-crawl'],
    [/crab walk/i, 'crab-walk'],
    [/sled push/i, 'sled-push'],
    [/sled drag/i, 'sled-drag'],
    [/teep|push kick/i, 'teep'],
    [/kick check/i, 'kick-check'],
    [/roundhouse|switch kick|low kick|kick work|shin conditioning/i, 'roundhouse'],
    [/knee|clinch|plum|dteh chiang/i, 'knee-strike'],
    [/elbow|sok /i, 'elbow-strike'],
    [/uppercut/i, 'uppercut'],
    [/hook drill|teep-cross-hook/i, 'hook'],
    [/slip|parry/i, 'slip'],
    [/jab|cross drill|1-2|boxing combos|pad work/i, 'jab-cross'],
    [/sparring/i, 'fight-stance'],

    // ── conditioning ──
    [/burpee/i, 'burpee'],
    [/mountain climber/i, 'mountain-climber'],
    [/jumping jack/i, 'jumping-jack'],
    [/jump rope|double unders/i, 'jump-rope'],
    [/jump squat/i, 'jump-squat'],
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
    [/pike push/i, 'pike-push-up'],
    [/push-?up/i, 'push-up'],
    [/\bdips?\b/i, 'dip'],
    [/inverted row/i, 'inverted-row'],
    [/pull-?up|chin-?up/i, 'pull-up'],
    [/pulldown/i, 'lat-pulldown'],
    [/face pull/i, 'face-pull'],
    [/seated cable row|band row|cable row/i, 'seated-row'],
    [/row/i, 'bent-row'],
    [/bench press|dumbbell press|decline/i, 'bench-press'],
    [/fly|pec deck/i, 'chest-fly'],
    [/lateral raise/i, 'lateral-raise'],
    [/front raise/i, 'front-raise'],
    [/overhead tricep|tricep overhead|skull/i, 'tricep-overhead'],
    [/pushdown|tricep extension/i, 'pushdown'],
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
