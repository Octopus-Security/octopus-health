'use strict';

/**
 * mobility.js - ready-made mobility / prep / injury-prevention routines, linked to
 * the joints and muscles the Body Map uses (personal-training roadmap phase 4).
 *
 *   GET  /mobility/api/routines          all routines + today's done flags (ET)
 *   GET  /mobility/api/joint/:id         drills for one joint
 *   GET  /mobility/api/muscle/:id        drills for one muscle
 *   POST /mobility/api/done  { routine, done?: true|false }   log (or undo) today
 *
 * The routines are code, not rows: nothing to seed, nothing to migrate. The only
 * state is "did I do routine R on ET date D", kept as a UserSetting row
 * `routineDone:<routine>:<date>` in the account's OWN sqlite file (database per
 * user, so no owner column). Additive, no schema change.
 *
 * Every item names joint ids and muscle ids from lib/muscles.js; the test fails
 * if one does not exist. `pose` is optional: items with no figure are text only.
 * `demo` is the library-style name StretchDemo/PoseMap resolves to a figure.
 *
 * Gear. An item may carry `requires` (equipment ids from the catalogue, "a|b" = either),
 * `tool` (a short plain cue shown when the gear is there: "Use the lacrosse ball") and
 * `alt` (what to do instead when it is not: { name, rx?, cue, demo }). fitRoutines() applies
 * the person's active gym: gear present -> the item shows its tool; gear absent -> the
 * alternative takes its place, labelled; no alternative -> the item is listed as left out.
 * Nothing is dropped silently, and the "stop if sharp pain" line stays the single NOTE.
 */

const M = require('../lib/muscles');
const { RECOVERY_NOTE } = require('../lib/recovery-note');
const E = require('./equipment');

const NOTE = 'Stretch to tension, not pain. If an Achilles, knee or groin hurts more the next morning, back off and get it checked. Times and counts are starting points; do less when a movement is new, and build up slowly for the neck, loaded wrists and knees. ' + RECOVERY_NOTE;

const item = (id, name, rx, joints, muscles, cue, demo, gear) => ({ id, name, rx, joints, muscles, cue, demo: demo || name, ...(gear || {}) });

const ROUTINES = [
  {
    id: 'daily-10', name: 'Daily 10', minutes: 10, kind: 'daily',
    blurb: 'Hips, calves, Achilles, upper back and neck. Every day.',
    items: [
      item('hip-flexor-glute', 'Half-kneeling hip-flexor stretch with glute squeeze', '45 s each side', ['hip', 'lumbar_spine'], ['hip_flexors', 'glutes'],
        'Back knee down, squeeze the back-leg glute, ribs down, lean forward until you feel the front of the hip.', 'Couch Stretch'),
      item('calf-wall-straight', 'Calf wall stretch, straight knee', '30 s each side', ['ankle', 'knee'], ['calves'],
        'Hands on the wall, back leg straight, heel down.', 'Calf Stretch'),
      item('calf-wall-bent', 'Calf wall stretch, bent knee (soleus)', '30 s each side', ['ankle', 'knee'], ['calves'],
        'Same stance, soften the back knee and keep the heel down.', 'Calf Stretch'),
      item('split-squat-ktoes', 'Slow knees-over-toes split squat', '1 x 10 each side', ['knee', 'ankle', 'hip'], ['quads', 'calves'],
        'Slow, heel down, let the knee travel past the toes, pain-free range only.', 'Split Squat'),
      item('heel-drop', 'Eccentric heel drops off a step', '2 x 10, 3 s down', ['ankle'], ['calves'],
        'Rise on both feet, lower on one for 3 seconds. Achilles work: go easy at first.', 'Calf Raise',
        { requires: ['step|chair'], tool: 'Use a step or the edge of a stair',
          alt: { name: 'Slow calf raises on the floor', cue: 'Rise on both feet, lower on one for 3 seconds on flat ground. Go easy at first.', demo: 'Calf Raise' } }),
      item('open-book', 'Open-book rotation', '5 each side', ['thoracic_spine', 'shoulder'], ['traps', 'lats'],
        'Side-lying, knees stacked, open the top arm and follow it with your eyes.', 'Open Book'),
      item('neck-cars-iso', 'Neck circles + isometric hand presses', '10 s each direction', ['neck'], ['neck', 'traps'],
        'Slow circles in a small, comfortable range, then press a hand into your head and hold without moving. Stop for dizziness, sharp pain or tingling in the arms.', 'Neck Circle'),
    ],
  },
  {
    id: 'pre-training', name: 'Pre-training warm-up', minutes: 5, kind: 'warmup',
    blurb: 'All dynamic. Before any session.',
    items: [
      item('hip-cars', 'Hip CARs', '5 slow circles each side', ['hip'], ['hip_flexors', 'glutes', 'adductors'], 'Biggest pain-free circle, rest of the body still.', 'Quadruped Hip CARs'),
      item('shoulder-cars', 'Shoulder CARs', '5 slow circles each side', ['shoulder'], ['rotator_cuff', 'front_delts', 'rear_delts'], 'Reach long and make the biggest circle you can without pain.', 'Shoulder CARs'),
      item('leg-swings', 'Leg swings', '10 each direction, each leg', ['hip'], ['hamstrings', 'hip_flexors', 'adductors'], 'Front-back then side-side, easy range first.', 'Hip Circle'),
      item('ankle-rocks', 'Ankle rocks', '10 each side', ['ankle', 'knee'], ['calves'], 'Knee over the toes, heel stays down.', 'Ankle Dorsiflexion'),
      item('band-pull-aparts', 'Band pull-aparts', '15', ['shoulder', 'thoracic_spine'], ['rear_delts', 'traps'], 'Arms straight, pull the band to your chest.', 'Band Pull-Apart',
        { requires: ['resistance-bands'], tool: 'Use a resistance band',
          alt: { name: 'Wall slides', rx: '10', cue: 'Back and forearms against a wall, slide the arms up and down.', demo: 'Wall Slide' } }),
    ],
  },
  {
    id: 'injury-prevention', name: 'Durability strength', minutes: 15, kind: 'strength', perWeek: 2,
    blurb: 'About 15 minutes, twice a week (attached to training days A and C of the week plan).',
    items: [
      item('copenhagen', 'Copenhagen side plank', '2 x 20 s each side', ['hip', 'knee'], ['adductors'], 'Bottom leg supported on a bench, short lever first. Stop if the groin or hip hurts.', 'Side Plank',
        { requires: ['chair|weight-bench'], tool: 'Use a chair or bench',
          alt: { name: 'Side-lying inner-thigh raise', rx: '2 x 12 each side', cue: 'Lie on your side with the top knee bent and its foot on the floor in front. Lift the bottom leg, then lower it slowly.', demo: 'Side Plank' } }),
      item('tib-raise', 'Tibialis raises', '2 x 15', ['ankle', 'knee'], ['calves'], 'Heels on the floor, back to a wall, lift the toes.'),
      item('band-er', 'Band external rotations', '2 x 15 each side', ['shoulder'], ['rotator_cuff', 'rear_delts'], 'Elbow at your side, rotate out, slow back.', 'Prone Shoulder ER',
        { requires: ['resistance-bands'], tool: 'Use a resistance band',
          alt: { name: 'Side-lying external rotation', cue: 'Lie on your side, elbow bent at your side, rotate the forearm up with no weight, slow back.', demo: 'Prone Shoulder ER' } }),
      item('face-pull', 'Face pulls', '2 x 15', ['shoulder', 'thoracic_spine'], ['rear_delts', 'traps', 'rotator_cuff'], 'Pull to the eyes, elbows high.', 'Resistance Band Face Pull',
        { requires: ['resistance-bands'], tool: 'Use a resistance band anchored at head height' }),
      item('sl-bridge', 'Single-leg bridge or hamstring walkouts', '2 x 8 each side', ['hip', 'knee'], ['hamstrings', 'glutes'], 'Lower slowly. Stop if the back of the thigh cramps or hurts.', 'Glute Bridge'),
      item('finger-wrist', 'Band finger extensions + wrist curls', '2 x 15 each', ['wrist', 'elbow'], ['forearms'], 'Open against the band, then light wrist curls.', undefined,
        { requires: ['resistance-bands'], tool: 'Use a light band',
          alt: { name: 'Finger spreads + wrist curls', cue: 'Spread the fingers wide and hold, then slow wrist curls with an empty hand.', demo: 'Finger Extension Stretch' } }),
      item('side-plank', 'Side plank', '2 x 30 s each side', ['lumbar_spine'], ['obliques', 'glutes'], 'Straight line from ankle to ear.', 'Side Plank'),
      item('dead-bug', 'Dead bug', '2 x 8 each side', ['lumbar_spine', 'hip'], ['abs', 'hip_flexors'], 'Low back stays flat, move slowly.', 'Dead Bug'),
    ],
  },
  {
    id: 'sunday-flow', name: 'Sunday flow', minutes: 30, kind: 'flow',
    blurb: '20-30 minutes, slow and easy.',
    items: [
      item('9090', '90/90 hip switches', '10 switches', ['hip'], ['piriformis', 'glutes', 'adductors'], 'Sit tall, rotate both knees across without using your hands if you can.', '90/90'),
      item('pigeon', 'Pigeon', '60 s each side', ['hip'], ['glutes', 'piriformis', 'hip_flexors'], 'Fold forward over the front shin only as far as is comfortable.', 'Pigeon'),
      item('cossack', 'Cossack squat', '8 each side', ['hip', 'knee', 'ankle'], ['adductors', 'quads', 'glutes'], 'Sit into one hip, other leg straight, toes up.', 'Cossack'),
      item('pancake', 'Pancake', '90 s', ['hip', 'lumbar_spine'], ['adductors', 'hamstrings'], 'Legs wide, hinge forward from the hips.', 'Seated Fold'),
      item('ball-foot', 'Spiky ball foot roll', '45 s each foot', ['ankle'], ['calves'],
        'Light pressure, slow rolling front to back, a hand on a wall for balance.', 'Spiky Ball Foot Roll',
        { requires: ['massage-ball-spiky'], tool: 'Use the spiky ball' }),
      item('ball-upper-back', 'Peanut ball upper-back release', '60 s', ['thoracic_spine'], ['traps', 'lats'],
        'Lie back with the spine in the groove, one ball either side of it, never on it. Roll slowly through the upper back only.', 'Peanut Ball Upper Back Release',
        { requires: ['massage-ball-peanut'], tool: 'Use the peanut ball',
          alt: { name: 'Open book', rx: '5 each side', cue: 'Side-lying, knees stacked, open the top arm and follow it with your eyes.', demo: 'Thoracic Open Book' } }),
      item('ball-glute', 'Lacrosse ball glute release', '60 s each side', ['hip'], ['glutes', 'piriformis'],
        'Sit on the ball under the fleshy part of the buttock, hands behind you. Keep it off the tailbone, hip bone and back of the thigh.', 'Lacrosse Ball Glute Release',
        { requires: ['massage-ball-lacrosse'], tool: 'Use the lacrosse ball',
          alt: { name: 'Figure-4 stretch on your back', rx: '45 s each side', cue: 'Ankle over the opposite knee, draw both legs toward you.', demo: 'Supine Piriformis Stretch' } }),
      item('ball-chest', 'Lacrosse ball chest and shoulder release', '45 s each side', ['shoulder'], ['chest', 'front_delts'],
        'Ball between a wall and the meaty part of the chest, below the collarbone. Small slow movements. Keep it off the collarbone, armpit and front of the neck.', 'Lacrosse Ball Chest and Shoulder Release',
        { requires: ['massage-ball-lacrosse'], tool: 'Use the lacrosse ball',
          alt: { name: 'Doorway chest stretch', rx: '30 s each side', cue: 'Forearm on the door frame, step through until the chest stretches.', demo: 'Doorway Chest Stretch' } }),
      item('childs-pose', "Child's pose", '60 s', ['lumbar_spine', 'shoulder', 'hip'], ['lats', 'lower_back'], 'Sink the hips back, breathe into the ribs.', "Child's Pose"),
      item('thread-needle', 'Thread the needle', '45 s each side', ['thoracic_spine', 'shoulder'], ['traps', 'rear_delts'], 'Slide one arm under the other, rotate through the upper back.', 'Thread The Needle'),
    ],
  },
  {
    id: 'run-pre', name: 'Pre-run', minutes: 4, kind: 'run',
    blurb: 'Dynamic, before a run.',
    items: [
      item('a-skips', 'A-skips', '2 x 20 m', ['hip', 'ankle'], ['hip_flexors', 'calves'], 'Tall, quick, knee up and foot down under you.', 'Run'),
      item('run-leg-swings', 'Leg swings', '10 each leg', ['hip'], ['hamstrings', 'hip_flexors'], 'Hold a wall, swing front to back.', 'Hip Circle'),
      item('ankle-pogo', 'Ankle pogo hops', '2 x 15', ['ankle', 'knee'], ['calves'], 'Stiff ankles, quick and quiet, stay light.', 'Jump Rope'),
    ],
  },
  {
    id: 'run-post', name: 'Post-run', minutes: 5, kind: 'run',
    blurb: 'Calves, hip flexors and hamstrings after a run.',
    items: [
      item('post-calf', 'Calf and soleus wall stretch', '30 s each leg, straight then bent', ['ankle', 'knee'], ['calves'], 'Heel down, straight knee then bent.', 'Calf Stretch'),
      item('post-hip-flexor', 'Hip-flexor stretch', '45 s each side', ['hip', 'lumbar_spine'], ['hip_flexors'], 'Half-kneeling, squeeze the glute.', 'Couch Stretch'),
      item('post-hamstring', 'Hamstring stretch', '45 s each side', ['hip', 'knee'], ['hamstrings'], 'Heel out in front, hinge from the hips.', 'Standing Hamstring Stretch'),
    ],
  },
  // ── Variety (step 3): longer and shorter sessions for rest days, shifts, grappling and the small kit.
  // Every `demo` is the exact name of a seeded exercise, so each item opens a real card. Times are starting points.
  {
    id: 'rest-day-flow', name: 'Rest-day flow', minutes: 18, kind: 'flow',
    blurb: '15-20 minutes, slow and easy, for a day without training.',
    items: [
      item('rf-belly', 'Belly breathing, lying down', '8 slow breaths', ['lumbar_spine'], ['abs'], 'Knees bent, one hand on the belly. Slow breath in through the nose, slow breath out.', 'Belly Breathing (Lying)'),
      item('rf-catcow', 'Cat-cow', '8 slow rounds', ['lumbar_spine', 'thoracic_spine'], ['lower_back', 'abs'], 'On hands and knees, move with the breath and stay in a comfortable range.', 'Cat-Cow'),
      item('rf-wgs', "World's greatest stretch", '4 each side', ['hip', 'thoracic_spine'], ['hip_flexors', 'hamstrings', 'glutes'], 'Long lunge, elbow toward the instep, then open the chest.', "World's Greatest Stretch"),
      item('rf-9090', '90/90 hip switches', '8 switches', ['hip'], ['piriformis', 'glutes', 'adductors'], 'Sit tall and rotate both knees across; use your hands if you need to.', '90/90 Hip Switch'),
      item('rf-pigeon', 'Pigeon', '45 s each side', ['hip', 'knee'], ['glutes', 'piriformis'], 'Fold over the front shin only as far as is comfortable. Skip it if the front knee complains.', 'Pigeon Stretch'),
      item('rf-ham', 'Supine hamstring stretch', '40 s each side', ['hip', 'knee'], ['hamstrings'], 'On your back, loop a towel or band around the foot and lift the leg until you feel the back of the thigh.', 'Supine Hamstring Stretch'),
      item('rf-calf', 'Calf wall stretch', '30 s each side', ['ankle', 'knee'], ['calves'], 'Hands on the wall, back leg straight, heel down.', 'Standing Calf Stretch (Wall)'),
      item('rf-openbook', 'Open book', '6 each side', ['thoracic_spine', 'shoulder'], ['traps', 'lats'], 'Side-lying, knees stacked, open the top arm and follow it with your eyes.', 'Thoracic Open Book'),
      item('rf-chest', 'Doorway chest stretch', '30 s each side', ['shoulder'], ['chest', 'front_delts'], 'Forearm on the door frame, step through until you feel the chest.', 'Doorway Chest Stretch'),
      item('rf-glute-ball', 'Lacrosse ball on the glute', '45 s each side', ['hip'], ['glutes', 'piriformis'],
        'Sit on the ball under the fleshy part of the buttock, hands behind you. Keep it off the tailbone, hip bone and back of the thigh.', 'Lacrosse Ball Glute Release',
        { requires: ['massage-ball-lacrosse'], tool: 'Use the lacrosse ball',
          alt: { name: 'Figure-4 stretch, standing', rx: '30 s each side', cue: 'Ankle over the opposite knee, sit back as if into a chair, hand on a wall for balance.', demo: 'Standing Figure-4 Stretch' } }),
      item('rf-legsup', 'Legs up the wall', '2 min', ['hip', 'lumbar_spine'], ['hamstrings', 'lower_back'], 'Seat near the wall, legs resting up it, arms loose. Bend the knees if the backs of the legs pull.', 'Legs Up the Wall'),
    ],
  },
  {
    id: 'light-day-recovery', name: 'Light-day recovery', minutes: 15, kind: 'recovery',
    blurb: 'Easy joint work and a little soft-tissue time for a light training day.',
    items: [
      item('ld-hip-cars', 'Hip CARs', '4 slow circles each side', ['hip'], ['hip_flexors', 'glutes', 'adductors'], 'Biggest comfortable circle, rest of the body still.', 'Quadruped Hip CARs'),
      item('ld-shoulder-cars', 'Shoulder CARs', '4 slow circles each side', ['shoulder'], ['rotator_cuff', 'front_delts', 'rear_delts'], 'Reach long and make the biggest circle you can without pain.', 'Shoulder CARS'),
      item('ld-ankle-cars', 'Ankle CARs', '4 each direction, each foot', ['ankle'], ['calves'], 'Slow circles from the ankle with the leg still.', 'Ankle CARS'),
      item('ld-pullaparts', 'Band pull-aparts', '12 light', ['shoulder', 'thoracic_spine'], ['rear_delts', 'traps'], 'Arms straight, pull the band to your chest with an easy band.', 'Band Pull-Apart',
        { requires: ['resistance-bands'], tool: 'Use a light resistance band',
          alt: { name: 'Wall slides', rx: '8', cue: 'Back and forearms against a wall, slide the arms up and down.', demo: 'Wall Slide' } }),
      item('ld-hang', 'Easy hang', '2 x 15 s', ['shoulder'], ['lats', 'forearms'], 'Shoulders pulled gently down, breathe normally, step down well before the grip fades.', 'Dead Hang',
        { requires: ['bar'], tool: 'Use the pull-up bar' }),
      item('ld-bridge', 'Glute bridge', '10', ['hip', 'lumbar_spine'], ['glutes', 'hamstrings'], 'Feet flat, press through the heels, squeeze at the top and lower slowly.', 'Glute Bridge'),
      item('ld-deadbug', 'Dead bug', '6 each side', ['lumbar_spine', 'hip'], ['abs', 'hip_flexors'], 'Low back stays on the floor, move slowly.', 'Dead Bug'),
      item('ld-foot-ball', 'Spiky ball foot roll', '45 s each foot', ['ankle'], ['calves'], 'Light pressure, slow rolling front to back, a hand on a wall for balance.', 'Spiky Ball Foot Roll',
        { requires: ['massage-ball-spiky'], tool: 'Use the spiky ball',
          alt: { name: 'Ankle alphabet', rx: 'one pass each foot', cue: 'Trace the letters A to Z with the big toe, moving from the ankle.', demo: 'Ankle Alphabet' } }),
      item('ld-upper-ball', 'Peanut ball upper-back work', '60 s', ['thoracic_spine'], ['traps', 'lats'],
        'Lie back with the spine in the groove, one ball either side of it, never on it. Roll slowly through the upper back only.', 'Peanut Ball Upper Back Release',
        { requires: ['massage-ball-peanut'], tool: 'Use the peanut ball',
          alt: { name: 'Open book', rx: '5 each side', cue: 'Side-lying, knees stacked, open the top arm and follow it with your eyes.', demo: 'Thoracic Open Book' } }),
      item('ld-child', "Child's pose", '60 s', ['lumbar_spine', 'shoulder', 'hip'], ['lats', 'lower_back'], 'Sink the hips back and breathe into the ribs.', "Child's Pose"),
    ],
  },
  {
    id: 'post-shift-winddown', name: 'Post-shift wind-down', minutes: 10, kind: 'winddown',
    blurb: 'For after a long shift on your feet. Slow stretches, then slow breathing.',
    items: [
      item('ps-fold', 'Standing forward fold', '30 s', ['lumbar_spine', 'hip'], ['hamstrings', 'lower_back'], 'Soft knees, let the head hang, and come up slowly.', 'Standing Forward Fold'),
      item('ps-calf', 'Calf wall stretch', '30 s each side', ['ankle', 'knee'], ['calves'], 'Hands on the wall, back leg straight, heel down.', 'Standing Calf Stretch (Wall)'),
      item('ps-hipflexor', 'Half-kneeling hip-flexor stretch', '30 s each side', ['hip', 'lumbar_spine'], ['hip_flexors'], 'Back knee down, squeeze the back-leg glute, ribs down.', 'Half-Kneeling Hip Flexor Stretch'),
      item('ps-chest', 'Doorway chest stretch', '30 s each side', ['shoulder'], ['chest', 'front_delts'], 'Forearm on the door frame, step through until you feel the chest.', 'Doorway Chest Stretch'),
      item('ps-foot', 'Lacrosse ball foot roll', '45 s each foot', ['ankle'], ['calves'], 'Light pressure, slow rolling front to back, a hand on a wall for balance. Stay off the toes.', 'Lacrosse Ball Foot Roll',
        { requires: ['massage-ball-lacrosse'], tool: 'Use the lacrosse ball',
          alt: { name: 'Ankle alphabet', rx: 'one pass each foot', cue: 'Trace the letters A to Z with the big toe, moving from the ankle.', demo: 'Ankle Alphabet' } }),
      item('ps-legsup', 'Legs up the wall', '3 min', ['hip', 'lumbar_spine'], ['hamstrings', 'lower_back'], 'Seat near the wall, legs resting up it, arms loose.', 'Legs Up the Wall'),
      item('ps-exhale', 'Extended-exhale breathing', '2 min', ['lumbar_spine'], ['abs'], 'In through the nose for 4, out slowly for 6. Keep it easy; many people find it calming.', 'Extended Exhale Breathing'),
    ],
  },
  {
    id: 'pre-sleep-10', name: 'Pre-sleep 10', minutes: 10, kind: 'winddown',
    blurb: 'Gentle floor work and slow breathing before bed. Keep the lights low if you like.',
    items: [
      item('sl-child', "Child's pose", '60 s', ['lumbar_spine', 'shoulder', 'hip'], ['lats', 'lower_back'], 'Sink the hips back and breathe into the ribs.', "Child's Pose"),
      item('sl-twist', 'Supine spinal twist', '30 s each side', ['lumbar_spine', 'thoracic_spine'], ['obliques', 'lower_back'], 'Knees to one side, shoulders stay down, turn the head away only if comfortable.', 'Supine Spinal Twist'),
      item('sl-kneechest', 'Knee-to-chest', '30 s each side', ['hip', 'lumbar_spine'], ['glutes', 'lower_back'], 'Hug one knee in, the other leg long or bent.', 'Supine Knee-to-Chest'),
      item('sl-legsup', 'Legs up the wall', '2 min', ['hip', 'lumbar_spine'], ['hamstrings', 'lower_back'], 'Seat near the wall, legs resting up it, arms loose.', 'Legs Up the Wall'),
      item('sl-pmr', 'Progressive muscle relaxation', 'one slow pass, about 3 min', ['lumbar_spine'], ['abs'], 'Tense each area mildly for about 5 seconds, let it go for 10 to 15. Skip any sore area.', 'Progressive Muscle Relaxation'),
      item('sl-belly', 'Belly breathing, lying down', '2 min', ['lumbar_spine'], ['abs'], 'One hand on the belly. Slow breath in through the nose, slower breath out.', 'Belly Breathing (Lying)'),
    ],
  },
  {
    id: 'desk-reset', name: 'Desk or long-shift reset', minutes: 5, kind: 'reset',
    blurb: 'Five minutes in work clothes, standing or at a chair.',
    items: [
      item('dr-chin', 'Chin tucks', '6, hold 3 s', ['neck'], ['neck'], 'Draw the chin straight back, small and gentle. Stop for dizziness or tingling in the arms.', 'Chin Tuck'),
      item('dr-trap', 'Upper trap stretch', '20 s each side', ['neck'], ['traps', 'neck'], 'Ear toward the shoulder, no pulling. Keep the other shoulder down.', 'Upper Trap Stretch'),
      item('dr-wallslide', 'Wall slides', '8', ['shoulder', 'thoracic_spine'], ['rear_delts', 'traps'], 'Back and forearms against a wall, slide the arms up and down.', 'Wall Slide'),
      item('dr-wrist', 'Wrist flexor stretch', '20 s each side', ['wrist'], ['forearms'], 'Arm out, palm up, fingers gently back with the other hand.', 'Wrist Flexor Stretch'),
      item('dr-quad', 'Standing quad stretch', '20 s each side', ['knee', 'hip'], ['quads', 'hip_flexors'], 'Hold a wall or chair for balance, heel toward the buttock, knees together.', 'Standing Quad Stretch'),
      item('dr-calf', 'Calf wall stretch', '20 s each side', ['ankle', 'knee'], ['calves'], 'Hands on the wall, back leg straight, heel down.', 'Standing Calf Stretch (Wall)'),
      item('dr-box', 'Box breathing', '3 rounds', ['thoracic_spine'], ['abs'], 'In 4, hold 4, out 4, hold 4. Shorten the counts if the holds feel uncomfortable.', 'Box Breathing'),
    ],
  },
  {
    id: 'post-grappling', name: 'Post-grappling neck and hips', minutes: 12, kind: 'recovery',
    blurb: 'Gentle, after rolling or drilling. Neck work stays small and slow.',
    items: [
      item('pg-chin', 'Chin tucks', '6, hold 3 s', ['neck'], ['neck'], 'Draw the chin straight back, small and gentle. Stop for dizziness or tingling in the arms.', 'Chin Tuck'),
      item('pg-turns', 'Neck rotation turns', '5 each way', ['neck'], ['neck', 'traps'], 'Turn slowly to look over each shoulder, only as far as is comfortable. No forcing the end of the range.', 'Neck Rotation Turns'),
      item('pg-trap', 'Upper trap stretch', '20 s each side', ['neck'], ['traps', 'neck'], 'Ear toward the shoulder, no pulling.', 'Upper Trap Stretch'),
      item('pg-levator', 'Levator scapulae stretch', '20 s each side', ['neck', 'shoulder'], ['neck', 'traps'], 'Look toward the armpit, light weight of the hand only.', 'Levator Scapulae Stretch'),
      item('pg-9090', '90/90 hip switches', '6 switches', ['hip'], ['piriformis', 'glutes', 'adductors'], 'Sit tall and rotate both knees across.', '90/90 Hip Switch'),
      item('pg-fig4', 'Supine piriformis stretch', '30 s each side', ['hip'], ['piriformis', 'glutes'], 'On your back, ankle over the opposite knee, draw both legs toward you.', 'Supine Piriformis Stretch'),
      item('pg-butterfly', 'Butterfly stretch', '40 s', ['hip', 'knee'], ['adductors'], 'Soles together, sit tall, let the knees drop. Do not press on them.', 'Butterfly Stretch'),
      item('pg-wristcars', 'Wrist CARs', '5 each direction', ['wrist'], ['forearms'], 'Biggest comfortable circle, slow.', 'Wrist CARS'),
      item('pg-finger', 'Finger extension stretch', '8', ['wrist'], ['forearms'], 'Open the fingers wide against a light stretch, then relax.', 'Finger Extension Stretch'),
    ],
  },
  {
    id: 'wrist-prep', name: 'Wrists before parallettes or push-ups', minutes: 5, kind: 'prep',
    blurb: 'Warm the wrists before they carry body weight. Start light and build up over weeks.',
    items: [
      item('wp-cars', 'Wrist CARs', '5 each direction', ['wrist'], ['forearms'], 'Biggest comfortable circle, slow.', 'Wrist CARS'),
      item('wp-rocks', 'Quadruped wrist rocks', '8 per hand position', ['wrist'], ['forearms'], 'Hands under the shoulders, small slow rocks with the palms flat. Sit back toward the heels if they complain.', 'Quadruped Wrist Rocks'),
      item('wp-pronsup', 'Pronation and supination circles', '8 each way', ['wrist', 'elbow'], ['forearms'], 'Elbow at the side, turn the palm up then down, slowly.', 'Pronation/Supination Circles'),
      item('wp-flexor', 'Wrist flexor stretch', '20 s each side', ['wrist'], ['forearms'], 'Arm out, palm up, fingers gently back with the other hand.', 'Wrist Flexor Stretch'),
      item('wp-extensor', 'Wrist extensor stretch', '20 s each side', ['wrist'], ['forearms'], 'Arm out, palm down, gently bend the hand toward you with the other hand.', 'Wrist Extensor Stretch'),
      item('wp-curl', 'Band wrist curls, light', '1 x 12 each arm', ['wrist', 'elbow'], ['forearms'], 'Forearm on the thigh, palm up, light band under the foot, curl up and lower slowly.', 'Band Wrist Curl',
        { requires: ['resistance-bands'], tool: 'Use a light resistance band' }),
    ],
  },
  {
    id: 'hips-hamstrings-ball', name: 'Hips and hamstrings with a lacrosse ball', minutes: 12, kind: 'recovery',
    blurb: 'Ball work on the back and front of the legs, then two stretches.',
    items: [
      item('hh-glute', 'Lacrosse ball on the glute', '45 s each side', ['hip'], ['glutes', 'piriformis'],
        'Sit on the ball under the fleshy part of the buttock, hands behind you. Keep it off the tailbone, hip bone and back of the thigh.', 'Lacrosse Ball Glute Release',
        { requires: ['massage-ball-lacrosse'], tool: 'Use the lacrosse ball',
          alt: { name: 'Figure-4 stretch, standing', rx: '30 s each side', cue: 'Ankle over the opposite knee, sit back as if into a chair, hand on a wall for balance.', demo: 'Standing Figure-4 Stretch' } }),
      item('hh-ham', 'Lacrosse ball hamstring roll', '45 s each leg', ['hip', 'knee'], ['hamstrings'],
        'Ball under the back of the thigh, hands behind you, small slow rolls. Keep it off the sit bone and the back of the knee.', 'Lacrosse Ball Hamstring Roll',
        { requires: ['massage-ball-lacrosse'], tool: 'Use the lacrosse ball',
          alt: { name: 'Supine hamstring stretch', rx: '40 s each side', cue: 'On your back, loop a towel or band around the foot and lift the leg.', demo: 'Supine Hamstring Stretch' } }),
      item('hh-quad', 'Lacrosse ball quad roll', '45 s each leg', ['hip', 'knee'], ['quads'],
        'Face down on the forearms, ball under the front of the thigh. Keep it off the kneecap and the hip bone.', 'Lacrosse Ball Quad Roll',
        { requires: ['massage-ball-lacrosse'], tool: 'Use the lacrosse ball',
          alt: { name: 'Prone quad stretch', rx: '30 s each side', cue: 'Face down, heel toward the buttock with a hand, band or towel.', demo: 'Prone Quad Stretch' } }),
      item('hh-calf', 'Lacrosse ball calf roll', '45 s each leg', ['ankle', 'knee'], ['calves'],
        'Calf on the ball, hips lifted, slow rolls. Keep it off the back of the knee and the Achilles.', 'Lacrosse Ball Calf Roll',
        { requires: ['massage-ball-lacrosse'], tool: 'Use the lacrosse ball',
          alt: { name: 'Calf wall stretch', rx: '30 s each side', cue: 'Hands on the wall, back leg straight, heel down.', demo: 'Standing Calf Stretch (Wall)' } }),
      item('hh-hipflexor', 'Half-kneeling hip-flexor stretch', '30 s each side', ['hip', 'lumbar_spine'], ['hip_flexors'], 'Back knee down, squeeze the back-leg glute, ribs down.', 'Half-Kneeling Hip Flexor Stretch'),
      item('hh-9090', '90/90 hip switches', '8 switches', ['hip'], ['piriformis', 'glutes', 'adductors'], 'Sit tall and rotate both knees across.', '90/90 Hip Switch'),
    ],
  },
  {
    id: 'full-body-ball', name: 'Full-body massage ball session', minutes: 20, kind: 'recovery',
    blurb: 'A slow pass over the main areas with the balls you have. Light pressure, small movements.',
    items: [
      item('fb-upper', 'Peanut ball upper-back work', '60 s', ['thoracic_spine'], ['traps', 'lats'],
        'Lie back with the spine in the groove, one ball either side of it, never on it. Roll slowly through the upper back only.', 'Peanut Ball Upper Back Release',
        { requires: ['massage-ball-peanut'], tool: 'Use the peanut ball',
          alt: { name: 'Open book', rx: '5 each side', cue: 'Side-lying, knees stacked, open the top arm and follow it with your eyes.', demo: 'Thoracic Open Book' } }),
      item('fb-trap', 'Lacrosse ball upper trap wall roll', '30 s each side', ['shoulder', 'neck'], ['traps'],
        'Ball between the top of the shoulder and a wall, small slow movements. Keep it off the neck, spine and the bony point of the shoulder.', 'Lacrosse Ball Upper Trap Wall Roll',
        { requires: ['massage-ball-lacrosse'], tool: 'Use the lacrosse ball',
          alt: { name: 'Upper trap stretch', rx: '20 s each side', cue: 'Ear toward the shoulder, no pulling.', demo: 'Upper Trap Stretch' } }),
      item('fb-lat', 'Lacrosse ball lat wall roll', '30 s each side', ['shoulder'], ['lats'],
        'Side-on to a wall, arm raised, ball behind the armpit on the side of the back. Keep it off the spine and out of the armpit.', 'Lacrosse Ball Lat Wall Roll',
        { requires: ['massage-ball-lacrosse'], tool: 'Use the lacrosse ball',
          alt: { name: "Child's pose", rx: '45 s', cue: 'Sink the hips back and breathe into the ribs.', demo: "Child's Pose" } }),
      item('fb-chest', 'Lacrosse ball chest and shoulder work', '30 s each side', ['shoulder'], ['chest', 'front_delts'],
        'Ball between a wall and the meaty part of the chest, below the collarbone. Keep it off the collarbone, armpit and front of the neck.', 'Lacrosse Ball Chest and Shoulder Release',
        { requires: ['massage-ball-lacrosse'], tool: 'Use the lacrosse ball',
          alt: { name: 'Doorway chest stretch', rx: '30 s each side', cue: 'Forearm on the door frame, step through until the chest stretches.', demo: 'Doorway Chest Stretch' } }),
      item('fb-forearm', 'Lacrosse ball forearm roll', '30 s each arm', ['wrist', 'elbow'], ['forearms'],
        'Forearm on a table with the ball under it, light pressure. Keep it off the wrist crease and the elbow point; ease off if the hand tingles.', 'Lacrosse Ball Forearm Roll',
        { requires: ['massage-ball-lacrosse'], tool: 'Use the lacrosse ball',
          alt: { name: 'Doorway wrist stretch', rx: '30 s each side', cue: 'Palm on the door frame, fingers back, gently turn away.', demo: 'Doorway Wrist Stretch' } }),
      item('fb-glute', 'Lacrosse ball on the glute', '45 s each side', ['hip'], ['glutes', 'piriformis'],
        'Sit on the ball under the fleshy part of the buttock, hands behind you. Keep it off the tailbone, hip bone and back of the thigh.', 'Lacrosse Ball Glute Release',
        { requires: ['massage-ball-lacrosse'], tool: 'Use the lacrosse ball',
          alt: { name: 'Figure-4 stretch, standing', rx: '30 s each side', cue: 'Ankle over the opposite knee, sit back as if into a chair, hand on a wall for balance.', demo: 'Standing Figure-4 Stretch' } }),
      item('fb-ham', 'Lacrosse ball hamstring roll', '45 s each leg', ['hip', 'knee'], ['hamstrings'],
        'Ball under the back of the thigh, small slow rolls. Keep it off the sit bone and the back of the knee.', 'Lacrosse Ball Hamstring Roll',
        { requires: ['massage-ball-lacrosse'], tool: 'Use the lacrosse ball',
          alt: { name: 'Supine hamstring stretch', rx: '40 s each side', cue: 'On your back, loop a towel or band around the foot and lift the leg.', demo: 'Supine Hamstring Stretch' } }),
      item('fb-quad', 'Lacrosse ball quad roll', '45 s each leg', ['hip', 'knee'], ['quads'],
        'Face down on the forearms, ball under the front of the thigh. Keep it off the kneecap and the hip bone.', 'Lacrosse Ball Quad Roll',
        { requires: ['massage-ball-lacrosse'], tool: 'Use the lacrosse ball',
          alt: { name: 'Prone quad stretch', rx: '30 s each side', cue: 'Face down, heel toward the buttock with a hand, band or towel.', demo: 'Prone Quad Stretch' } }),
      item('fb-calf', 'Lacrosse ball calf roll', '45 s each leg', ['ankle', 'knee'], ['calves'],
        'Calf on the ball, hips lifted, slow rolls. Keep it off the back of the knee and the Achilles.', 'Lacrosse Ball Calf Roll',
        { requires: ['massage-ball-lacrosse'], tool: 'Use the lacrosse ball',
          alt: { name: 'Calf wall stretch', rx: '30 s each side', cue: 'Hands on the wall, back leg straight, heel down.', demo: 'Standing Calf Stretch (Wall)' } }),
      item('fb-foot', 'Spiky ball foot roll', '45 s each foot', ['ankle'], ['calves'], 'Light pressure, slow rolling front to back, a hand on a wall for balance.', 'Spiky Ball Foot Roll',
        { requires: ['massage-ball-spiky'], tool: 'Use the spiky ball',
          alt: { name: 'Ankle alphabet', rx: 'one pass each foot', cue: 'Trace the letters A to Z with the big toe, moving from the ankle.', demo: 'Ankle Alphabet' } }),
    ],
  },
  {
    id: 'hips-20', name: 'Hip Mobility', minutes: 20, kind: 'flow',
    blurb: 'About 20 minutes of active hip work, then longer holds. Good after training or on a day off.',
    items: [
      item('hm-cars', 'Quadruped Hip CARs', '4 slow circles each side', ['hip'], ['hip_flexors', 'glutes', 'adductors'], 'Biggest comfortable circle, with the spine and pelvis still.', 'Quadruped Hip CARs'),
      item('hm-airplane', 'Hip Airplane', '5 each side', ['hip', 'knee'], ['glutes', 'hamstrings'], 'Hand on a wall, hinge forward and rotate open and closed over a steady standing foot.', 'Hip Airplane'),
      item('hm-hydrant', 'Fire Hydrant', '10 each side', ['hip'], ['glutes'], 'Lift the knee out to the side with the pelvis still.', 'Fire Hydrant'),
      item('hm-clam', 'Clamshell', '12 each side', ['hip'], ['glutes', 'piriformis'], 'Feet together, lift the top knee without rolling back.', 'Clamshell'),
      item('hm-9090', '90/90 Hip Switch', '8 switches', ['hip'], ['piriformis', 'glutes', 'adductors'], 'Sit tall and rotate both knees across, using the hands only if needed.', '90/90 Hip Switch'),
      item('hm-liftoff', '90/90 Hip Lift-Off', '5 each side', ['hip'], ['glutes', 'piriformis'], 'Back knee stays down, lift the shin and foot for a few seconds.', '90/90 Hip Lift-Off'),
      item('hm-banded', 'Banded Hip Mobilization', '60 s each side', ['hip'], ['hip_flexors', 'quads'], 'Band in the crease of the hip, glute squeezed, small rocks forward and back.', 'Banded Hip Mobilization',
        { requires: ['resistance-bands'], tool: 'Use a band on a low anchor',
          alt: { name: 'Half-Kneeling Hip Flexor Stretch', rx: '45 s each side', cue: 'Back knee down, squeeze the back-leg glute, ribs down, lean forward until the front of the hip stretches.', demo: 'Half-Kneeling Hip Flexor Stretch' } }),
      item('hm-sidebend', 'Half-Kneeling Side Bend', '30 s each side', ['hip', 'lumbar_spine'], ['hip_flexors', 'obliques'], 'Squeeze the glute of the kneeling leg and lean away from it.', 'Half-Kneeling Side Bend'),
      item('hm-lowlunge', 'Low Lunge with Twist', '30 s each side', ['hip', 'thoracic_spine'], ['hip_flexors', 'obliques'], 'Rotate toward the front leg and reach the other arm up and back.', 'Low Lunge with Twist'),
      item('hm-lizard', 'Lizard Stretch', '45 s each side', ['hip'], ['hip_flexors', 'adductors'], 'Both hands inside the front foot, sink the hips low and breathe.', 'Lizard Stretch'),
      item('hm-pigeon', 'Pigeon Stretch', '60 s each side', ['hip', 'knee'], ['glutes', 'piriformis'], 'Fold over the front shin only as far as is comfortable. Skip it if the front knee complains.', 'Pigeon Stretch'),
      item('hm-rockback', 'Adductor Rock-Back', '8 each side', ['hip'], ['adductors'], 'One leg out to the side, flat back, rock the hips toward the heel.', 'Adductor Rock-Back'),
      item('hm-happy', 'Happy Baby', '45 s', ['hip', 'lumbar_spine'], ['adductors', 'hamstrings'], 'Hold the feet or shins, knees wide, tailbone down.', 'Happy Baby'),
      item('hm-wipers', 'Windshield Wipers (Lying)', '10 slow', ['hip', 'lumbar_spine'], ['glutes', 'obliques'], 'Let both knees fall to one side, then the other, shoulders down.', 'Windshield Wipers (Lying)'),
      item('hm-squat', 'Deep Squat Hold', '60 s', ['hip', 'knee', 'ankle'], ['adductors', 'glutes', 'calves'], 'Heels down, elbows pressing the knees out, chest tall.', 'Deep Squat Hold'),
    ],
  },
  {
    id: 'kick-range', name: 'Kicking Range', minutes: 12, kind: 'warmup',
    blurb: 'Dynamic work for roundhouse and teep range. Start with small swings and let the range build.',
    items: [
      item('kr-swing-fb', 'Front-to-Back Leg Swing', '10 each leg', ['hip'], ['hamstrings', 'hip_flexors'], 'Hold a wall, small swings first, torso upright.', 'Front-to-Back Leg Swing'),
      item('kr-swing-lat', 'Lateral Leg Swing', '10 each leg', ['hip'], ['adductors', 'glutes'], 'Face the wall, swing across and out with the torso still.', 'Lateral Leg Swing'),
      item('kr-hipcircle', 'Hip Circle (Standing)', '8 each direction, each leg', ['hip'], ['hip_flexors', 'glutes'], 'Knee up, then open it out and round in a smooth circle.', 'Hip Circle (Standing)'),
      item('kr-hurdle', 'Hurdle Step-Over', '8 each side', ['hip'], ['glutes', 'hip_flexors'], 'Lift the knee up and out, swing around and set the foot down.', 'Hurdle Step-Over'),
      item('kr-kneehug', 'Walking Knee Hug', '8 each side', ['hip'], ['glutes', 'hamstrings'], 'Stand tall on the standing leg, hug the knee, step through.', 'Walking Knee Hug'),
      item('kr-quadpull', 'Walking Quad Pull', '8 each side', ['hip', 'knee'], ['quads', 'hip_flexors'], 'Heel toward the buttock, knees together, stay tall.', 'Walking Quad Pull'),
      item('kr-cossack', 'Cossack Squat', '6 each side', ['hip', 'knee', 'ankle'], ['adductors', 'glutes', 'quads'], 'Sit into one hip with the other leg straight and toes up.', 'Cossack Squat'),
      item('kr-ankle', 'Ankle Dorsiflexion Wall Drill', '8 each side', ['ankle', 'knee'], ['calves'], 'Knee over the toes, heel stays down.', 'Ankle Dorsiflexion Wall Drill'),
      item('kr-wgs', "World's Greatest Stretch", '3 each side', ['hip', 'thoracic_spine'], ['hip_flexors', 'hamstrings', 'glutes'], 'Long lunge, elbow toward the instep, then open the chest.', "World's Greatest Stretch"),
      item('kr-tspine', 'Quadruped Thoracic Rotation', '6 each side', ['thoracic_spine'], ['obliques', 'traps'], 'Hand behind the head, hips still, turn the elbow up.', 'Quadruped Thoracic Rotation'),
      item('kr-chamber', 'Kick Chamber Hold', '5 each side', ['hip', 'knee'], ['hip_flexors', 'glutes', 'abs'], 'Knee up, turn it over, hold a few seconds, lower slowly.', 'Kick Chamber Hold'),
      item('kr-crab', 'Crab Reach', '6 each side', ['hip', 'thoracic_spine'], ['glutes', 'hip_flexors'], 'Hips high, reach the arm up and over, chest toward the ceiling.', 'Crab Reach'),
    ],
  },
  {
    id: 'guard-hips', name: 'Guard Hips', minutes: 12, kind: 'warmup',
    blurb: 'Rotation and hip-escape prep for guard retention. Easy on the floor, before drilling.',
    items: [
      item('gh-9090', '90/90 Hip Switch', '8 switches', ['hip'], ['piriformis', 'glutes', 'adductors'], 'Sit tall and rotate both knees across.', '90/90 Hip Switch'),
      item('gh-liftoff', '90/90 Hip Lift-Off', '5 each side', ['hip'], ['glutes', 'piriformis'], 'Back knee stays down, lift the shin and foot for a few seconds.', '90/90 Hip Lift-Off'),
      item('gh-wipers', 'Windshield Wipers (Lying)', '10 slow', ['hip', 'lumbar_spine'], ['glutes', 'obliques'], 'Knees fall side to side, shoulders stay down.', 'Windshield Wipers (Lying)'),
      item('gh-hirot', 'Supine Hip Internal Rotation', '30 s each side', ['hip'], ['adductors', 'glutes'], 'Let one knee fall in toward the other, relax into it.', 'Supine Hip Internal Rotation'),
      item('gh-happy', 'Happy Baby', '45 s', ['hip', 'lumbar_spine'], ['adductors', 'hamstrings'], 'Knees wide, hold the feet or shins, tailbone down.', 'Happy Baby'),
      item('gh-frog', 'Frog Stretch', '45 s', ['hip'], ['adductors'], 'Pad the knees, rock back gently, stop if the knees hurt.', 'Frog Stretch'),
      item('gh-rockback', 'Adductor Rock-Back', '8 each side', ['hip'], ['adductors', 'hamstrings'], 'One leg out to the side, flat back, rock back toward the heel.', 'Adductor Rock-Back'),
      item('gh-clam', 'Clamshell', '12 each side', ['hip'], ['glutes', 'piriformis'], 'Feet together, lift the top knee, pelvis stays still.', 'Clamshell'),
      item('gh-bridge', 'Glute Bridge', '10', ['hip', 'lumbar_spine'], ['glutes', 'hamstrings'], 'Press through the heels, squeeze at the top, lower slowly.', 'Glute Bridge'),
      item('gh-tabletop', 'Reverse Tabletop', '5', ['thoracic_spine', 'hip'], ['glutes', 'traps'], 'Hips high, squeeze the glutes, open the chest.', 'Reverse Tabletop'),
      item('gh-shrimp', 'Hip Escape (Shrimp)', '6 each side', ['hip', 'lumbar_spine'], ['glutes', 'obliques', 'hip_flexors'], 'Slow and light: plant the foot, lift the hips and slide them away.', 'Hip Escape (Shrimp)'),
      item('gh-cars', 'Quadruped Hip CARs', '3 slow circles each side', ['hip'], ['hip_flexors', 'glutes', 'adductors'], 'Biggest comfortable circle, rest of the body still.', 'Quadruped Hip CARs'),
    ],
  },
  {
    id: 'lymph-head-neck', name: 'Gentle head and neck self-massage', minutes: 9, kind: 'selfcare',
    blurb: 'General information, not medical treatment: very light skin strokes, slow breathing and easy movement, sometimes called lymphatic massage. Once a day is fine.',
    safety: 'General information only, not medical treatment. It does not treat, cure or prevent anything. Ask your doctor first if you have swelling, an infection, recent surgery, a history of cancer, or a heart or kidney condition. Stop if it hurts, and do not massage skin that is infected, hot, red or newly swollen. See a doctor for swollen glands that keep getting bigger or have not gone down within a week, feel hard or do not move when pressed, come with night sweats or a very high temperature, or sit just above or below the collarbone, and for any trouble swallowing or breathing.',
    notes: 'Pressure is very light: just enough to move the skin, never to press into muscle. Go slowly, with no pain and no redness, and do both sides alike. Sources read: NHS, Lymphoedema treatment (nhs.uk/conditions/lymphoedema/treatment), which says a therapist can teach simple massage techniques; NHS, Swollen glands (nhs.uk/conditions/swollen-glands), for the see-a-GP signs above; MedlinePlus, Lymphatic diseases (medlineplus.gov/lymphaticdiseases.html), for what the lymphatic system is. None of these says self-massage achieves any particular effect, and neither does this routine; a therapist or doctor can advise on technique.',
    items: [
      item('lh-breath-start', 'Diaphragmatic breathing', '5 slow breaths', ['thoracic_spine'], ['abs'], 'In through the nose so the belly rises, out slower. Jaw and shoulders loose.', 'Lymph Drainage: Diaphragmatic Breathing'),
      item('lh-collar', 'Collarbone-area strokes', '5-10 slow strokes each side', ['neck'], ['traps'], 'Fingertips just above the collarbone, light skin movement only, slow and easy.', 'Lymph Drainage: Collarbone Strokes'),
      item('lh-side-neck', 'Side-of-neck strokes', '5-10 slow strokes each side', ['neck'], ['traps'], 'Flat fingers on the side of the neck, slow and very light.', 'Lymph Drainage: Side-of-Neck Strokes'),
      item('lh-ear-jaw', 'Around the ears and along the jaw', '5-10 slow strokes each side', ['neck'], ['traps'], 'Light skin movement only, slow and easy.', 'Lymph Drainage: Ear and Jawline Strokes'),
      item('lh-shoulders', 'Slow shoulder rolls', '5 each way', ['shoulder', 'neck'], ['traps'], 'Up, back and down in a smooth circle. Easy breathing.', 'Lymph Drainage: Shoulder Rolls'),
      item('lh-neck-move', 'Gentle neck tilts and turns', '5 each way', ['neck'], ['neck', 'traps'], 'Mild stretch only. Stop for dizziness, sharp pain or tingling in the arms.', 'Lymph Drainage: Gentle Neck Tilts and Turns'),
      item('lh-breath-end', 'Diaphragmatic breathing to finish', '5 slow breaths', ['thoracic_spine'], ['abs'], 'Same as the start. A short easy walk is a pleasant way to finish.', 'Lymph Drainage: Diaphragmatic Breathing'),
    ],
  },
];

const byId = new Map(ROUTINES.map(r => [r.id, r]));
const DAILY_ID = 'daily-10';

// ── Gear: fit routines to the active gym ─────────────────────────────────────

const GEAR_KEYS = ['requires', 'alt'];
const plain = it => { const o = { ...it }; for (const k of GEAR_KEYS) delete o[k]; return o; };

/**
 * Routines as one gym sees them. `have` = Set of equipment ids the gym effectively holds
 * (already expanded through `provides`), or null when it is unknown, in which case nothing
 * is swapped or hidden and no tool is claimed. Pure; never touches ROUTINES.
 */
function fitRoutines(routines, have) {
  return routines.map(r => {
    const taken = new Set(r.items.map(i => i.name.toLowerCase()));
    const items = [], omitted = [];
    for (const it of r.items) {
      if (!have || !it.requires) { const o = plain(it); if (!have) delete o.tool; items.push(o); continue; }
      const missing = E.unmet(it.requires, have);
      if (!missing.length) { items.push(plain(it)); continue; }
      const why = missing.map(m => m.split('|').map(a => (E.ITEMS.find(x => x.id === a) || {}).name || a).join(' or ')).join(', ');
      const alt = it.alt;
      if (alt && !taken.has(alt.name.toLowerCase())) {
        taken.add(alt.name.toLowerCase());
        const o = plain(it);
        delete o.tool;
        items.push({ ...o, name: alt.name, rx: alt.rx || it.rx, cue: alt.cue || it.cue, demo: alt.demo || alt.name,
          swappedFrom: it.name, swapNote: `Swapped in for ${it.name}: no ${why} here.` });
      } else {
        omitted.push({ name: it.name, note: `${it.name} left out: no ${why} here.` });
      }
    }
    return { ...r, items, omitted };
  });
}

/** The active gym's gear: { have:Set, gym:{slug,name}, note } or null when it cannot be worked out. */
async function activeGear(db, requested) {
  try {
    const res = await require('./gyms-store').resolve(db, requested || 'home');
    if (!res.location) return null;
    const g = res.gyms.find(x => x.slug === res.location);
    return g ? { have: new Set(g.effective), gym: { slug: g.slug, name: g.name }, note: res.note || null } : null;
  } catch { return null; }
}

function itemsFor(kind, id, have = null) {
  const out = [];
  for (const r of fitRoutines(ROUTINES, have)) for (const it of r.items) {
    if ((kind === 'joint' ? it.joints : it.muscles).includes(id)) {
      out.push({ routineId: r.id, routine: r.name, ...it });
    }
  }
  return out;
}

/** Items are the single source; the page and Body Map get a plain copy. */
function publicRoutines(have = null) { return JSON.parse(JSON.stringify(fitRoutines(ROUTINES, have))); }

// ── Done log ─────────────────────────────────────────────────────────────────

const etDate = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const doneKey = (routine, date) => `routineDone:${routine}:${date}`;

async function isDone(db, routine, date) {
  return !!(await db.UserSetting.findByPk(doneKey(routine, date)));
}

async function setDone(db, routine, done, date = etDate()) {
  if (!byId.has(routine)) { const e = new Error('unknown routine'); e.status = 404; throw e; }
  if (done === false) await db.UserSetting.destroy({ where: { key: doneKey(routine, date) } });
  else await db.UserSetting.upsert({ key: doneKey(routine, date), value: new Date().toISOString() });
  return { routine, date, done: done !== false };
}

async function doneToday(db, date = etDate()) {
  const rows = await db.UserSetting.findAll({ where: { key: ROUTINES.map(r => doneKey(r.id, date)) } });
  const have = new Set(rows.map(r => r.key));
  return Object.fromEntries(ROUTINES.map(r => [r.id, have.has(doneKey(r.id, date))]));
}

function mount(app, { requireLogin, getDatabase }) {
  const handler = (fn) => async (req, res) => {
    try {
      const db = getDatabase(req.user.username);
      await db.sequelize.sync();
      res.json({ success: true, ...(await fn(db, req)) });
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error('mobility:', e.message);
      res.status(status).json({ success: false, error: status === 500 ? 'failed' : e.message });
    }
  };
  const atOf = req => (/^[a-z][a-z0-9_-]{0,23}$/.test(String(req.query.at || '')) ? String(req.query.at) : null);
  app.get('/mobility/api/routines', requireLogin, handler(async (db, req) => {
    const gear = await activeGear(db, atOf(req));
    return { note: NOTE, date: etDate(), gym: gear && gear.gym, gymNote: gear && gear.note, routines: publicRoutines(gear && gear.have), done: await doneToday(db) };
  }));
  app.get('/mobility/api/:kind(joint|muscle)/:id', requireLogin, handler(async (db, req) => {
    const { kind, id } = req.params;
    if (!(kind === 'joint' ? M.isJoint(id) : M.isMuscle(id))) { const e = new Error(`unknown ${kind}`); e.status = 404; throw e; }
    const gear = await activeGear(db, atOf(req));
    return { note: NOTE, gym: gear && gear.gym, items: itemsFor(kind, id, gear && gear.have) };
  }));
  app.post('/mobility/api/done', requireLogin, handler(async (db, req) => {
    const b = req.body || {};
    return setDone(db, String(b.routine || ''), b.done);
  }));
}

module.exports = mount;
Object.assign(module.exports, { ROUTINES, NOTE, DAILY_ID, fitRoutines, activeGear, itemsFor, publicRoutines, etDate, doneKey, isDone, setDone, doneToday });
