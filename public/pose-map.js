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
    // Mobility drills that reuse the closest existing figure.
    [/hip airplane/i, 'hip-circle'],
    [/fire hydrant/i, 'quadruped-hip-cars'],
    [/clamshell/i, 'clamshell'],
    [/banded hip mobilization/i, 'kneeling-hip-flexor'],
    [/leg swing/i, 'hip-circle'],
    [/low lunge with twist/i, 'worlds-greatest'],
    [/windshield/i, 'supine-twist'],
    [/hurdle step/i, 'hip-circle'],
    [/walking knee hug/i, 'hip-circle'],
    [/walking quad pull/i, 'quad-stretch'],
    [/half-kneeling side bend/i, 'kneeling-hip-flexor'],
    [/crab reach/i, 'crab-reach'],
    [/kick chamber/i, 'kick-check'],
    [/quadruped thoracic rotation/i, 'thread-needle'],
    [/reverse tabletop/i, 'reverse-tabletop'],
    [/y-t-w/i, 'cobra'],
    [/side-lying (shoulder )?external rotation/i, 'side-lying-er'],
    [/band (shoulder )?external rotation/i, 'shoulder-er-band'],
    [/shoulder external rotation/i, 'prone-shoulder-er'],
    [/inchworm/i, 'downward-dog'],
    // ── movements that used to borrow a neighbour's figure (audit 2026-10-26) ──
    // massage-ball work (2026-11): no ball figure exists, so each reuses the closest existing pose
    [/peanut ball upper back/i, 'thoracic-extension'],
    [/lacrosse ball glute/i, 'figure-four'],
    [/lacrosse ball chest/i, 'doorway-chest'],
    [/spiky ball foot/i, 'stand-breathe'],
    [/lacrosse ball foot/i, 'stand-breathe'],
    // A null key means "no figure yet" (variety audit, step 3): matching stops here, so a looser rule
    // further down cannot hand the exercise a wrong figure ("upper trap" would take the neck stretch,
    // "wrist" the wrist circle). match() returns null and keyFor() falls to the category figure.
    // test/stick-figure.test.js lists these in NEEDS_POSE; author the pose, then change null to its key.
    // Inside Clinch Sweep (Dteh Chiang) is a sweep; the clinch-knee figure below would be a different move.
    [/inside clinch sweep|dteh chiang/i, null],
    // Gentle lymphatic drainage routine: skin strokes and neck movements; no figure drawn, and the neck-circle rule below must not claim them.
    [/lymph drainage/i, null],
    [/toe yoga|short foot|ankle eversion/i, null],
    // Expanded catalogue (2026-11): each new name reuses the closest existing figure. These sit up here so a
    // looser rule below ("knee", "incline", "squat", "lateral raise") cannot hand them a wrong or implement-mismatched one.
    [/upright row/i, null],   // no upright-row figure; the bent-over row would be a different lift
    [/glute kickback/i, null],   // the kickback figure is the triceps one
    [/hang clean/i, null],
    [/band shoulder adduction/i, null],
    [/seated hip (abduction|adduction)/i, null],
    [/knee push-?up/i, 'push-up'],
    [/knee plank/i, 'plank'],
    [/handstand push-?up/i, 'pike-push-up'],
    [/smith machine/i, 'chest-press'],
    [/barbell incline/i, 'bench-press'],   // no barbell incline figure; the flat barbell press is the nearest
    [/cable crossover/i, 'chest-fly'],
    [/incline .*fly/i, 'chest-fly'],
    [/incline .*curl/i, 'curl'],
    [/reverse (cable )?fly/i, 'chest-fly'],
    [/cable .*chest press/i, 'chest-press'],
    [/dumbbell push press/i, 'overhead-press-db'],
    [/barbell push jerk/i, 'overhead-press'],
    [/lateral raise \(machine\)/i, 'lateral-raise-bare'],
    [/shoulder internal rotation|band shoulder internal/i, 'side-lying-er'],
    [/cable .*row|row \(machine\)/i, 'seated-row'],
    [/back extension/i, 'cobra'],
    [/preacher/i, 'curl-barbell'],
    [/curl \(machine\)/i, 'curl-bare'],
    [/skull crusher/i, 'tricep-overhead-bare'],
    [/barbell shrug/i, 'shrug-bare'],
    [/half curl-?down/i, 'crunch'],
    [/torso rotation/i, 'seated-twist'],
    [/side-lying hip abduction/i, 'clamshell'],
    [/chair stand/i, 'squat'],
    [/suitcase deadlift/i, 'rdl'],
    [/tuck jump|vertical jump|broad jump|depth jump|lateral hop|split-squat jump/i, 'jump-squat'],
    [/spider crawl/i, 'bear-crawl'],
    [/pike walk/i, 'downward-dog'],
    [/shuffle|back-?pedal|a-skip|butt kick/i, 'run'],
    [/elliptical|stepper/i, 'run'],
    [/cable (hockey|golf|baseball|tennis)/i, 'wood-chop-cable'],
    [/^shoulder rolls/i, 'shrug-bare'],
    [/lacrosse ball forearm/i, 'ball-roll-forearm'],
    [/lacrosse ball hamstring/i, 'ball-roll-hamstring'],
    [/lacrosse ball calf/i, 'ball-roll-calf'],
    [/lacrosse ball quad/i, 'ball-roll-quad'],
    [/lacrosse ball (upper trap|lat) wall/i, 'wall-ball-roll'],
    [/tibialis raise/i, 'tibialis-raise'],
    [/wrist curl/i, 'wrist-curl'],
    [/wrist extensor stretch/i, 'wrist-flexor-stretch'],
    [/wrist rocks/i, 'wrist-rocks'],
    [/spanish squat/i, 'spanish-squat'],
    [/wall sit/i, 'wall-sit'],
    [/scapular pull/i, 'scapular-pull-up'],
    [/scapular push/i, 'scapular-push-up'],
    [/towel hang/i, 'dead-hang'],
    [/flexed-arm hang/i, 'flexed-arm-hang'],
    [/tuck l-sit/i, 'tuck-l-sit'],
    [/pseudo-planche/i, 'pseudo-planche-lean'],
    [/single-leg stand/i, 'single-leg-stand'],
    [/single-leg reach/i, 'single-leg-reach'],
    [/single-leg rdl/i, 'single-leg-rdl'],
    [/heel-to-toe/i, 'tandem-walk'],
    [/progressive muscle/i, 'supine-relax'],
    [/wall biceps stretch/i, 'wall-biceps-stretch'],
    [/behind-the-back chest opener/i, 'chest-opener'],
    [/crossover it band/i, 'standing-it-band'],
    [/ankle alphabet/i, 'ankle-circle'],
    [/granby/i, 'granby-roll'],
    [/upward elbow|sok ngad/i, 'upward-elbow'],
    [/quadruped hip/i, 'quadruped-hip-cars'],
    [/back roll/i, 'back-roll'],
    [/inversion/i, 'inversion'],
    [/neck bridge|wrestler'?s bridge/i, 'neck-bridge'],
    [/hip bump/i, 'hip-bump'],
    [/shoulder elevation shrug/i, 'shrug-bare'],
    [/shrug/i, 'shrug'],
    [/open book|shoulder windmill|bretzel/i, 'open-book'],
    [/sleeper/i, 'sleeper'],
    [/prone shoulder er\b|prone shoulder external/i, 'prone-shoulder-er'],
    [/rear delt fly/i, 'rear-delt-fly'],
    [/pullover/i, 'pullover'],
    [/chest press machine|machine chest press/i, 'chest-press'],
    [/incline/i, 'incline-press'],
    [/dumbbell (shoulder|arnold|overhead) press/i, 'overhead-press-db'],
    [/dumbbell bench press|decline dumbbell press/i, 'bench-press-db'],
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
    [/bodyweight bulgarian/i, 'bulgarian-split-squat-bare'],
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
    [/band pull-?apart/i, 'band-pull-apart'],
    [/breath/i, 'stand-breathe'],

    // ── techniques drawn by octopus-mma's poses (snapshot in public/poses/mma/, two-figure ones included).
    // Only where that pose IS the technique (or, for the mount, the position it is done from). Before these,
    // the same exercises fell to a generic one-figure guard / top-base / slip.
    [/armbar/i, 'mma/bjj-armbar'],
    [/triangle choke/i, 'mma/bjj-triangle-choke'],
    [/\bmount\b(?! escape)/i, 'mma/bjj-mount'],
    [/parry and counter/i, 'mma/muay-thai-parry'],
    [/clinch work|double collar tie|plum/i, 'mma/muay-thai-clinch-knee'],
    [/clinch knee . diagonal|diagonal knee/i, 'mma/muay-thai-diagonal-knee'],
    [/roundhouse kick . low/i, 'mma/muay-thai-low-kick'],
    [/roundhouse kick . body/i, 'mma/muay-thai-body-kick'],
    [/roundhouse kick . head/i, 'mma/muay-thai-head-kick'],
    [/^jab drill/i, 'mma/muay-thai-jab'],
    [/^cross drill/i, 'mma/muay-thai-cross'],
    [/horizontal elbow/i, 'mma/muay-thai-horizontal-elbow'],
    [/footwork . pivot/i, 'mma/muay-thai-footwork'],

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
    [/ab strap/i, 'hanging-leg-raise'],
    [/landmine punch/i, 'jab-cross'],
    [/landmine deadlift to rotational/i, 'landmine-deadlift-press'],
    [/landmine (rotational press|push press)/i, 'landmine-press'],
    [/landmine anti-rotation/i, 'landmine-anti-rotation'],
    [/landmine rotation/i, 'landmine-rotation'],
    [/landmine thruster/i, 'landmine-thruster'],
    [/landmine split jerk/i, 'split-jerk'],
    [/landmine meadows row/i, 'landmine-row'],
    [/landmine reverse lunge/i, 'reverse-lunge'],
    [/landmine lateral lunge/i, 'lateral-lunge'],
    [/hanging knee raise|captain'?s chair/i, 'hanging-leg-raise'],   // before the knee-strike rule below, which would take any "knee"
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
    [/^wood chop|cable wood chop/i, 'wood-chop-cable'],
    [/wood chop|rotational/i, 'wood-chop'],
    [/assault bike|bike|cycling/i, 'bike'],
    [/rowing machine|erg/i, 'rower'],
    [/treadmill|sprint|\brun\b|basketball|high knees/i, 'run'],
    [/farmer/i, 'farmers-carry'],
    [/suitcase carry/i, 'suitcase-carry'],
    [/plate pinch carry/i, 'plate-pinch-carry'],
    [/sandbag carry/i, 'sandbag-carry'],
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
    [/(cable|band) .*lateral raise/i, 'lateral-raise-bare'],
    [/lateral raise/i, 'lateral-raise'],
    [/front raise/i, 'front-raise'],
    [/^overhead tricep extension/i, 'tricep-overhead-bare'],
    [/overhead tricep|tricep overhead|skull/i, 'tricep-overhead'],
    [/pushdown|tricep extension/i, 'pushdown'],
    [/leg curl|hamstring curl/i, 'leg-curl'],
    [/ez-bar curl/i, 'curl-barbell'],
    [/(cable|band) .*curl/i, 'curl-bare'],
    [/curl/i, 'curl'],
    [/overhead press|shoulder press|arnold|military/i, 'overhead-press'],

    // ── strength: lower ──
    [/hip thrust/i, 'hip-thrust'],
    [/glute bridge|bridge/i, 'glute-bridge'],
    [/leg press/i, 'leg-press'],
    [/leg extension/i, 'leg-extension'],
    [/calf raise/i, 'calf-raise'],
    [/good morning/i, 'good-morning'],
    [/^romanian deadlift/i, 'rdl-barbell'],
    [/romanian|rdl|hinge/i, 'rdl'],
    [/deadlift/i, 'deadlift'],
    [/dumbbell walking lunge/i, 'walking-lunge-db'],
    [/walking lunge/i, 'walking-lunge'],
    [/reverse lunge/i, 'reverse-lunge'],
    [/lateral lunge/i, 'lateral-lunge'],
    [/dumbbell lunge/i, 'forward-lunge-db'],
    [/(forward|front) lunge/i, 'forward-lunge'],
    [/lunge|split squat|step-?up/i, 'lunge'],
    [/barbell front squat|front squat/i, 'front-squat'],
    [/barbell hack squat/i, 'barbell-hack-squat'],
    [/barbell (back|pendulum) squat|back squat/i, 'back-squat'],
    [/plate goblet/i, 'goblet-squat-plate'],
    [/goblet/i, 'goblet-squat'],
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
    RULES.forEach(function (r) { if (r[1]) seen[r[1]] = true; });
    for (var c in BY_CATEGORY) seen[BY_CATEGORY[c]] = true;
    seen[FALLBACK] = true;
    return Object.keys(seen).sort();
  }

  return { keyFor: keyFor, match: match, keys: keys, RULES: RULES, BY_CATEGORY: BY_CATEGORY };
}));
