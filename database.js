const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const crypto = require('crypto');

// ── Seed data ────────────────────────────────────────────────────────────────

const SEED_EXERCISES = [
  // BARBELL — MAIN LIFTS
  { name: 'Barbell Back Squat',      category: 'strength',     equipment: 'barbell',        primaryMuscles: ['quads','glutes'],              secondaryMuscles: ['hamstrings','lower_back','core'],   instructions: 'Bar on upper traps. Brace core, sit hips back and down until thighs parallel. Drive through heels.', videoUrl: 'https://www.youtube.com/watch?v=ultWZbUMPL8', mediaUrl: null, defaultSets: 4, defaultReps: 5, defaultDuration: null },
  { name: 'Barbell Deadlift',         category: 'strength',     equipment: 'barbell',        primaryMuscles: ['hamstrings','lower_back','glutes'], secondaryMuscles: ['traps','lats','forearms','quads'], instructions: 'Bar over mid-foot. Flatten back, brace hard. Push floor away, lock hips at top.',                 videoUrl: 'https://www.youtube.com/watch?v=op9kVnSso6Q', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Barbell Front Squat',      category: 'strength',     equipment: 'barbell',        primaryMuscles: ['quads'],                       secondaryMuscles: ['glutes','upper_back','core'],       instructions: 'Bar on front delts, elbows high. Squat straight down keeping torso upright.',                     videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 6, defaultDuration: null },
  { name: 'Barbell Bench Press',      category: 'strength',     equipment: 'barbell',        primaryMuscles: ['chest'],                       secondaryMuscles: ['front_delts','triceps'],            instructions: 'Lie flat, grip slightly wider than shoulders. Lower to lower chest, press up.',                    videoUrl: 'https://www.youtube.com/watch?v=rT7DgCr-3pg', mediaUrl: null, defaultSets: 4, defaultReps: 5, defaultDuration: null },
  { name: 'Barbell Overhead Press',   category: 'strength',     equipment: 'barbell',        primaryMuscles: ['front_delts','side_delts'],     secondaryMuscles: ['triceps','traps','upper_chest'],    instructions: 'Bar at shoulder height. Press straight overhead. Lean slightly under bar at lockout.',             videoUrl: 'https://www.youtube.com/watch?v=2yjwXTZQDDI', mediaUrl: null, defaultSets: 4, defaultReps: 5, defaultDuration: null },
  { name: 'Barbell Bent-Over Row',    category: 'strength',     equipment: 'barbell',        primaryMuscles: ['lats','rhomboids'],             secondaryMuscles: ['biceps','rear_delts','lower_back'], instructions: 'Hinge to ~45°. Row bar to lower chest, lead with elbows, keep back flat.',                        videoUrl: 'https://www.youtube.com/watch?v=vT2GjY_Umpw', mediaUrl: null, defaultSets: 4, defaultReps: 6, defaultDuration: null },
  { name: 'Romanian Deadlift (RDL)',  category: 'strength',     equipment: 'barbell',        primaryMuscles: ['hamstrings','glutes'],          secondaryMuscles: ['lower_back'],                       instructions: 'Hold bar at hips, soft knee. Hinge back until hamstring stretch, return.',                        videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 8, defaultDuration: null },
  { name: 'Barbell Hip Thrust',       category: 'strength',     equipment: 'barbell',        primaryMuscles: ['glutes'],                      secondaryMuscles: ['hamstrings','quads'],               instructions: 'Shoulders on bench, bar across hips. Drive hips to full extension, squeeze glutes.',               videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 8, defaultDuration: null },
  { name: 'Barbell Good Morning',     category: 'strength',     equipment: 'barbell',        primaryMuscles: ['lower_back','hamstrings'],      secondaryMuscles: ['glutes'],                          instructions: 'Bar on upper back, hinge at hips with soft knees until torso near parallel.',                    videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Barbell Pendulum Squat',   category: 'strength',     equipment: 'barbell',        primaryMuscles: ['quads','glutes'],              secondaryMuscles: ['hamstrings','core'],                instructions: 'Load barbell against rack. Step through and squat. Great alternative to back squat.',              videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Barbell Hack Squat',       category: 'strength',     equipment: 'barbell',        primaryMuscles: ['quads'],                       secondaryMuscles: ['glutes','hamstrings'],              instructions: 'Bar held behind back at legs. Machine-like squat. Quad-dominant.',                               videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },

  // DUMBBELL — PRESSING
  { name: 'Dumbbell Bench Press',            category: 'strength', equipment: 'dumbbell', primaryMuscles: ['chest'],                  secondaryMuscles: ['front_delts','triceps'],       instructions: 'Lie flat, dumbbells at chest. Press up and slightly in, control descent.',              videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 8, defaultDuration: null },
  { name: 'Incline Dumbbell Press',          category: 'strength', equipment: 'dumbbell', primaryMuscles: ['upper_chest','front_delts'], secondaryMuscles: ['triceps'],                  instructions: 'Bench at 30–45°. Press dumbbells from chest up and slightly together. Full stretch at bottom.',                videoUrl: 'https://www.youtube.com/watch?v=8iPEnn-ltC8', mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Decline Dumbbell Press',          category: 'strength', equipment: 'dumbbell', primaryMuscles: ['lower_chest'],             secondaryMuscles: ['triceps','front_delts'],    instructions: 'Decline bench. Press from lower chest position.',                                      videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Dumbbell Shoulder Press',         category: 'strength', equipment: 'dumbbell', primaryMuscles: ['front_delts','side_delts'], secondaryMuscles: ['triceps'],                  instructions: 'Seated, dumbbells at shoulder height. Press to lockout, lower with control.',          videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 8, defaultDuration: null },
  { name: 'Dumbbell Arnold Press',           category: 'strength', equipment: 'dumbbell', primaryMuscles: ['front_delts','side_delts','rear_delts'], secondaryMuscles: ['triceps'], instructions: 'Rotate palms forward while pressing overhead. Full shoulder involvement.',                 videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  // DUMBBELL — ROWING
  { name: 'Dumbbell Row',                    category: 'strength', equipment: 'dumbbell', primaryMuscles: ['lats','rhomboids'],       secondaryMuscles: ['biceps','rear_delts'],         instructions: 'Support on bench, row dumbbell to hip, elbow close to body, full stretch at bottom.',  videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 8, defaultDuration: null },
  { name: 'Dumbbell Single-Arm Row',         category: 'strength', equipment: 'dumbbell', primaryMuscles: ['lats'],                   secondaryMuscles: ['biceps','rhomboids'],         instructions: 'Tall plank, row DB to ribcage. Explosive drive, control lower.',                      videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 8, defaultDuration: null },
  { name: 'Dumbbell Pullovers',              category: 'strength', equipment: 'dumbbell', primaryMuscles: ['chest','lats'],           secondaryMuscles: ['serratus'],                    instructions: 'Flat bench, DB over chest. Lower behind head, arc motion. Full range.',                videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  // DUMBBELL — LATERALS & REAR DELTS
  { name: 'Dumbbell Lateral Raise',          category: 'strength', equipment: 'dumbbell', primaryMuscles: ['side_delts'],             secondaryMuscles: ['traps'],                      instructions: 'Slight forward lean, raise to shoulder height with soft elbow, thumbs slightly down.',  videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Dumbbell Rear Delt Fly',          category: 'strength', equipment: 'dumbbell', primaryMuscles: ['rear_delts'],             secondaryMuscles: ['rhomboids','traps'],           instructions: 'Hinge ~90°, raise dumbbells out to sides leading with elbows.',                       videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Dumbbell Front Raise',            category: 'strength', equipment: 'dumbbell', primaryMuscles: ['front_delts'],            secondaryMuscles: ['upper_chest'],                instructions: 'Neutral grip, raise to eye level, control descent.',                                  videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  // DUMBBELL — ARMS
  { name: 'Dumbbell Bicep Curl',             category: 'strength', equipment: 'dumbbell', primaryMuscles: ['biceps'],                 secondaryMuscles: ['brachialis'],                 instructions: 'Supinated grip, curl toward shoulders without swinging, lower fully.',                 videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Dumbbell Hammer Curl',            category: 'strength', equipment: 'dumbbell', primaryMuscles: ['brachialis','biceps'],    secondaryMuscles: ['forearms'],                   instructions: 'Neutral (thumbs up) grip, curl to shoulder, keep elbows pinned.',                     videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Dumbbell Concentration Curl',     category: 'strength', equipment: 'dumbbell', primaryMuscles: ['biceps'],                 secondaryMuscles: [],                             instructions: 'Seated, elbow on inner knee. Curl with strict form, squeeze peak.',                     videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Dumbbell Tricep Kickback',        category: 'strength', equipment: 'dumbbell', primaryMuscles: ['triceps'],                secondaryMuscles: [],                             instructions: 'Hinge forward, upper arm parallel to floor, extend forearm back to lockout.',          videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Dumbbell Tricep Overhead Press',  category: 'strength', equipment: 'dumbbell', primaryMuscles: ['triceps'],                secondaryMuscles: ['chest'],                      instructions: 'Hold one DB overhead, lower behind head. Keep core stable.',                            videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  // DUMBBELL — LOWER BODY & CORE
  { name: 'Dumbbell Romanian Deadlift',      category: 'strength', equipment: 'dumbbell', primaryMuscles: ['hamstrings','glutes'],    secondaryMuscles: ['lower_back'],                 instructions: 'Dumbbells in front of thighs, hinge hips back, lower along shins, return.',           videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 8, defaultDuration: null },
  { name: 'Dumbbell Bulgarian Split Squat',  category: 'strength', equipment: 'dumbbell', primaryMuscles: ['quads','glutes'],         secondaryMuscles: ['hamstrings','calves'],         instructions: 'Rear foot elevated on bench. Squat on front leg until rear knee nearly touches floor.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Dumbbell Lunge',                  category: 'strength', equipment: 'dumbbell', primaryMuscles: ['quads','glutes'],         secondaryMuscles: ['hamstrings','calves'],         instructions: 'Step forward, lower rear knee toward floor, push back to start.',                      videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Dumbbell Walking Lunge',          category: 'strength', equipment: 'dumbbell', primaryMuscles: ['quads','glutes'],         secondaryMuscles: ['hamstrings','core'],           instructions: 'Walk forward, lunging with each step. Full range motion.',                             videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 20, defaultDuration: null },
  { name: 'Goblet Squat',                    category: 'strength', equipment: 'dumbbell', primaryMuscles: ['quads','glutes'],         secondaryMuscles: ['core','adductors'],            instructions: 'Hold dumbbell at chest. Squat deep with elbows inside knees, drive through heels.',   videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: "Farmer's Carry",                  category: 'strength', equipment: 'dumbbell', primaryMuscles: ['traps','forearms'],       secondaryMuscles: ['core','quads'],               instructions: 'Hold heavy dumbbells at sides, walk with tall posture and tight core.',                videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 40, defaultDuration: null },
  { name: 'Dumbbell Shrug',                  category: 'strength', equipment: 'dumbbell', primaryMuscles: ['traps'],                  secondaryMuscles: ['forearms'],                   instructions: 'Elevate shoulders straight up, hold 1 second, lower fully.',                          videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Dumbbell Suitcase Carry',         category: 'strength', equipment: 'dumbbell', primaryMuscles: ['obliques','core'],        secondaryMuscles: ['lats','traps'],               instructions: 'Hold single dumbbell at side, walk upright. Anti-lateral flexion.',                     videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 40, defaultDuration: null },
  // CABLE MACHINE
  { name: 'Lat Pulldown',          category: 'strength', equipment: 'cable_machine', primaryMuscles: ['lats'],          secondaryMuscles: ['biceps','rhomboids','rear_delts'], instructions: 'Wide grip, lean slightly back. Pull bar to upper chest, squeeze lats, slow return.',       videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Seated Cable Row',      category: 'strength', equipment: 'cable_machine', primaryMuscles: ['rhomboids','lats'], secondaryMuscles: ['biceps','rear_delts'],           instructions: 'Feet on platform. Pull handle to navel, squeeze shoulder blades, slow return.',           videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Cable Chest Fly',       category: 'strength', equipment: 'cable_machine', primaryMuscles: ['chest'],         secondaryMuscles: ['front_delts'],                   instructions: 'Cables high. Bring handles together in front of chest with slight elbow bend.',             videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Cable Tricep Pushdown', category: 'strength', equipment: 'cable_machine', primaryMuscles: ['triceps'],       secondaryMuscles: [],                               instructions: 'High pulley, elbows pinned to sides. Push down to lockout, slow return.',                  videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Cable Bicep Curl',      category: 'strength', equipment: 'cable_machine', primaryMuscles: ['biceps'],        secondaryMuscles: ['brachialis'],                   instructions: 'Low pulley, underhand grip. Curl to shoulders, elbows pinned.',                            videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Cable Face Pull',       category: 'strength', equipment: 'cable_machine', primaryMuscles: ['rear_delts'],    secondaryMuscles: ['rhomboids','traps'],             instructions: 'High pulley with rope. Pull to face, hands finishing at ear level, elbows high.',           videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Cable Lateral Raise',   category: 'strength', equipment: 'cable_machine', primaryMuscles: ['side_delts'],    secondaryMuscles: [],                               instructions: 'Low side pulley. Raise arm to shoulder height with soft elbow, control the return.',        videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Cable Crunch',          category: 'strength', equipment: 'cable_machine', primaryMuscles: ['abs'],           secondaryMuscles: ['obliques'],                     instructions: 'Kneel facing high pulley, rope behind neck. Crunch elbows toward knees.',                  videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Wood Chop',             category: 'strength', equipment: 'cable_machine', primaryMuscles: ['obliques','abs'], secondaryMuscles: ['shoulders','lats'],             instructions: 'High pulley to one side. Pull diagonally across body in chopping motion.',                  videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  // MACHINE
  { name: 'Leg Press',             category: 'strength', equipment: 'machine', primaryMuscles: ['quads','glutes'],    secondaryMuscles: ['hamstrings'],   instructions: 'Feet shoulder-width. Lower until 90°, press through heels, do not lock out.',      videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Leg Extension',         category: 'strength', equipment: 'machine', primaryMuscles: ['quads'],             secondaryMuscles: [],               instructions: 'Pad above ankles. Extend to near lockout, lower with control.',                    videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Leg Curl',              category: 'strength', equipment: 'machine', primaryMuscles: ['hamstrings'],        secondaryMuscles: ['calves'],       instructions: 'Pad behind lower leg. Curl heels to glutes, squeeze, lower with control.',          videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Chest Press Machine',   category: 'strength', equipment: 'machine', primaryMuscles: ['chest'],             secondaryMuscles: ['front_delts','triceps'], instructions: 'Handles at chest height. Press forward to near lockout, control return.',         videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  // BODYWEIGHT
  { name: 'Pull-up',           category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['lats'],          secondaryMuscles: ['biceps','rhomboids','rear_delts'], instructions: 'Overhand grip, hang fully. Pull chest toward bar, lower fully.',              videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 6, defaultDuration: null },
  { name: 'Chin-up',           category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['biceps','lats'], secondaryMuscles: ['rhomboids'],                      instructions: 'Underhand grip. Pull chin over bar, lower fully.',                           videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Push-up',           category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['chest'],         secondaryMuscles: ['triceps','front_delts','core'],   instructions: 'Hands slightly wider than shoulders. Lower chest to floor, press up.',        videoUrl: 'https://www.youtube.com/watch?v=IODxDxX7oi4', mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Diamond Push-up',   category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['triceps'],       secondaryMuscles: ['chest','front_delts'],            instructions: 'Hands close forming diamond shape under chest. Lower and press.',            videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Dip',               category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['triceps','chest'], secondaryMuscles: ['front_delts'],                 instructions: 'Support on parallel bars. Lower until shoulders at bar level, press up.',     videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Plank',             category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['abs','core'],    secondaryMuscles: ['glutes','shoulders'],             instructions: 'Forearms on floor, body straight from head to heels. Breathe normally.',     videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 60 },
  { name: 'Side Plank',        category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['obliques'],      secondaryMuscles: ['abs','glutes'],                  instructions: 'One forearm on floor, stack feet. Hips up, body straight. Hold.',            videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 45 },
  { name: 'Hanging Leg Raise', category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['abs','hip_flexors'], secondaryMuscles: ['obliques'],                 instructions: 'Hang from bar. Raise legs to 90°, lower with control.',                     videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Inverted Row',      category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['rhomboids','lats'], secondaryMuscles: ['biceps','rear_delts'],         instructions: 'Under bar at waist height, body straight. Pull chest to bar.',              videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Burpee',            category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['full_body'],     secondaryMuscles: [],                                instructions: 'Squat down, kick feet back, push-up, jump feet in, jump up overhead.',      videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Jump Squat',        category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['quads','glutes'], secondaryMuscles: ['calves'],                       instructions: 'Squat to parallel, explode up, land softly with bent knees.',               videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Mountain Climber',  category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['core','hip_flexors'], secondaryMuscles: ['chest','shoulders'],        instructions: 'Push-up position. Drive knees toward chest alternately.',                   videoUrl: 'https://www.youtube.com/watch?v=nmwgirgXLYM', mediaUrl: null, defaultSets: 3, defaultReps: 20, defaultDuration: null },
  { name: 'Box Jump',          category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['quads','glutes'], secondaryMuscles: ['hamstrings','calves'],           instructions: 'Swing arms, jump onto box landing with soft knees. Step back down.',        videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  // MMA / COMBAT
  { name: 'Heavy Bag — Boxing Combos',  category: 'mma',         equipment: 'bag',      primaryMuscles: ['shoulders','chest','core'],  secondaryMuscles: ['triceps','legs'],        instructions: 'Work 1-2, 1-2-3-2, body combos. Rotate hips. 3-min rounds.',               videoUrl: null, mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 180 },
  { name: 'Heavy Bag — Kick Work',      category: 'mma',         equipment: 'bag',      primaryMuscles: ['quads','glutes','hip_flexors'], secondaryMuscles: ['calves','core'],    instructions: 'Low kicks, body kicks, head kicks. Step in, pivot hip over for power.',      videoUrl: null, mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 180 },
  { name: 'Heavy Bag — Knees & Elbows', category: 'mma',         equipment: 'bag',      primaryMuscles: ['core','hip_flexors'],        secondaryMuscles: ['shoulders'],            instructions: 'Clinch position. Drive knees into bag. Step in for elbows at angle.',       videoUrl: null, mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 180 },
  { name: 'Heavy Bag — MMA Combos',     category: 'mma',         equipment: 'bag',      primaryMuscles: ['full_body'],                 secondaryMuscles: [],                       instructions: 'Mix punches, kicks, knees, elbows. Level changes. Simulate fight pace.',    videoUrl: null, mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 300 },
  { name: 'Speed Bag',                   category: 'mma',         equipment: 'bag',      primaryMuscles: ['shoulders','forearms'],      secondaryMuscles: ['triceps'],              instructions: 'Eye level, elbows up. Alternating fists in rhythm. Start slow, build speed.', videoUrl: null, mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 180 },
  { name: 'Shadow Boxing',              category: 'mma',         equipment: 'none',     primaryMuscles: ['shoulders','core'],          secondaryMuscles: ['legs'],                 instructions: 'Visualize opponent. Work footwork, angles, level changes. 3-min rounds.',   videoUrl: null, mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 180 },
  { name: 'Shadow Boxing — Muay Thai',  category: 'muay_thai',   equipment: 'none',     primaryMuscles: ['full_body'],                 secondaryMuscles: [],                       instructions: 'Incorporate teeps, roundhouse kicks, knees, elbows. Work stance and timing.', videoUrl: null, mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 180 },
  { name: 'Pad Work — Boxing',          category: 'mma',         equipment: 'pads',     primaryMuscles: ['full_body'],                 secondaryMuscles: [],                       instructions: 'Follow coach calls. Stay sharp, reset after each combo. Work defense.',      videoUrl: null, mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 300 },
  { name: 'Pad Work — Muay Thai',       category: 'muay_thai',   equipment: 'pads',     primaryMuscles: ['full_body'],                 secondaryMuscles: [],                       instructions: 'Full Muay Thai combos with holder. All eight weapons.',                     videoUrl: null, mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 300 },
  { name: 'Sparring',                   category: 'mma',         equipment: 'none',     primaryMuscles: ['full_body'],                 secondaryMuscles: [],                       instructions: 'Technical sparring. Apply techniques from training. Respect partners.',     videoUrl: null, mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 300 },
  { name: 'Clinch Work',                category: 'muay_thai',   equipment: 'none',     primaryMuscles: ['shoulders','traps','core'],  secondaryMuscles: ['neck','legs'],           instructions: 'Inside Muay Thai clinch: neck wrestling, drive knees, create angles.',      videoUrl: null, mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 120 },
  { name: 'Takedown Drilling',          category: 'mma',         equipment: 'none',     primaryMuscles: ['hips','quads','core'],       secondaryMuscles: ['lower_back'],           instructions: 'Shots, double/single legs, hip tosses. Drill with partner, high reps.',    videoUrl: null, mediaUrl: null, defaultSets: null, defaultReps: 20, defaultDuration: null },
  { name: 'Sprawl Drill',               category: 'mma',         equipment: 'none',     primaryMuscles: ['hip_flexors','core'],        secondaryMuscles: ['glutes','lower_back'],  instructions: 'Partner shoots, sprawl hips to mat, drive weight down, return to feet.',   videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Neck Bridge',                category: 'mma',         equipment: 'bodyweight', primaryMuscles: ['neck'],                    secondaryMuscles: ['traps','upper_back'],   instructions: 'On back, push onto crown of head. Rock gently. Progress to full bridge. Take weight through the feet and hands at first, keep the movement small, and stop if you feel sharp pain, dizziness, or tingling in the arms.',  videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 30 },
  // BJJ
  { name: 'BJJ Drilling',         category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','full_body'], secondaryMuscles: [],         instructions: 'Repetitive technique drilling with partner or solo.',                         videoUrl: null, mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 600 },
  { name: 'BJJ Live Rolling',     category: 'bjj', equipment: 'none', primaryMuscles: ['full_body'],               secondaryMuscles: [],         instructions: 'Full resistance grappling rounds. 5–8 min rounds with varying partners.',    videoUrl: null, mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 300 },
  { name: 'Hip Escape (Shrimp)',  category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips'],             secondaryMuscles: ['glutes'], instructions: 'On back, bridge and shrimp hips sideways to create space. Drill length of mat.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Guard Retention Drill',category: 'bjj', equipment: 'none', primaryMuscles: ['core','hip_flexors'],      secondaryMuscles: ['legs'],   instructions: 'Maintain guard while partner tries to pass. Train sensitivity and reaction.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 300 },
  // CARDIO / CONDITIONING
  { name: 'Assault Bike — Steady State', category: 'cardio',       equipment: 'cardio_machine', primaryMuscles: ['full_body'], secondaryMuscles: [], instructions: 'Maintain consistent RPM. Arms and legs together. Good for aerobic base.',    videoUrl: null, mediaUrl: null, defaultSets: 1, defaultReps: null, defaultDuration: 1800 },
  { name: 'Assault Bike — Intervals',    category: 'conditioning', equipment: 'cardio_machine', primaryMuscles: ['full_body'], secondaryMuscles: [], instructions: 'All-out sprint, then rest. E.g. 10s on / 50s off × 10, or Tabata 20/10.',  videoUrl: null, mediaUrl: null, defaultSets: 10, defaultReps: null, defaultDuration: null },
  { name: 'Treadmill Run',               category: 'cardio',       equipment: 'cardio_machine', primaryMuscles: ['quads','calves','hamstrings'], secondaryMuscles: ['glutes','core'], instructions: 'Steady pace. Land midfoot. Use for base building or tempo.',             videoUrl: null, mediaUrl: null, defaultSets: 1, defaultReps: null, defaultDuration: 1200 },
  { name: 'Treadmill Sprint Intervals',  category: 'conditioning', equipment: 'cardio_machine', primaryMuscles: ['quads','calves'], secondaryMuscles: ['glutes','hamstrings'], instructions: 'High speed 20–30s, step off or walk for recovery. Repeat.',              videoUrl: null, mediaUrl: null, defaultSets: 8, defaultReps: null, defaultDuration: null },
  { name: 'Rowing Machine — Steady',     category: 'cardio',       equipment: 'cardio_machine', primaryMuscles: ['full_body'], secondaryMuscles: [],          instructions: 'Drive legs, swing back, pull with arms. Maintain consistent pace.',                  videoUrl: null, mediaUrl: null, defaultSets: 1, defaultReps: null, defaultDuration: 1200 },
  { name: 'Rowing Machine — Intervals',  category: 'conditioning', equipment: 'cardio_machine', primaryMuscles: ['full_body'], secondaryMuscles: [],          instructions: '30s hard, 30s easy. Repeat for 15–20 min.',                                           videoUrl: null, mediaUrl: null, defaultSets: 10, defaultReps: null, defaultDuration: null },
  // BASKETBALL / COURT
  { name: 'Suicide Sprints',       category: 'conditioning', equipment: 'none', primaryMuscles: ['quads','calves'],  secondaryMuscles: ['core'],      instructions: 'Sprint to free throw line and back, half court and back, full court and back.', videoUrl: null, mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: null },
  { name: 'Basketball — Pickup Game', category: 'cardio',    equipment: 'none', primaryMuscles: ['full_body'],       secondaryMuscles: [],            instructions: 'Full game play. Great aerobic/anaerobic interval mix.',                        videoUrl: null, mediaUrl: null, defaultSets: 1, defaultReps: null, defaultDuration: 1800 },
  // RECOVERY / STRETCHING
  { name: 'World\'s Greatest Stretch', category: 'recovery', equipment: 'none', primaryMuscles: ['hips','hamstrings','thoracic_spine'], secondaryMuscles: ['glutes','core'], instructions: 'Lunge forward, elbow to instep, rotate chest open, then switch sides.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 6, defaultDuration: null },
  { name: 'Couch Stretch',              category: 'recovery', equipment: 'none', primaryMuscles: ['quads','hip_flexors'], secondaryMuscles: ['glutes'], instructions: 'Rear shin vertical against wall/bench. Tuck pelvis and squeeze glute to open hip flexor.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 90 },
  { name: '90/90 Hip Switch',           category: 'recovery', equipment: 'none', primaryMuscles: ['hips','glutes'], secondaryMuscles: ['core'], instructions: 'Sit in 90/90, rotate knees side to side without using hands if possible.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Pigeon Stretch',             category: 'recovery', equipment: 'none', primaryMuscles: ['glutes','hips'], secondaryMuscles: ['lower_back'], instructions: 'Front shin across body, extend rear leg, fold forward slowly and breathe. Ease off if you feel it in the front knee; a cushion under the hip helps.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Hamstring Floss',            category: 'recovery', equipment: 'none', primaryMuscles: ['hamstrings'], secondaryMuscles: ['calves'], instructions: 'From half-kneel, rock hips back while extending front knee and pulling toes up.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Thoracic Open Book',         category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine'], secondaryMuscles: ['shoulders'], instructions: 'Lie side-on with knees bent, open top arm across body and rotate upper back.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Bretzel Stretch',            category: 'recovery', equipment: 'none', primaryMuscles: ['quads','hip_flexors','thoracic_spine'], secondaryMuscles: ['glutes'], instructions: 'Side-lying mobility drill for quad/hip plus thoracic rotation.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Ankle Dorsiflexion Wall Drill', category: 'recovery', equipment: 'none', primaryMuscles: ['calves','ankles'], secondaryMuscles: [], instructions: 'Drive knee toward wall over toes while heel stays down; control both directions.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },

  // ── HIP MOBILITY ─────────────────────────────────────────────────────────────
  { name: 'Hip Circle (Standing)',        category: 'recovery', equipment: 'none', primaryMuscles: ['hips','glutes'],                  secondaryMuscles: ['core'],              instructions: 'Stand on one leg, draw large circles with raised knee. Forward and backward. 10 each direction each side.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Hip 90/90 Active Rotation',   category: 'recovery', equipment: 'none', primaryMuscles: ['hips','glutes','adductors'],       secondaryMuscles: ['lower_back'],        instructions: 'Sit in 90/90. Actively drive front knee up, hold 2 sec at end range, then lower. Work internal and external rotation.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Hip Flexor CARS',             category: 'recovery', equipment: 'none', primaryMuscles: ['hip_flexors','hips'],              secondaryMuscles: ['core'],              instructions: 'Controlled articular rotation of the hip. Draw the biggest circle possible with your knee. Slow and deliberate.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Deep Squat Hold',             category: 'recovery', equipment: 'none', primaryMuscles: ['hips','ankles','adductors'],       secondaryMuscles: ['lower_back','calves'], instructions: 'Feet shoulder width, toes out. Hold deep squat position with heels flat. Use hands to push knees out if needed. Hold onto a post or rack for support if you need it, and come up if the knees or hips pinch.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 60 },
  { name: 'Frog Stretch',                category: 'recovery', equipment: 'none', primaryMuscles: ['adductors','hips'],                secondaryMuscles: ['glutes'],            instructions: 'Hands and knees, spread knees wide, feet flared. Rock hips back toward heels. Rock gently in and out. Pad the knees and stop if they hurt.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Butterfly Stretch',           category: 'recovery', equipment: 'none', primaryMuscles: ['adductors','hips'],                secondaryMuscles: ['lower_back'],        instructions: 'Sit with soles together, knees out. Hold feet, lean forward keeping back flat. Breathe and relax groin.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Butterfly Leg Flaps',         category: 'recovery', equipment: 'none', primaryMuscles: ['adductors','hips'],                secondaryMuscles: [],                    instructions: 'Soles together. Actively drive knees down, then relax. Use active reps to open the adductors dynamically.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 20, defaultDuration: null },
  { name: 'Lizard Stretch',              category: 'recovery', equipment: 'none', primaryMuscles: ['hip_flexors','adductors','hips'],  secondaryMuscles: ['glutes','hamstrings'], instructions: 'Deep lunge, both hands inside front foot. Sink hips low. Can drop rear knee. Reach elbows to floor for deeper stretch.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Half-Kneeling Hip Flexor Stretch', category: 'recovery', equipment: 'none', primaryMuscles: ['hip_flexors','quads'],         secondaryMuscles: ['glutes'],            instructions: 'Kneeling on rear leg. Posteriorly tilt pelvis (squeeze glute), lean forward. Hold, then add overhead reach.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Standing Hip Flexor PAILs/RAILs', category: 'recovery', equipment: 'none', primaryMuscles: ['hip_flexors'],                 secondaryMuscles: ['glutes','core'],     instructions: 'Hold hip flexor stretch, then isometrically pull rear leg forward for 10 sec (PAILs), then try to push it back for 10 sec (RAILs). Increases end-range control.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Supine Piriformis Stretch',   category: 'recovery', equipment: 'none', primaryMuscles: ['glutes','piriformis'],             secondaryMuscles: ['hips'],              instructions: 'On back, cross ankle over opposite knee (figure 4). Draw both legs toward chest until glute stretch.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Standing Figure-4 Stretch',   category: 'recovery', equipment: 'none', primaryMuscles: ['glutes','piriformis'],             secondaryMuscles: ['hips'],              instructions: 'Stand, cross ankle over standing knee. Sit back as if on chair. Great for glute/piriformis before drilling.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Deep Hip External Rotation PAILs', category: 'recovery', equipment: 'none', primaryMuscles: ['hips','glutes'],              secondaryMuscles: ['adductors'],         instructions: 'In 90/90 front leg, isometrically pull leg into floor (PAILs), then actively lift knee (RAILs). 5-sec contractions, then progress range.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Supine Hip Internal Rotation', category: 'recovery', equipment: 'none', primaryMuscles: ['hips','adductors'],               secondaryMuscles: ['glutes'],            instructions: 'On back with both knees up, let one knee fall in toward the other. Important for guard recovery and hip mobility in BJJ.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Cossack Squat',               category: 'recovery', equipment: 'none', primaryMuscles: ['adductors','hips','quads'],        secondaryMuscles: ['glutes','hamstrings'], instructions: 'Feet wide, shift weight to one side into deep lateral lunge. Other leg extended with toes up. Alternate sides.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Jefferson Curl',              category: 'recovery', equipment: 'none', primaryMuscles: ['hamstrings','lower_back'],         secondaryMuscles: ['glutes'],            instructions: 'Standing, chin to chest. Roll down vertebra by vertebra until hands reach shins or floor. Control the return. You feel it along the back of the legs and the spine. Use a light weight or none, move slowly, and skip it if you have back problems. Stop if you feel sharp pain.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 6, defaultDuration: null },

  // ── SHOULDER MOBILITY ────────────────────────────────────────────────────────
  { name: 'Shoulder CARS',               category: 'recovery', equipment: 'none', primaryMuscles: ['shoulders','rotator_cuff'],        secondaryMuscles: ['chest','lats','traps'], instructions: 'Controlled Articular Rotation. Draw the biggest circle with your arm. Keep everything else still. One direction then reverse. Essential daily shoulder maintenance.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 3, defaultDuration: null },
  { name: 'Shoulder Dislocates',         category: 'recovery', equipment: 'none', primaryMuscles: ['shoulders','rotator_cuff'],        secondaryMuscles: ['chest','lats'],      instructions: 'Use PVC pipe or band, wide grip. Swing arms overhead and behind in one arc. Progressively narrow grip as comfort improves. Keep the grip wide enough that it never forces the shoulders; never force the range, and stop if the shoulder pinches.', videoUrl: 'https://www.youtube.com/watch?v=8lDC4Ri9zAQ', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Wall Slide',                  category: 'recovery', equipment: 'none', primaryMuscles: ['rotator_cuff','serratus','traps'], secondaryMuscles: ['shoulders'],         instructions: 'Stand against wall, arms bent 90°. Slide arms up overhead while keeping elbows and wrists in contact with wall.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Sleeper Stretch',             category: 'recovery', equipment: 'none', primaryMuscles: ['posterior_shoulder','rotator_cuff'], secondaryMuscles: [],                 instructions: 'Lie on stretched arm with shoulder at 90°. Use other hand to press wrist toward bed. Targets internal rotation. Gentle pressure only; back off if the shoulder pinches or hurts.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Cross-Body Shoulder Stretch', category: 'recovery', equipment: 'none', primaryMuscles: ['posterior_shoulder','rear_delts'], secondaryMuscles: ['rotator_cuff'],      instructions: 'Bring one arm across chest, use other arm to pull gently. Hold. You feel it at the back of the shoulder.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Thread the Needle',           category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine','shoulders'],      secondaryMuscles: ['lats'],              instructions: 'On hands and knees, thread one arm under the other and rotate upper back. Hold. Great for thoracic rotation paired with shoulder opening.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Band Pull-Apart',             category: 'recovery', equipment: 'none', primaryMuscles: ['rear_delts','rhomboids'],          secondaryMuscles: ['rotator_cuff'],      instructions: 'Hold band at shoulder height with straight arms. Pull apart to full extension, squeeze shoulder blades. Daily shoulder health and posture.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 20, defaultDuration: null },
  { name: 'Doorway Chest Stretch',       category: 'recovery', equipment: 'none', primaryMuscles: ['chest','front_delts'],             secondaryMuscles: ['biceps'],            instructions: 'Forearm on doorframe at 90°. Turn body away to stretch chest and shoulder. Hold 30 sec each side.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Overhead Banded Shoulder Stretch', category: 'recovery', equipment: 'none', primaryMuscles: ['lats','shoulders'],          secondaryMuscles: ['chest'],             instructions: 'Attach band to high anchor. Face it and hold, walk back until arms overhead. Hinge hips back and let head drop between arms.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Shoulder Elevation Shrug Rolls', category: 'recovery', equipment: 'none', primaryMuscles: ['traps','shoulders'],           secondaryMuscles: [],                    instructions: 'Slow shoulder rolls forward and backward. Exaggerate range at top and bottom. Easy, slow rolls to loosen up the tops of the shoulders after gripping.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Lat Stretch on Pull-up Bar',  category: 'recovery', equipment: 'bodyweight', primaryMuscles: ['lats'],                     secondaryMuscles: ['shoulders'],         instructions: 'Hang and actively shift hips side to side, pulling each lat into stretch. Can also single arm hang rotating torso away. Start with short hangs and come down before your grip fails.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Prone Shoulder ER Stretch',   category: 'recovery', equipment: 'none', primaryMuscles: ['rotator_cuff','rear_delts'],       secondaryMuscles: [],                    instructions: 'Face down, arm out to the side at 90° with the elbow bent. Gently press the back of the hand toward the floor (internal rotation). You feel it at the back of the shoulder. Gentle pressure only; stop if the shoulder pinches or hurts.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Supine Shoulder Windmill',    category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine','shoulders'],      secondaryMuscles: ['chest','lats'],      instructions: 'Lie on side, knees bent 90°. Sweep top arm in full arc overhead and behind. Follow hand with eyes. Integrates shoulder with thoracic rotation.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },

  // ── BJJ-SPECIFIC MOBILITY & WARMUP DRILLS ────────────────────────────────────
  { name: 'Granby Roll',                 category: 'bjj', equipment: 'none', primaryMuscles: ['core','neck','shoulders'],    secondaryMuscles: ['hips'],              instructions: 'From seated, roll diagonally off one shoulder to come out on the other side. Key defensive movement for guard recovery and scrambles. Drill each side.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Inversion Drill',             category: 'bjj', equipment: 'none', primaryMuscles: ['core','neck','hips'],         secondaryMuscles: ['shoulders'],         instructions: 'From guard sit-up position, invert neck and post with shoulders, kick legs overhead. Fundamental for De la Riva, X-guard, and leg entanglements.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Technical Stand-up',          category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','glutes'],       secondaryMuscles: ['quads','shoulders'],  instructions: 'From sitting, post one hand behind, cross legs, rise to base. Hip movement for getting to feet from bottom position.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Guard Get-up',                category: 'bjj', equipment: 'none', primaryMuscles: ['core','hip_flexors','hips'],  secondaryMuscles: ['glutes'],            instructions: 'From guard on back, hip escape, sit-up to base, technical stand. Chain movements continuously.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Bridge and Roll',             category: 'bjj', equipment: 'none', primaryMuscles: ['glutes','core','hips'],       secondaryMuscles: ['hamstrings'],        instructions: 'On back, drive heels into floor and bridge explosively. Post on top of head and shoulder, roll to escape bottom. Fundamental mount escape movement.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Front Roll',                  category: 'bjj', equipment: 'none', primaryMuscles: ['core','neck','shoulders'],    secondaryMuscles: ['hips'],              instructions: 'Tuck chin, roll over shoulder, come up to base. Breakfall skill for takedown defense. Keep chin tucked throughout.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Back Roll',                   category: 'bjj', equipment: 'none', primaryMuscles: ['core','neck'],                secondaryMuscles: ['shoulders'],         instructions: 'Sit, tuck chin, roll backward over one shoulder. Come up on that side. Alternate sides.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Seated Hip Internal/External Rotation', category: 'bjj', equipment: 'none', primaryMuscles: ['hips','glutes','adductors'], secondaryMuscles: [], instructions: 'Seated, one leg extended. Rotate extended knee inward (internal), then outward (external) as far as possible. Drills hip rotation range for guard play and sweeps.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Guard Hip Shift',             category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','obliques'],     secondaryMuscles: ['glutes'],            instructions: 'On back in guard position. Rapidly shift hips from side to side. Drill hip recovery timing. Drive off feet, keep core engaged.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Defensive Hip Escape Solo',   category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips'],               secondaryMuscles: ['glutes','shoulders'], instructions: 'On back, alternate shrimping each direction down the mat. Full extension and recovery. Solo drill without partner. Critical for escapes from all bottom positions.', videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 20, defaultDuration: null },
  { name: 'Seated Spine Rotation',       category: 'bjj', equipment: 'none', primaryMuscles: ['thoracic_spine','obliques'], secondaryMuscles: ['core','shoulders'],   instructions: 'Seated cross-legged, hands behind head. Rotate slowly as far as possible each direction. Essential for scrambles, switch-base escapes, and turtle defence.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'BJJ Hip Mobility Flow',       category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core'],               secondaryMuscles: ['glutes','adductors'], instructions: 'Chain: 90/90 → butterfly → seated figure-4 → pigeon → back to 90/90 on other side. Flow without stopping. Full lower body mobility sequence.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Neck Circles',               category: 'bjj', equipment: 'none', primaryMuscles: ['neck'],                       secondaryMuscles: ['traps'],              instructions: 'Slow controlled circles in each direction, in a comfortable range. Never rush. Stop if you feel sharp pain, dizziness, or tingling in the arms.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Neck Isometric Holds',        category: 'bjj', equipment: 'none', primaryMuscles: ['neck'],                       secondaryMuscles: ['traps'],              instructions: 'Press hand against forehead, side of head, back of head. Push isometrically in each direction for 10 sec. Build up gently: push at about half effort, never jerk. Stop if you feel sharp pain, dizziness, or tingling in the arms.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 10 },
  { name: 'Wrestler\'s Bridge',          category: 'bjj', equipment: 'bodyweight', primaryMuscles: ['neck','glutes','lower_back'],  secondaryMuscles: ['traps','shoulders'], instructions: 'On head and heels, arch up into full bridge. Rock forward and back. Advanced: start with a partial bridge, keep your hands ready to take weight, and stop if you feel sharp pain, dizziness, or tingling in the arms.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 30 },
  { name: 'Groin Hip Adductor Slide',    category: 'bjj', equipment: 'none', primaryMuscles: ['adductors','hips'],           secondaryMuscles: ['glutes'],            instructions: 'On all fours, slide one knee out wide along floor, lower hips toward it. Rock into end range. Targets adductor for guard guard retention and closed guard flexibility.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Hip Flexor / Psoas Release',  category: 'recovery', equipment: 'none', primaryMuscles: ['hip_flexors'],            secondaryMuscles: ['quads'],             instructions: 'Low lunge, front knee over ankle. Tuck pelvis, squeeze glute. Can add a lateral reach to feel it further along the front of the hip and side.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Standing Forward Fold',       category: 'recovery', equipment: 'none', primaryMuscles: ['hamstrings','lower_back'], secondaryMuscles: ['calves'],             instructions: 'Feet hip-width. Hinge at hips and hang. Relax neck. Bend knees slightly if hamstrings are tight. An easy position to hang in after training.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Supine Spinal Twist',         category: 'recovery', equipment: 'none', primaryMuscles: ['lower_back','thoracic_spine'], secondaryMuscles: ['hips','glutes'],  instructions: 'On back, pull one knee across body with opposite hand. Keep shoulder on floor. Breathe deeply into the rotation.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Child\'s Pose',               category: 'recovery', equipment: 'none', primaryMuscles: ['lower_back','lats'],       secondaryMuscles: ['hips','shoulders'],  instructions: 'Kneel, sit back to heels, reach arms forward on floor. Breathe slowly. Can walk hands to each side to target lats.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Foam Roll Thoracic Spine',    category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine'],           secondaryMuscles: ['lats','shoulders'],  instructions: 'Foam roller across upper back. Support head, extend over roller one segment at a time. Do not roll lumbar spine.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Foam Roll Hip Flexors',       category: 'recovery', equipment: 'none', primaryMuscles: ['hip_flexors'],              secondaryMuscles: ['quads'],             instructions: 'Face down, roller below hip on quad/psoas area. Shift weight and roll slowly. Stop and breathe into tender spots.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Foam Roll Adductors',         category: 'recovery', equipment: 'none', primaryMuscles: ['adductors'],                secondaryMuscles: ['hips'],              instructions: 'Face down, inner thigh on roller. Bend knee and roll from groin to just above knee. Stop on tight spots. Often used after heavy guard work.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Foam Roll Lats',              category: 'recovery', equipment: 'none', primaryMuscles: ['lats'],                     secondaryMuscles: ['shoulders'],         instructions: 'Side-lying, arm overhead. Roll from armpit to lower lat. You feel it along the side of the back. Roll slowly.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Cat-Cow',                     category: 'recovery', equipment: 'none', primaryMuscles: ['lower_back','thoracic_spine'], secondaryMuscles: ['core','neck'],     instructions: 'On hands and knees. Arch spine fully (cow), then round fully (cat). Slow and controlled. Good spinal warm-up before any session.', videoUrl: 'https://www.youtube.com/watch?v=kqnua4rHVVA', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Quadruped Hip CARs',          category: 'recovery', equipment: 'none', primaryMuscles: ['hips','glutes'],            secondaryMuscles: ['core'],              instructions: 'On hands and knees, one knee up. Draw the biggest circle possible without moving spine. Controlled articular rotation of the hip. Fundamental joint maintenance.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Thoracic Extension over Roller', category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine'],        secondaryMuscles: ['lats','chest'],      instructions: 'Sit in front of foam roller, place mid-back on it, hands behind head. Extend backward over roller. Move up one segment at a time from T5 to T12.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Supine Knee-to-Chest',        category: 'recovery', equipment: 'none', primaryMuscles: ['lower_back','glutes','hips'], secondaryMuscles: [],                  instructions: 'On back, draw both knees to chest, hug tight, rock gently side to side. An easy stretch for the lower back and hips; stop if it hurts.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Doorway Wrist Stretch',       category: 'recovery', equipment: 'none', primaryMuscles: ['forearms','wrists'],        secondaryMuscles: [],                    instructions: 'Place palm on wall with fingers pointing down. Gently straighten elbow to stretch forearm flexors. Essential for BJJ athletes due to gripping volume.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  // ── Home / park equipment ──────────────────────────────────────────────────
  { name: 'Wide Push-up',              category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['chest','front_delts'],    secondaryMuscles: ['triceps','serratus'],     instructions: 'Hands 1.5–2x shoulder width. Lower chest to floor leading with elbows flared. Full range. Targets outer chest.', videoUrl: 'https://www.youtube.com/watch?v=IODxDxX7oi4', mediaUrl: null, defaultSets: 4, defaultReps: 12, defaultDuration: null },
  { name: 'Pike Push-up',              category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['front_delts','side_delts'], secondaryMuscles: ['triceps'],               instructions: 'Hips high, body in inverted V. Bend elbows to lower head toward floor. Press back up. Shoulder press pattern without weight.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Push-up Board Wide',        category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['chest'],                   secondaryMuscles: ['front_delts','triceps'],  instructions: 'Use push-up board at widest position. Greater chest stretch at bottom. Full range.', videoUrl: 'https://www.youtube.com/watch?v=IODxDxX7oi4', mediaUrl: null, defaultSets: 4, defaultReps: 12, defaultDuration: null },
  { name: 'Push-up Board Narrow',      category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['triceps'],                 secondaryMuscles: ['chest','front_delts'],    instructions: 'Use push-up board at narrow position. Elbows close to body. Maximizes tricep involvement.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Ab Roller Rollout',         category: 'strength',     equipment: 'none',       primaryMuscles: ['abs','core'],              secondaryMuscles: ['lats','hip_flexors'],     instructions: 'Kneel, roller under shoulders. Roll forward until body nearly parallel with ground. Pull back using abs — do NOT use hip flexors. One of the best core exercises.', videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 8, defaultDuration: null },
  { name: 'Ab Roller Knee Tuck',       category: 'strength',     equipment: 'none',       primaryMuscles: ['abs','core'],              secondaryMuscles: ['hip_flexors'],           instructions: 'Full extension then pull knees to chest using core. Combines rollout with crunch.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Resistance Band Row',       category: 'strength',     equipment: 'none',       primaryMuscles: ['lats','rhomboids'],        secondaryMuscles: ['biceps','rear_delts'],    instructions: 'Anchor band at mid-height. Row handles to waist, squeeze shoulder blades. Pause 1s. Control the return.', videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 15, defaultDuration: null },
  { name: 'Resistance Band Bicep Curl', category: 'strength',    equipment: 'none',       primaryMuscles: ['biceps'],                  secondaryMuscles: ['forearms'],              instructions: 'Stand on band. Curl both handles toward shoulders. Fully extend and supinate at top.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Resistance Band Tricep Extension', category: 'strength', equipment: 'none',   primaryMuscles: ['triceps'],                 secondaryMuscles: [],                        instructions: 'Anchor band high. Face away, extend forearms forward and down. Squeeze triceps at full extension.', videoUrl: 'https://www.youtube.com/watch?v=vB5OHsJ3EME', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Resistance Band Lateral Raise', category: 'strength', equipment: 'none',      primaryMuscles: ['side_delts'],              secondaryMuscles: ['front_delts','traps'],   instructions: 'Stand on band. Raise arms to shoulder height in a T shape. Slow controlled negative.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Resistance Band Face Pull',  category: 'strength',    equipment: 'none',       primaryMuscles: ['rear_delts','rotator_cuff'], secondaryMuscles: ['rhomboids','traps'],   instructions: 'Anchor at eye level. Pull handles to face, elbows flared high, external rotate at end. Shoulder health essential.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 20, defaultDuration: null },
  { name: 'Bodyweight Squat',           category: 'strength',    equipment: 'bodyweight', primaryMuscles: ['quads','glutes'],          secondaryMuscles: ['hamstrings','core'],      instructions: 'Feet shoulder width, toes slightly out. Sit hips back and down. Drive knees out. Full depth. Drive through whole foot to stand.', videoUrl: 'https://www.youtube.com/watch?v=gsNoPYwWXeM', mediaUrl: null, defaultSets: 4, defaultReps: 20, defaultDuration: null },
  { name: 'Bodyweight Bulgarian Split Squat', category: 'strength', equipment: 'bodyweight', primaryMuscles: ['quads','glutes'],     secondaryMuscles: ['hamstrings','balance'],   instructions: 'Rear foot elevated on chair/bench. Front foot forward. Squat down until rear knee nears floor. Harder than it looks — builds serious legs.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Reverse Lunge',              category: 'strength',    equipment: 'bodyweight', primaryMuscles: ['quads','glutes'],          secondaryMuscles: ['hamstrings','balance'],   instructions: 'Step backward, lower rear knee to hover. Front knee tracks over foot. Push through front heel to return. Less impact than forward lunge.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Jump Rope',                  category: 'conditioning', equipment: 'none',      primaryMuscles: ['calves','cardio'],         secondaryMuscles: ['shoulders','core'],       instructions: 'Light bounce on balls of feet. Arms stay tucked. Start 2 min steady, progress to intervals. Weighted rope adds upper body demand.', videoUrl: 'https://www.youtube.com/watch?v=FJmRQ5iTXKE', mediaUrl: null, defaultSets: 1, defaultReps: null, defaultDuration: 180 },
  { name: 'Weighted Jump Rope',         category: 'conditioning', equipment: 'none',      primaryMuscles: ['calves','shoulders','cardio'], secondaryMuscles: ['forearms','core'],   instructions: 'Same as jump rope but heavier rope increases shoulder and grip demand. Do 45s on / 15s rest intervals.', videoUrl: 'https://www.youtube.com/watch?v=FJmRQ5iTXKE', mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 45 },
  { name: 'Hollow Body Hold',           category: 'strength',    equipment: 'bodyweight', primaryMuscles: ['abs','core'],              secondaryMuscles: ['hip_flexors'],           instructions: 'Lie on back, press lower back into floor. Raise legs and shoulders slightly. Arms overhead. Hold the tension. The foundation of a strong midsection.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 30 },
  { name: 'Hollow Body Rock',           category: 'strength',    equipment: 'bodyweight', primaryMuscles: ['abs','core'],              secondaryMuscles: ['hip_flexors'],           instructions: 'From hollow hold, rock back and forth maintaining the shape. No breaking at hips.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'V-Up',                       category: 'strength',    equipment: 'bodyweight', primaryMuscles: ['abs','hip_flexors'],       secondaryMuscles: ['core'],                  instructions: 'Lie flat, legs and arms extended. Simultaneously raise legs and torso, reach hands toward feet. Lower with control.', videoUrl: 'https://www.youtube.com/watch?v=iP2fjvG0g3w', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Lying Leg Raise',            category: 'strength',    equipment: 'bodyweight', primaryMuscles: ['abs','hip_flexors'],       secondaryMuscles: ['core'],                  instructions: 'Lie flat, legs straight. Raise to 90° keeping lower back pressed to floor. Lower slowly — do NOT let lower back arch at the bottom.', videoUrl: 'https://www.youtube.com/watch?v=Wp4BlxcFTkE', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Dead Bug',                   category: 'strength',    equipment: 'bodyweight', primaryMuscles: ['abs','core'],              secondaryMuscles: ['hip_flexors'],           instructions: 'On back, arms up, knees 90°. Extend opposite arm and leg while pressing lower back to floor. The key is not letting your back arch — builds real anti-extension core strength.', videoUrl: 'https://www.youtube.com/watch?v=4XLEnwUr1d8', mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Band-Assisted Pull-up', category: 'strength', equipment: 'none', primaryMuscles: ['lats','biceps'], secondaryMuscles: ['upper_back','forearms'], instructions: "Loop a resistance band over the pull-up bar and step one foot or both knees into the bottom of the loop. Start from a dead hang, pull until the chin clears the bar, lower under control. The band helps most at the bottom, so use a thicker band only until you can do the reps with a thinner one.", videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 6, defaultDuration: null },
  { name: 'Hanging Knee Raise', category: 'strength', equipment: 'bodyweight', primaryMuscles: ['abs','hip_flexors'], secondaryMuscles: ['obliques','forearms'], instructions: "Hang from the bar, or stand in a captain's chair with the back pad against you. Curl the knees up toward the chest by tucking the pelvis, then lower without swinging. Easier than the straight-leg raise.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Dead Hang', category: 'strength', equipment: 'bodyweight', primaryMuscles: ['forearms','lats'], secondaryMuscles: ['shoulders'], instructions: "Hang from the bar with a full grip and arms straight, shoulders gently pulled down away from the ears. Breathe normally and stay still. Stop the set when the grip starts to slip, not after.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Tuck L-sit Hold', category: 'strength', equipment: 'bodyweight', primaryMuscles: ['abs','hip_flexors'], secondaryMuscles: ['triceps','front_delts'], instructions: "On parallettes, press down through straight arms until the hips lift off the floor. Pull the knees up into a tuck and hold, shoulders pushed down and away from the ears. Feet may rest on the floor at first.", videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: null, defaultDuration: 15 },
  { name: 'Parallette Push-up', category: 'strength', equipment: 'bodyweight', primaryMuscles: ['chest','triceps'], secondaryMuscles: ['front_delts','core'], instructions: "Hands on parallettes, body in one straight line. Lower until the chest is between the handles and the elbows are about 45 degrees from the ribs, then press back up. The handles let the chest go deeper than a floor push-up.", videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 10, defaultDuration: null },
  { name: 'Pseudo-Planche Lean', category: 'strength', equipment: 'bodyweight', primaryMuscles: ['front_delts','chest'], secondaryMuscles: ['abs','forearms','biceps'], instructions: "In a push-up position with hands on the floor or parallettes by the hips, fingers pointing back or out. Keep the arms straight and lean the shoulders forward past the hands, body rigid. Hold, then ease back. Stop if the wrists complain.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 15 },
  { name: 'Plank Shoulder Taps', category: 'strength', equipment: 'bodyweight', primaryMuscles: ['abs','core'], secondaryMuscles: ['front_delts','obliques'], instructions: "From a high plank, feet wider than hip width, tap one shoulder with the opposite hand and put it back, then switch. Keep the hips level and still. Count every tap as one rep.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 20, defaultDuration: null },
  { name: 'Glute Bridge', category: 'strength', equipment: 'bodyweight', primaryMuscles: ['glutes','hamstrings'], secondaryMuscles: ['core','lower_back'], instructions: "On your back, knees bent, feet flat and hip width apart. Press through the heels and lift the hips until the body is a straight line from shoulders to knees. Squeeze the glutes at the top, lower slowly.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Calf Raise (bodyweight)',    category: 'strength',    equipment: 'bodyweight', primaryMuscles: ['calves'],                  secondaryMuscles: [],                        instructions: 'Stand on edge of step or flat. Rise on balls of feet, full extension. Lower slowly past neutral for full stretch. Can load with a backpack.', videoUrl: 'https://www.youtube.com/watch?v=gwLzBJYoWlI', mediaUrl: null, defaultSets: 4, defaultReps: 25, defaultDuration: null },

  // ── GYM EXERCISES NOT YET IN LIBRARY ─────────────────────────────────────────
  { name: 'EZ-Bar Curl',               category: 'strength', equipment: 'barbell', primaryMuscles: ['biceps'],         secondaryMuscles: ['brachialis','forearms'],  instructions: 'EZ-bar reduces wrist strain vs straight bar. Full extension at bottom, curl to chin. Keep elbows pinned.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Calf Raise (machine)',       category: 'strength', equipment: 'machine', primaryMuscles: ['calves'],         secondaryMuscles: [],                        instructions: 'Full range of motion — lower heel below pad level for the stretch. Pause at top for 1s. Better range than bodyweight version.', videoUrl: 'https://www.youtube.com/watch?v=gwLzBJYoWlI', mediaUrl: null, defaultSets: 4, defaultReps: 20, defaultDuration: null },
  { name: 'Plate Goblet Squat', category: 'strength', equipment: 'plate', primaryMuscles: ['quads','glutes'], secondaryMuscles: ['core','adductors'], instructions: "Hug one plate to the chest with both hands. Squat deep with the elbows inside the knees and the chest up, then drive through the heels. Start with a lighter plate if a 45 pulls the torso forward.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Plate Push-up', category: 'strength', equipment: 'plate', primaryMuscles: ['chest','triceps'], secondaryMuscles: ['front_delts','core'], instructions: "Have someone set the plate flat on the upper back, or lie face down and work it into place, keeping it clear of the neck and lower back. Hold a straight line from head to heels and press. Have someone lift it off at the end of the set rather than twisting out from under it.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Plate Glute Bridge', category: 'strength', equipment: 'plate', primaryMuscles: ['glutes','hamstrings'], secondaryMuscles: ['core'], instructions: "On your back with knees bent, rest a plate across the hips and steady it with both hands; a folded towel makes it kinder on the hip bones. Press through the heels until the body is straight from shoulders to knees, squeeze, and lower slowly.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Plate Calf Raise', category: 'strength', equipment: 'plate', primaryMuscles: ['calves'], secondaryMuscles: ['forearms'], instructions: "Hug a plate to the chest and stand with the balls of the feet on a step, one hand free to touch a wall for balance if needed. Lower the heels for a full stretch, rise as high as possible, pause, and lower slowly.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Plate Sit-up', category: 'strength', equipment: 'plate', primaryMuscles: ['abs'], secondaryMuscles: ['hip_flexors'], instructions: "Lie on your back with knees bent and hug a plate to the chest. Sit up under control and lower slowly without dropping back. Use a lighter plate first; a 45 is a big jump for most people.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Plate Pinch Carry', category: 'strength', equipment: 'plate', primaryMuscles: ['forearms'], secondaryMuscles: ['traps','core'], instructions: "Pinch a plate at the rim between the fingers and thumb, smooth side out, and walk with the shoulders level. Set it down before the grip fails, away from your feet. If a 45 will not stay in a pinch, hold it by its grip handle or use a lighter plate.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 30 },
  { name: 'Weighted Pull-up', category: 'strength', equipment: 'dip_belt', primaryMuscles: ['lats','biceps'], secondaryMuscles: ['rhomboids','forearms','core'], instructions: "Loop the chain through the plate and clip it back to the belt so the plate hangs in front, with the belt low on the hips. Step up rather than jumping, start from a dead hang, pull the chin over the bar and lower under control with no kipping. Add weight once strict bodyweight sets feel solid; a 45 is a big jump, so a lighter plate or dumbbell comes first if you have one. Keep body weight plus plates within what the bar or tower is rated for.", videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 5, defaultDuration: null },
  { name: 'Weighted Chin-up', category: 'strength', equipment: 'dip_belt', primaryMuscles: ['biceps','lats'], secondaryMuscles: ['rhomboids','forearms','core'], instructions: "Loop the chain through the plate and clip it back to the belt so the plate hangs in front, with the belt low on the hips. Use a shoulder-width underhand grip, step up rather than jumping, pull the chin over the bar and lower under control. Add weight once strict bodyweight sets feel solid. Keep body weight plus plates within what the bar or tower is rated for.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 6, defaultDuration: null },
  { name: 'Weighted Dip', category: 'strength', equipment: 'dip_belt', primaryMuscles: ['chest','triceps'], secondaryMuscles: ['front_delts'], instructions: "Loop the chain through the plate and clip it back to the belt so the plate hangs in front, with the belt low on the hips. Start at the top with arms locked, lower under control only as far as the shoulders stay comfortable, then press back up. Keep the plate from swinging, and get off the bars by stepping down. Keep body weight plus plates within what the bar or tower is rated for.", videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 6, defaultDuration: null },
  { name: 'Ab Strap Knee Raise', category: 'strength', equipment: 'ab_straps', primaryMuscles: ['abs'], secondaryMuscles: ['hip_flexors','forearms'], instructions: "Hang the straps from the bar, clip them on and rest your upper arms in the loops with the elbows bent. Curl the pelvis up and bring the knees toward the chest, then lower slowly without swinging. Come out of the straps if your arms go numb.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Ab Strap Leg Raise', category: 'strength', equipment: 'ab_straps', primaryMuscles: ['abs'], secondaryMuscles: ['hip_flexors','forearms'], instructions: "Hang from the straps with your upper arms in the loops. Keep the legs nearly straight and raise them to about hip height, curling the pelvis at the top, then lower slowly without swinging. Bend the knees to make it easier.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Ab Strap Oblique Knee Raise', category: 'strength', equipment: 'ab_straps', primaryMuscles: ['obliques'], secondaryMuscles: ['abs','hip_flexors'], instructions: "Hang from the straps with your upper arms in the loops. Bring both knees up and across toward one shoulder, lower slowly, then alternate sides without swinging.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Landmine Rotation', category: 'strength', equipment: 'landmine', primaryMuscles: ['obliques','abs'], secondaryMuscles: ['glutes','front_delts','core'], instructions: "Slide the bar's sleeve into the landmine and load only the free end, with a collar on. Hold the end of the bar in both hands at chest height, arms long. Swing it in an arc from one hip to the other by pivoting the feet and turning the hips, keeping the ribs and hips moving together rather than twisting at the lower back. Use a load you can move fast and stop the set when the bar slows; this trains speed, not grinding. Count each side as one rep and keep your head and others clear of the arc.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 6, defaultDuration: null },
  { name: 'Landmine Rotational Press', category: 'strength', equipment: 'landmine', primaryMuscles: ['front_delts','triceps'], secondaryMuscles: ['obliques','glutes','chest'], instructions: "Slide the bar's sleeve into the landmine and load only the free end, with a collar on. Stand side-on to the anchor in a staggered stance and hold the end of the bar at the rear shoulder in one hand, weight on the rear foot. Drive off the rear foot, pivot it, turn the hips and finish by pressing the bar up and away. Lower under control and reset. Use a load you can move fast and stop the set when the bar slows; this trains speed, not grinding. Do every rep on one side, then switch.", videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 5, defaultDuration: null },
  { name: 'Landmine Punch', category: 'strength', equipment: 'landmine', primaryMuscles: ['front_delts','triceps','obliques'], secondaryMuscles: ['glutes','calves','chest'], instructions: "Slide the bar's sleeve into the landmine and load only the free end, with a collar on. Take your fight stance with the end of the bar at the rear shoulder in one hand. Push off the rear foot, turn the hip and shoulder through and extend the arm like a cross, then bring it back under control and reset the stance. Do not reach past your balance. Use a load you can move fast and stop the set when the bar slows; this trains speed, not grinding. Do every rep on one side, then switch stance.", videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 4, defaultDuration: null },
  { name: 'Landmine Deadlift to Rotational Press', category: 'strength', equipment: 'landmine', primaryMuscles: ['glutes','hamstrings','front_delts'], secondaryMuscles: ['obliques','quads','triceps'], instructions: "Slide the bar's sleeve into the landmine and load only the free end, with a collar on. Stand side-on to the bar with the end by your lead foot. Hinge down with a flat back and take it in the far hand or both hands, drive up through the legs and hips, pivot, and press it up and away in one movement. Lower under control and reset. Use a load you can move fast and stop the set when the bar slows; this trains speed, not grinding. Do every rep on one side, then switch.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 4, defaultDuration: null },
  { name: 'Landmine Push Press', category: 'strength', equipment: 'landmine', primaryMuscles: ['front_delts','triceps'], secondaryMuscles: ['quads','glutes','core'], instructions: "Slide the bar's sleeve into the landmine and load only the free end, with a collar on. Face the anchor with the end of the bar in both hands at the upper chest. Dip a few inches through the knees with the torso upright, then drive the legs hard and let that speed carry the press to straight arms. Lower under control. Use a load you can move fast and stop the set when the bar slows; this trains speed, not grinding.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Landmine Thruster', category: 'strength', equipment: 'landmine', primaryMuscles: ['quads','glutes','front_delts'], secondaryMuscles: ['triceps','core'], instructions: "Slide the bar's sleeve into the landmine and load only the free end, with a collar on. Face the anchor and hold the end of the bar in both hands at the upper chest. Squat with the chest up, then stand fast and press in one continuous movement. Lower the bar to the chest before the next squat. Use a load you can move fast and stop the set when the bar slows; this trains speed, not grinding.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 6, defaultDuration: null },
  { name: 'Landmine Split Jerk', category: 'strength', equipment: 'landmine', primaryMuscles: ['quads','glutes','front_delts'], secondaryMuscles: ['triceps','core','calves'], instructions: "Slide the bar's sleeve into the landmine and load only the free end, with a collar on. Face the anchor with the end of the bar in one or both hands at the shoulder. Dip, drive up, then drop quickly into a short split as the arm straightens, catching with a soft front knee. Step the front foot back, then the rear foot forward, before lowering the bar. Learn it light; this is the most technical of the set. Use a load you can move fast and stop the set when the bar slows; this trains speed, not grinding.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 3, defaultDuration: null },
  { name: 'Landmine Meadows Row', category: 'strength', equipment: 'landmine', primaryMuscles: ['lats','rhomboids'], secondaryMuscles: ['biceps','rear_delts','forearms'], instructions: "Slide the bar's sleeve into the landmine and load only the free end, with a collar on. Stand side-on to the end of the bar in a staggered stance and hinge forward with the hips higher than usual, resting the near forearm on the front thigh. Grip the sleeve end overhand, row it toward the hip, pause and lower under control. Keep the back flat and stop short of letting it twist.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Landmine Reverse Lunge', category: 'strength', equipment: 'landmine', primaryMuscles: ['quads','glutes'], secondaryMuscles: ['hamstrings','core'], instructions: "Slide the bar's sleeve into the landmine and load only the free end, with a collar on. Face the anchor with the end of the bar in both hands at the chest. Step one foot back into a lunge with the torso tall, then drive through the front foot to stand. Alternate sides.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 6, defaultDuration: null },
  { name: 'Landmine Lateral Lunge', category: 'strength', equipment: 'landmine', primaryMuscles: ['quads','glutes','adductors'], secondaryMuscles: ['hamstrings','core'], instructions: "Slide the bar's sleeve into the landmine and load only the free end, with a collar on. Face the anchor with the end of the bar in both hands at the chest. Step wide to one side, sit the hips back over that foot with the other leg straight, then push hard off it to return to centre. Alternate sides, and use a depth your hips and knees are comfortable with.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 6, defaultDuration: null },
  { name: 'Landmine Anti-Rotation', category: 'strength', equipment: 'landmine', primaryMuscles: ['abs','obliques'], secondaryMuscles: ['front_delts','glutes','core'], instructions: "Slide the bar's sleeve into the landmine and load only the free end, with a collar on. Stand facing the anchor with arms straight and the end of the bar at about chest height. Move it slowly side to side in a small arc using only the arms, keeping the hips and shoulders square. The job is to resist turning, so go slowly and do not let the torso follow the bar.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Overhead Tricep Extension', category: 'strength', equipment: 'cable_machine', primaryMuscles: ['triceps'],  secondaryMuscles: [],                        instructions: 'Cable or single dumbbell. Keep elbows close to head. Full stretch behind head, extend to lockout. Long head of tricep gets stretched here.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Pec Deck',                  category: 'strength', equipment: 'machine', primaryMuscles: ['chest'],          secondaryMuscles: ['front_delts'],           instructions: 'Machine chest fly. Slight bend in elbows, squeeze pecs together at peak contraction. Control the eccentric — feel the stretch at full open.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Dumbbell Overhead Press',   category: 'strength', equipment: 'dumbbell', primaryMuscles: ['front_delts','side_delts'], secondaryMuscles: ['triceps'], instructions: 'Seated or standing. Press dumbbells from shoulder height to lockout overhead. Control the descent.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Single-Arm Dumbbell Row',   category: 'strength', equipment: 'dumbbell', primaryMuscles: ['lats','rhomboids'], secondaryMuscles: ['biceps','rear_delts'], instructions: 'Support on bench. Row dumbbell to ribcage keeping elbow close. Full stretch at bottom. 12 per side.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Cable Wood Chop (High)',     category: 'strength', equipment: 'cable_machine', primaryMuscles: ['obliques','core'], secondaryMuscles: ['shoulders','lats'], instructions: 'High pulley to one side. Pull diagonally across body in chopping motion. 12 per side.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },

  // ── MUAY THAI — STRIKES ──────────────────────────────────────────────────────
  { name: 'Jab Drill',                      category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','chest'],           secondaryMuscles: ['triceps','core'],          instructions: 'From stance, extend lead hand straight. Rotate shoulder into it, snap back fast. Keep rear hand protecting chin. Drill in front of mirror for form, then on bag.', videoUrl: null, mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 60 },
  { name: 'Cross Drill',                    category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','chest'],           secondaryMuscles: ['core','hips','triceps'],   instructions: 'Rotate rear hip and shoulder, drive rear hand straight. Full hip rotation is power — the hand just delivers it. Pivot on rear foot.', videoUrl: null, mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 60 },
  { name: 'Hook Drill',                     category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','chest','core'],    secondaryMuscles: ['obliques','biceps'],       instructions: 'Short arc punch. Elbow at 90°, pivot on lead foot, rotate hips. Keep elbow level with fist. Power from hip rotation not arm swing.', videoUrl: null, mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 60 },
  { name: 'Uppercut Drill',                 category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','triceps'],         secondaryMuscles: ['legs','core'],             instructions: 'Drop slightly, drive up from legs through hip then shoulder. Fist palm-in, elbow stays inside body. Lead or rear. Good for inside range.', videoUrl: null, mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 60 },
  { name: 'Teep (Front Push Kick)',          category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hip_flexors','quads'],         secondaryMuscles: ['calves','core'],           instructions: 'Lift knee high, extend leg and push through the ball of foot. Snaps hips forward on release. Range tool and defense. Aim for midsection. Re-chamber before landing.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 20, defaultDuration: null },
  { name: 'Rear Teep',                      category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hip_flexors','quads','glutes'], secondaryMuscles: ['core','calves'],          instructions: 'Rear leg teep — more power than lead. Drive hips forward aggressively. Great for stopping forward pressure. Pivot stance foot on delivery.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Roundhouse Kick — Low',          category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hips','quads','glutes'],       secondaryMuscles: ['calves','core'],           instructions: 'Pivot on plant foot, swing hip over. Cut through target with shin, not foot. Target outer thigh. Step in at 45° for power. Low kicks win fights.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Roundhouse Kick — Body',         category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hips','core','glutes'],        secondaryMuscles: ['obliques','calves'],       instructions: 'Same mechanics as low kick but aim for liver or floating ribs. Slightly more hip rotation needed. Opponent will not check this — body kicks score well.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Roundhouse Kick — Head',         category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hips','adductors','glutes'],   secondaryMuscles: ['core','calves'],           instructions: 'Full hip rotation and hip flexor flexibility required. Taller chamber, drive hip over. Keep hands up. Often set up by feinting low first.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Switch Kick',                    category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hips','quads'],               secondaryMuscles: ['core','calves'],           instructions: 'Quick switch of feet to kick with lead leg at power of rear. Step, switch, kick in one fluid motion. Creates angles and disguises the kick.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Spinning Back Kick',             category: 'muay_thai', equipment: 'none',  primaryMuscles: ['glutes','hamstrings','core'],  secondaryMuscles: ['quads','calves'],          instructions: 'Turn 180° looking over shoulder, thrust heel straight back. One of the most powerful kicks. Spot target before extending. Can wind opponent instantly.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Knee Strike — Long Range',       category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hip_flexors','quads','core'],  secondaryMuscles: ['glutes','calves'],         instructions: 'Skip step in, pull down on invisible head, drive knee upward. Hips forward at impact. Target solar plexus or floating ribs.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Clinch Knee — Diagonal',         category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hip_flexors','obliques','core'], secondaryMuscles: ['glutes','adductors'],    instructions: 'From clinch, step slightly to outside, diagonal knee to body. Avoids opponent\'s blocking elbow. Alternate sides for consistent threat.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Jumping Knee (Kao Loi)',         category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hip_flexors','quads','core'],  secondaryMuscles: ['calves','glutes'],         instructions: 'Leap off rear foot, drive lead knee upward. Advanced technique — requires explosive power and setup. Usually off clinch break or guard drop.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Horizontal Elbow (Sok Tad)',     category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','core'],           secondaryMuscles: ['triceps','chest'],         instructions: 'Swing elbow across at throat/temple height. Full hip rotation. Short range. Most common cutting elbow.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Diagonal Elbow (Sok Chieng)',    category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','chest','core'],   secondaryMuscles: ['triceps','obliques'],      instructions: 'Downward diagonal elbow from high to low. Targets bridge of nose or temple. Often follows a caught kick or during clinch exit.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Upward Elbow (Sok Ngad)',        category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','core'],           secondaryMuscles: ['legs','obliques'],         instructions: 'Drive elbow upward into chin as opponent ducks. Push off rear leg. Anticipation tool — set up with body punch then uppercut elbow.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Spinning Back Elbow',            category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','core','obliques'], secondaryMuscles: ['hips'],                   instructions: '180° spin, drive rear elbow behind you into opponent\'s face. Spot before striking. High risk but devastating when landed. Often off parry.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },

  // ── MUAY THAI — CLINCH & DEFENSE ─────────────────────────────────────────────
  { name: 'Double Collar Tie (Plum)',       category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','traps','forearms'], secondaryMuscles: ['core','neck'],           instructions: 'Both hands behind opponent\'s head, elbows pointing in. Control the head, pull down into knees. Prevent opponent from framing out.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 120 },
  { name: 'Inside Clinch Sweep (Dteh Chiang)', category: 'muay_thai', equipment: 'none', primaryMuscles: ['hips','legs','core'],        secondaryMuscles: ['shoulders','traps'],       instructions: 'From clinch, hook opponent\'s lead leg with your lead, pull head down and sweep. Torque upper body opposite direction of sweep.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Muay Thai Footwork — Triangle',  category: 'muay_thai', equipment: 'none',  primaryMuscles: ['calves','quads'],             secondaryMuscles: ['core','hips'],             instructions: 'Step to outside of opponent at 45°, then triangle back to center. Creates angles for body kicks and avoids counter. Drill both directions.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 60 },
  { name: 'Muay Thai Footwork — Pivot',     category: 'muay_thai', equipment: 'none',  primaryMuscles: ['calves','hips'],              secondaryMuscles: ['core'],                    instructions: 'Plant lead foot, pivot 90° out of line. Creates outside angle and off-angles for attacks. Practice both directions.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 60 },
  { name: 'Parry and Counter Drill',        category: 'muay_thai', equipment: 'pads',  primaryMuscles: ['shoulders','core'],           secondaryMuscles: ['forearms','hips'],         instructions: 'With partner: parry jab outside, return cross. Parry cross, return hook. Trains timing and counter instinct. Critical for Muay Thai IQ.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 180 },
  { name: 'Slip and Counter',              category: 'muay_thai', equipment: 'none',  primaryMuscles: ['core','obliques'],            secondaryMuscles: ['legs','shoulders'],        instructions: 'Slip incoming jab/cross outside by moving head offline. Drive rear hand cross immediately. Timing drill — sets up powerful counters.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 120 },
  { name: 'Kick Check Practice',           category: 'muay_thai', equipment: 'none',  primaryMuscles: ['calves','shins','core'],      secondaryMuscles: ['quads','hips'],            instructions: 'Lift lead shin to meet incoming kick. Check with the hard part of shin. Condition shins first. Keep hands up while checking.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 120 },
  { name: 'Combination: 1-2-Low Kick',      category: 'muay_thai', equipment: 'bag',   primaryMuscles: ['full_body'],                  secondaryMuscles: [],                          instructions: 'Jab → cross → rear roundhouse to thigh. Most fundamental Muay Thai combo. Drive hips on kick after transferring weight from cross.', videoUrl: null, mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 60 },
  { name: 'Combination: Teep-Cross-Hook',   category: 'muay_thai', equipment: 'bag',   primaryMuscles: ['full_body'],                  secondaryMuscles: [],                          instructions: 'Lead teep to create distance/space, step in with cross, hook. Range management combo — keep opponent off their rhythm.', videoUrl: null, mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 60 },
  { name: 'Combination: Elbow-Knee-Clinch', category: 'muay_thai', equipment: 'bag',   primaryMuscles: ['full_body'],                  secondaryMuscles: [],                          instructions: 'Enter with horizontal elbow, pull into clinch, drive diagonal knee. Transition from striking to clinch is key Muay Thai skill.', videoUrl: null, mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 60 },
  { name: 'Shin Conditioning on Bag',       category: 'muay_thai', equipment: 'bag',   primaryMuscles: ['calves','shins'],             secondaryMuscles: [],                          instructions: 'Tap lead shin against bag progressively. Not full power — the goal is micro-trauma for bone density increase. 3 min rounds, gradually increase over weeks.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 180 },

  // ── Striking & conditioning added 2026-10-26 ──
  { name: 'Lead Hook to the Body', category: 'muay_thai', equipment: 'bag', primaryMuscles: ['obliques','shoulders','core'], secondaryMuscles: ['front_delts','quads','hips'], instructions: 'From stance, bend the knees to drop level with the target (do not bend at the waist). Lean onto the lead side, turn the lead hip and shoulder in together, and dig the fist in under the ribs (liver side) with the elbow tight to your hip and the palm facing you or up. Rear hand stays glued to the chin. Snap back to guard.', videoUrl: null, mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 60 },
  { name: 'Rear Uppercut to the Body', category: 'muay_thai', equipment: 'bag', primaryMuscles: ['obliques','shoulders','core'], secondaryMuscles: ['quads','glutes','triceps'], instructions: 'Sit down slightly onto the rear leg, then drive up through the rear hip and turn the shoulder through, digging the rear fist up into the solar plexus. Elbow stays in front of the ribs, not winging out, and the lead hand stays on the chin. Short and tight: the legs make the power. Return to guard immediately.', videoUrl: null, mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 60 },
  { name: 'Overhand Right', category: 'mma', equipment: 'bag', primaryMuscles: ['shoulders','lats','core'], secondaryMuscles: ['obliques','front_delts','quads'], instructions: 'Throw the rear hand in an arc up and over the top of the opponent\'s jab, landing travelling downward on the temple or jaw. The head moves off the centre line as you throw (dip toward the lead side), the lead hand stays high, and the rear heel turns out. Do not loop it wide behind you: the elbow lifts, the fist comes over. Return to guard on the same path.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Superman Punch', category: 'mma', equipment: 'bag', primaryMuscles: ['full_body'], secondaryMuscles: ['shoulders','hip_flexors','glutes','calves'], instructions: 'From stance, bring the rear knee forward as if to knee, then snap the same leg back hard while springing off the lead foot. The kick-back throws you forward: fire the rear hand straight through as you travel and land on the lead foot as the punch lands. Keep the lead hand on the chin. Step back to stance and reset. Learn it slowly before adding the jump.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Spinning Back Fist', category: 'mma', equipment: 'bag', primaryMuscles: ['shoulders','obliques','core'], secondaryMuscles: ['rear_delts','triceps','calves'], instructions: 'Step the lead foot across the centre line, pivot on it and turn your back to the target, looking over the rear shoulder to spot it before you strike. As the hips come round, whip the rear arm out and hit with the back of the fist (the knuckles), elbow nearly straight at contact. Finish facing the target in stance, hands up. Spot first, every rep; drill slowly on the bag.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Side Kick', category: 'mma', equipment: 'bag', primaryMuscles: ['glutes','hip_flexors','core'], secondaryMuscles: ['quads','hamstrings','obliques'], instructions: 'Chamber the lead knee high and across the body, pivot on the standing foot until its heel points at the target, then drive the heel out in a straight line, leaning the torso away. Strike with the heel and the blade of the foot, toes level or pointing slightly down. Re-chamber before you put the foot down. Body or head height; keep the hands up as you lean back.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Oblique Kick', category: 'mma', equipment: 'none', primaryMuscles: ['glutes','quads','hip_flexors'], secondaryMuscles: ['core','calves'], instructions: 'A short stomp at the opponent\'s lead knee or thigh. Lift the lead knee with the foot turned out, then push the sole down and forward through the knee line, heel first, with the hips behind it. It is a stopping kick, not a snap: drive through and put the foot back in stance. Keep the hands up. Drill it on a bag at knee height or into the air; never at full power on a partner\'s knee.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Question-Mark Kick', category: 'muay_thai', equipment: 'bag', primaryMuscles: ['hip_flexors','adductors','glutes'], secondaryMuscles: ['core','obliques','quads'], instructions: 'Start it like a low or body roundhouse with the knee chambered pointing down, so it reads as a kick to the legs. At the top of the chamber turn the hip over, bring the knee up and hook the shin over the top onto the head. The path of the foot draws a question mark. Needs flexible hips; build height gradually and keep the rear hand at the chin.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Lead-Leg Switch Knee', category: 'muay_thai', equipment: 'bag', primaryMuscles: ['hip_flexors','quads','core'], secondaryMuscles: ['calves','glutes','obliques'], instructions: 'A quick hop swaps the feet so the lead leg goes to the back, then that leg drives the knee straight up and through the target with the hips pushed forward and both hands pulling the head down. Land, step back, reset. The switch is small and fast: a long switch telegraphs the knee.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Parry and Catch Drill', category: 'muay_thai', equipment: 'pads', primaryMuscles: ['shoulders','forearms'], secondaryMuscles: ['core','triceps'], instructions: 'Long guard and short defence in one drill. The lead hand reaches out open to frame the distance; the rear hand parries the jab down and across with a small slap; the lead glove catches the follow-up in front of the face; the jab comes straight back. Small movements, eyes open, hands return to guard every time. With a partner at 30-50% speed, or shadow it.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 120 },
  { name: 'Bob and Weave (Roll Under)', category: 'mma', equipment: 'none', primaryMuscles: ['quads','glutes','core'], secondaryMuscles: ['obliques','calves'], instructions: 'Roll under a hook: bend the knees to drop the head under the punch, travel in a U to the other side and come up still in stance with the hands up. Bend at the knees, not the waist; eyes stay on the opponent and the hands never drop. Chain one roll per incoming hook, then counter (a hook or uppercut) on the way up.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 60 },
  { name: 'Catch and Return (Body Kick)', category: 'muay_thai', equipment: 'pads', primaryMuscles: ['core','shoulders'], secondaryMuscles: ['obliques','biceps','glutes'], instructions: 'Turn slightly with an incoming body kick to take the power out, scoop the shin with the lead arm and clamp it to the ribs, rear hand on top. Step off line, then return fire: a rear low kick to the standing leg (or a cross) before letting go. Do not hold the leg for more than a second. Partner drill, kicks at 50% power.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 120 },
  { name: 'Pull Counter', category: 'mma', equipment: 'none', primaryMuscles: ['core','quads'], secondaryMuscles: ['shoulders','obliques','calves'], instructions: 'Let the jab fall short by shifting the weight onto the rear leg and leaning back, keeping the head on the centre line and the rear hand ready to catch. As the jab retracts, bring the weight forward and fire the cross straight back down the same line. Small shift, fast return. Partner drill or shadow it with an imagined jab.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 120 },
  { name: 'Sit-Out (Front Headlock Escape)', category: 'mma', equipment: 'none', primaryMuscles: ['core','hips','obliques'], secondaryMuscles: ['triceps','hip_flexors','quads'], instructions: 'Snapped down on the knees with the head trapped: post on the far hand, come up onto the toes, then kick the near leg straight through under the body and sit on that hip, turning the shoulders away so the head comes out. Keep the elbows tight and the posted arm straight. Turn back to base and repeat to both sides. Wrestling drill, solo or with a partner holding a light headlock.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Bear Crawl', category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['core','shoulders','quads'], secondaryMuscles: ['front_delts','triceps','hip_flexors'], instructions: 'On hands and the balls of the feet, knees bent at 90 degrees and hovering a few centimetres off the floor, back flat. Crawl forward (or back) by moving the opposite hand and foot together in short steps, without letting the hips rise or rock. Go for distance (10-20 m) or time.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 45 },
  { name: 'Crab Walk', category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['triceps','glutes','core'], secondaryMuscles: ['rear_delts','hamstrings','quads'], instructions: 'Sit with the hands on the floor behind the shoulders, fingers pointing back, and the feet flat in front, then lift the hips level with the knees. Walk forward or backward on opposite hand and foot, keeping the hips up and the chest open. Go for distance or time.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 45 },
  { name: 'Sled Push', category: 'conditioning', equipment: 'machine', primaryMuscles: ['quads','glutes','calves'], secondaryMuscles: ['hamstrings','core','shoulders'], instructions: 'Hands on the uprights with the arms bent, body at about 45 degrees in a straight line from head to rear heel. Drive the sled with short, powerful steps on the balls of the feet, pushing each leg back to full extension while the other knee drives through. Keep the back flat and the hips low. 15-25 m per push, walk back as rest.', videoUrl: null, mediaUrl: null, defaultSets: 6, defaultReps: null, defaultDuration: 30 },
  { name: 'Backward Sled Drag', category: 'conditioning', equipment: 'machine', primaryMuscles: ['quads','calves'], secondaryMuscles: ['glutes','forearms','traps','core'], instructions: 'Face the sled holding the straps at arm\'s length, sit the hips slightly back and lean back against the load. Walk backward in short steps, each foot reaching back and pulling the floor through under the hips, with the knees staying bent. A quad finisher that is easy on the knees. 20-30 m per drag.', videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: null, defaultDuration: 40 },

  // ── BJJ — SUBMISSIONS ────────────────────────────────────────────────────────
  { name: 'Armbar from Guard',              category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','hip_flexors'],   secondaryMuscles: ['shoulders','legs'],        instructions: 'From closed guard, hip escape to one side, swing leg over head. Control wrist to chest, squeeze knees, bridge hips up. Control the thumb side. Patient extension.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Triangle Choke Setup',           category: 'bjj', equipment: 'none', primaryMuscles: ['hips','adductors','core'],     secondaryMuscles: ['legs','core'],             instructions: 'From guard, push opponent\'s arm across, throw leg over shoulder. Lock figure-4 with legs. Adjust angle 90° for finish. Pull head down.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Rear Naked Choke Finish',        category: 'bjj', equipment: 'none', primaryMuscles: ['biceps','forearms','shoulders'], secondaryMuscles: ['core'],                 instructions: 'Choking arm under chin, hand behind opponent\'s head. Squeeze elbow together and flex bicep. Turn your head to finish side. Tight seatbelt with legs.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Guillotine Choke',               category: 'bjj', equipment: 'none', primaryMuscles: ['biceps','forearms','core'],    secondaryMuscles: ['shoulders','legs'],        instructions: 'Arm under chin, cup hand or Marcelo grip. Pull upward and squeeze. Guard pull finishes it. High elbow makes it tighter. Danger position: if they stack you, go arm-in.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Kimura from Half Guard',         category: 'bjj', equipment: 'none', primaryMuscles: ['core','shoulders'],           secondaryMuscles: ['hips','arms'],             instructions: 'From bottom half guard, underhook opposite arm, grab wrist with near hand, figure-4 grip. Hip escape to create space. Rotate toward the lock.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Americana from Mount',           category: 'bjj', equipment: 'none', primaryMuscles: ['core','shoulders'],           secondaryMuscles: ['chest','arms'],            instructions: 'Pin opponent\'s wrist to mat, figure-4 grip. Slide their elbow toward hip while pinning wrist. Low angle finish — shoulder lock. Keep your weight forward.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Omoplata',                       category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core','adductors'],    secondaryMuscles: ['shoulders','legs'],        instructions: 'From guard, swing leg over opponent\'s arm, lock with hip. Sit up, base hand behind you, rotate forward to finish shoulder lock. Roll them if they try to roll out.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Bow and Arrow Choke',            category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','lats'],         secondaryMuscles: ['legs','shoulders'],        instructions: 'From back control, grip collar deep, straighten choking arm while pulling with collar hand. Foot hooks on hip and knee. Extend body backward like drawing a bow.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'D\'Arce Choke',                  category: 'bjj', equipment: 'none', primaryMuscles: ['biceps','forearms','shoulders'], secondaryMuscles: ['core','chest'],         instructions: 'Arm slips under nearside armpit, lock across opponent\'s neck. Hands in guillotine position. Tripod to finish. Usually available from scrambles and takedowns.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Heel Hook (Outside)',            category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips'],                secondaryMuscles: ['legs','arms'],             instructions: 'Control opponent\'s leg between your legs (saddle/ashi). Hook heel with near elbow crook. Windshield wiper hips to finish. Extreme care — tap early.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Straight Ankle Lock',            category: 'bjj', equipment: 'none', primaryMuscles: ['core','forearms'],            secondaryMuscles: ['hips','arms'],             instructions: 'Achilles lock: arm under Achilles, grip hands, squeeze knees together, lean back and pull foot toward armpit while pushing hip. Basic submission from leg entanglement.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Cross Collar Choke from Mount',  category: 'bjj', equipment: 'none', primaryMuscles: ['forearms','biceps'],          secondaryMuscles: ['shoulders','core'],        instructions: 'From mount, thread first hand deep into collar thumb-in, second hand over-the-top. Elbows squeeze in and down. Posture up slightly to break their arms free.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Clock Choke from Turtle',        category: 'bjj', equipment: 'none', primaryMuscles: ['core','shoulders'],           secondaryMuscles: ['hips','legs'],             instructions: 'One arm deep into collar from behind turtle. Walk hips like a clock hand (hence the name) to crank the choke from a weird angle. Works when other attacks are stuffed.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },

  // ── BJJ — SWEEPS ─────────────────────────────────────────────────────────────
  { name: 'Scissor Sweep',                  category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','adductors'],    secondaryMuscles: ['legs','shoulders'],        instructions: 'From closed guard, open guard, shin across belly, other leg hooks behind knee. Scissor legs while pulling sleeve and pushing collar. Sit up into top position.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Hip Bump Sweep',                 category: 'bjj', equipment: 'none', primaryMuscles: ['hips','glutes','core'],       secondaryMuscles: ['legs','arms'],             instructions: 'From closed guard, sit up to post hand, explode hips forward into opponent as you post. Pull sleeve, use your body as a lever. Often sets up kimura or guillotine.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Hook Sweep (Butterfly)',         category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core','adductors'],    secondaryMuscles: ['legs','shoulders'],        instructions: 'From butterfly guard, underhook one arm, pull opponent off-balance over that shoulder. Elevate with butterfly hook, sweep. Keep close as you elevate.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Tripod Sweep',                   category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core','legs'],         secondaryMuscles: ['shoulders','arms'],        instructions: 'One foot on hip, other hooks behind knee. Pull ankle with hands as you push hip with foot. Opponent tips over. Follow into standing pass position.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'De La Riva Sweep',               category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core','adductors'],    secondaryMuscles: ['legs','shoulders'],        instructions: 'DLR hook on outside of opponent\'s lead leg. Grip sleeve and ankle. Kick and extend to off-balance. Multiple sweep options — sit-up, back take, berimbolo.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'X-Guard Sweep',                  category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core','legs'],         secondaryMuscles: ['adductors','arms'],        instructions: 'Both hooks under opponent\'s legs in X pattern. Angle to one side, extend legs to elevate, guide them to mat. Technical position requiring good hips.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },

  // ── BJJ — PASSES ─────────────────────────────────────────────────────────────
  { name: 'Knee Slice Pass',                category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core','quads'],        secondaryMuscles: ['shoulders','legs'],        instructions: 'Grab far collar and near ankle. Slice knee across opponent\'s inner thigh pressing guard flat. Drive forward with hips while keeping pressure. Settle to side control.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Torreando Pass',                 category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core','shoulders'],    secondaryMuscles: ['legs','arms'],             instructions: 'Grab both pants at knees. Push legs to one side and jump around the other direction. Speed and commitment. Often used when opponent tries to recover guard.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Double Under Pass',              category: 'bjj', equipment: 'none', primaryMuscles: ['lower_back','hips','core'],   secondaryMuscles: ['shoulders','legs'],        instructions: 'Stack both legs up, arms under both of opponent\'s legs, grab collar. Walk opponent up on their shoulders, drive into them. Heavy pressure — hard to recover from.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Leg Drag Pass',                  category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core','shoulders'],    secondaryMuscles: ['legs','arms'],             instructions: 'Grab one leg, drag it across your body while stepping around. Pull leg to your hip, flatten their hip. Follow with side control or back take.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },

  // ── BJJ — ESCAPES & BACK DEFENSE ─────────────────────────────────────────────
  { name: 'Mount Escape — Elbow-Knee',      category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','glutes'],       secondaryMuscles: ['legs','arms'],             instructions: 'From bottom mount: trap arm with elbow, bring knee across to make space, hip escape to guard. Bridge first to create elbow room. Most reliable mount escape.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Side Control Escape — Knee-to-Elbow', category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips'],           secondaryMuscles: ['legs','shoulders'],        instructions: 'Frame on chin and hip. Hip escape to create knee-to-elbow space. Insert knee then build guard. Need to time movement with opponent\'s weight shift.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Back Defense — Hand Fighting',   category: 'bjj', equipment: 'none', primaryMuscles: ['forearms','shoulders','core'], secondaryMuscles: ['hips','legs'],           instructions: 'From back control: clear choking hand by two-on-one, chin down. Turn into guard. Rotate toward seatbelt side. Most escapes fail from not protecting the neck first.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Turtle Position Defense',        category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','shoulders'],    secondaryMuscles: ['neck','glutes'],           instructions: 'On all fours in tight ball. Elbows in, chin protected. Post and stand or single-leg to escape. Often better to go belly down than give up back directly.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Back Take from Turtle',          category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','shoulders'],    secondaryMuscles: ['legs','arms'],             instructions: 'From opponent\'s turtle: get seatbelt grip, roll to side, insert hooks. Key: take the near side first when rolling. Follow them and stay on top of the back take.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },

  // ── MMA-SPECIFIC CONDITIONING & STRENGTH ─────────────────────────────────────
  { name: 'Turkish Get-Up',                 category: 'strength', equipment: 'kettlebell', primaryMuscles: ['full_body','core','shoulders'], secondaryMuscles: ['hips','quads','glutes'], instructions: 'From lying, extend KB overhead, stand up in stages keeping arm locked. Reverse the movement. Builds unilateral shoulder stability and body integration. Slow and controlled.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 3, defaultDuration: null },
  { name: 'Kettlebell Swing',               category: 'conditioning', equipment: 'kettlebell', primaryMuscles: ['hamstrings','glutes','lower_back'], secondaryMuscles: ['core','shoulders','forearms'], instructions: 'Hip hinge, drive hips forward explosively. Bell floats to shoulder height from hip power not arms. Russian swing stops at chest. Posterior chain power for throws and takedowns.', videoUrl: 'https://www.youtube.com/watch?v=YSxHifyI6s8', mediaUrl: null, defaultSets: 4, defaultReps: 15, defaultDuration: null },
  { name: 'Medicine Ball Slam',             category: 'conditioning', equipment: 'none', primaryMuscles: ['full_body','core','lats'],     secondaryMuscles: ['shoulders','hips','quads'], instructions: 'Raise ball overhead, slam it into floor with maximum force. Absorb and pick up immediately. Builds rotational and vertical power important for striking.', videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 10, defaultDuration: null },
  { name: 'Rotational Medicine Ball Throw', category: 'conditioning', equipment: 'none', primaryMuscles: ['core','obliques','hips'],     secondaryMuscles: ['shoulders','chest','legs'], instructions: 'Stand sideways to wall. Load hip, rotate and throw ball against wall. Trains the same rotation pattern as hooks and roundhouse kicks. Both sides.', videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 10, defaultDuration: null },
  { name: 'Plyometric Push-up',             category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['chest','triceps','front_delts'], secondaryMuscles: ['core'],             instructions: 'Explosive push that lifts hands off floor. Clap at top if able. Land softly, absorb immediately. Builds upper body striking power.', videoUrl: 'https://www.youtube.com/watch?v=0pkjOk0EiAk', mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Explosive Pull-up',              category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['lats','biceps'],           secondaryMuscles: ['core','rhomboids'],        instructions: 'Pull explosively, trying to get chest or belly button to bar. Control descent. Builds pulling power for clinch work and throws.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Band Resisted Sprawl',           category: 'mma', equipment: 'none', primaryMuscles: ['hips','glutes','core','hip_flexors'], secondaryMuscles: ['lower_back','quads'], instructions: 'Band around hips attached to wall. Shoot to knees, then sprawl back hard against band resistance. Drills sprawl timing and explosiveness for takedown defense.', videoUrl: null, mediaUrl: null, defaultSets: 4, defaultReps: 10, defaultDuration: null },
  { name: 'Battle Ropes',                   category: 'conditioning', equipment: 'none', primaryMuscles: ['shoulders','core','forearms'], secondaryMuscles: ['legs','back'],          instructions: '30–45s alternating waves, slams, or circles. Keep core tight, knees soft. Anaerobic conditioning similar to fight pace. Great finisher.', videoUrl: null, mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 30 },
  { name: 'Jump Rope — Double Unders',      category: 'conditioning', equipment: 'none', primaryMuscles: ['calves','shoulders','core'], secondaryMuscles: ['forearms','quads'],       instructions: 'Jump higher, spin rope twice per jump. Requires timing and wrist speed. Builds explosive calf pop and timing rhythm. Progress from singles first.', videoUrl: null, mediaUrl: null, defaultSets: 5, defaultReps: 20, defaultDuration: null },
  { name: 'Wall Walks',                     category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['shoulders','core','upper_back'], secondaryMuscles: ['triceps','glutes'],  instructions: 'From plank, walk feet up wall while walking hands to wall. Get as vertical as possible. Walk back down. Builds shoulder stability and anti-compression strength.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Sandbag Carry',                  category: 'conditioning', equipment: 'none', primaryMuscles: ['traps','core','quads'],       secondaryMuscles: ['glutes','forearms'],       instructions: 'Bear hug sandbag to chest or carry on shoulder. Walk for distance or time. Mimics clinch carrying and takedown resistance. Full-body grip strength.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 60 },

  // ── JOINT RECOVERY — WRISTS & ELBOWS ────────────────────────────────────────
  { name: 'Wrist CARS',                     category: 'recovery', equipment: 'none', primaryMuscles: ['wrists','forearms'],          secondaryMuscles: [],                          instructions: 'Controlled Articular Rotation of the wrist. Draw the biggest circle possible in each direction. Essential daily maintenance for BJJ athletes from heavy grip load.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Wrist Flexor Stretch',           category: 'recovery', equipment: 'none', primaryMuscles: ['forearms','wrists'],          secondaryMuscles: [],                          instructions: 'Extend arm, palm up, pull fingers back gently with other hand. Hold 30s. Repeat on palm-down side. Essential after heavy gi gripping.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Pronation/Supination Circles',   category: 'recovery', equipment: 'none', primaryMuscles: ['forearms','wrists'],          secondaryMuscles: ['biceps','elbow'],          instructions: 'Elbow bent 90°. Rotate forearm fully palm up, then palm down. Control throughout. A slow forearm rotation drill; keep it easy and pain-free.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Elbow Flexion/Extension',        category: 'recovery', equipment: 'none', primaryMuscles: ['elbow','biceps','triceps'],   secondaryMuscles: [],                          instructions: 'Slowly flex elbow to full range, then slowly extend. Do not hyperextend. A gentle range-of-motion drill; stop short of pain. If the elbow is sore after a joint lock, rest it and have it looked at.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Finger Extension Stretch',       category: 'recovery', equipment: 'none', primaryMuscles: ['forearms','fingers'],         secondaryMuscles: [],                          instructions: 'Spread fingers wide, hold 5s, make fist, hold 5s. Alternate. Finger extensors are ignored — strengthening them balances heavy BJJ grip work.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },

  // ── JOINT RECOVERY — KNEES & ANKLES ─────────────────────────────────────────
  { name: 'Knee CARS',                      category: 'recovery', equipment: 'none', primaryMuscles: ['knees','quads','hamstrings'], secondaryMuscles: ['hips'],                  instructions: 'Stand on one leg, raise opposite knee and draw controlled circles engaging knee flexion and extension. Maintain balance. Daily joint maintenance — especially important after heavy drilling.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Terminal Knee Extension (TKE)',   category: 'recovery', equipment: 'none', primaryMuscles: ['quads','knees'],              secondaryMuscles: ['calves'],                  instructions: 'Band behind knee, slight bend, extend fully squeezing quad. Trains the quads through the last part of knee extension. Stop if the knee hurts.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Ankle CARS',                     category: 'recovery', equipment: 'none', primaryMuscles: ['ankles','calves'],            secondaryMuscles: [],                          instructions: 'Seated, leg extended. Draw the biggest circle possible with your foot. Slow, deliberate. Both directions. Massive ankle mobility for kicks, pivots, and guard.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Banded Ankle Dorsiflexion',      category: 'recovery', equipment: 'none', primaryMuscles: ['ankles','calves','shins'],    secondaryMuscles: [],                          instructions: 'Band around ankle, drive knee forward over toes while heel stays flat. Key ankle mobility for low kicks, checking kicks, and squatting depth.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Calf Foam Roll',                 category: 'recovery', equipment: 'none', primaryMuscles: ['calves'],                     secondaryMuscles: ['achilles'],                instructions: 'Roll from ankle to behind knee. Cross one leg over for added pressure. Stop on tight spots for 5 breath cycles. Important after high kick volume.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'ITB Foam Roll',                  category: 'recovery', equipment: 'none', primaryMuscles: ['it_band','quads'],            secondaryMuscles: ['glutes'],                  instructions: 'Side-lying on roller on outer thigh. Roll from hip to just above knee. This works on the muscles around the band, not the band itself, so keep the pressure moderate and stay off the knee joint. Stop on hot spots.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },

  // ── NECK & SPINE RECOVERY ────────────────────────────────────────────────────
  { name: 'Cervical Spine CARS',            category: 'recovery', equipment: 'none', primaryMuscles: ['neck'],                       secondaryMuscles: ['traps','upper_back'],      instructions: 'Slow head circles through a comfortable range at each point: flex chin to chest, rotate to side, extend backward, other side. Never rush. Keep the range small and easy; stop if you feel dizzy, a pinch, or tingling in the arms.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 3, defaultDuration: null },
  { name: 'Upper Trap Stretch',             category: 'recovery', equipment: 'none', primaryMuscles: ['traps','neck'],               secondaryMuscles: [],                          instructions: 'Pull head to side with hand, tilt ear toward shoulder. Other hand behind back or pressing down. Hold 30–45s each side. Easy neck stretch; do not pull hard on the head.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Levator Scapulae Stretch',       category: 'recovery', equipment: 'none', primaryMuscles: ['neck','upper_back'],          secondaryMuscles: ['traps'],                   instructions: 'Turn head 45° toward armpit, then tilt down. Hand on back of head for gentle pressure. Targets muscle connecting neck to shoulder blade — often tight in grapplers.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Chin Tuck',                      category: 'recovery', equipment: 'none', primaryMuscles: ['neck','upper_back'],          secondaryMuscles: [],                          instructions: 'Gently pull chin straight back (not down). Hold 5s, repeat 10x. Small, gentle movement; you feel it at the back of the neck. Use it throughout the day.', videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Lumbar Decompression Hang',      category: 'recovery', equipment: 'bodyweight', primaryMuscles: ['lower_back','lats'],      secondaryMuscles: ['shoulders'],              instructions: 'Dead hang from pull-up bar, feet slightly off floor. Relax everything below shoulders. Breathe slowly. You feel it in the arms, shoulders and back. Start with short hangs of 10-20s, step down before your grip fails, and stop if the shoulders or back hurt.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Scorpion Stretch',               category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine','hip_flexors','chest'], secondaryMuscles: ['shoulders','hips'], instructions: 'Lie face down, swing one leg over to opposite side reaching for the ground. Arms out flat. Rotational stretch for the upper back and hip flexors. Go slowly in a small range and stop if the lower back pinches.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  // Static holds added for the body map: muscles/joints that had no stretch, or only a drill
  { name: "Cobra Stretch", category: 'recovery', equipment: 'none', primaryMuscles: ['abs'], secondaryMuscles: ['hip_flexors','chest'], instructions: "Lie face down, hands under shoulders. Press the chest up, keeping hips on the floor, until you feel a stretch along the front of the abdomen. Breathe slowly; stop short of any pinch in the lower back. Hold 30s.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: "Standing Side Bend Stretch", category: 'recovery', equipment: 'none', primaryMuscles: ['obliques','lats'], secondaryMuscles: ['lower_back'], instructions: "Stand tall, one arm overhead. Lean sideways from the waist without twisting or leaning forward, reaching over the top. Hold 30s each side.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: "Seated Spinal Twist", category: 'recovery', equipment: 'none', primaryMuscles: ['obliques','lower_back'], secondaryMuscles: ['glutes','thoracic_spine'], instructions: "Sit with legs extended, cross one foot over the opposite knee. Hug the knee with the opposite elbow and rotate toward the bent knee, sitting tall. Hold 30s each side.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  // Massage-ball work (one for each kind of ball, so routines can name a tool). The catalogue rules in
  // content/equipment/catalogue.json say which ball each needs and what to do without it.
  { name: 'Spiky Ball Foot Roll', category: 'recovery', equipment: 'none', primaryMuscles: ['calves','ankles'], secondaryMuscles: [], instructions: "Stand or sit with one foot on the spiky ball, holding a wall or chair for balance if you like. Roll the sole slowly forward and back with light pressure, then switch feet. Keep the pressure comfortable and the rolling slow.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Peanut Ball Upper Back Release', category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine','traps'], secondaryMuscles: ['lats'], instructions: "Lie on your back with the peanut ball across the upper back so the spine sits in the groove between the two balls, one ball on each side of it, never on the spine itself. Bend the knees, cross the arms over the chest, lift the hips a little and roll slowly up and down the upper back. Stay in the upper back; skip the neck and the lower back.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Lacrosse Ball Glute Release', category: 'recovery', equipment: 'none', primaryMuscles: ['glutes','piriformis'], secondaryMuscles: [], instructions: "Sit on the floor with the lacrosse ball under the fleshy part of one buttock and your hands behind you for support. Cross that ankle over the opposite knee if it is comfortable, then shift your weight slowly until you find a tight spot, and stay there and breathe. Keep the ball on muscle, off the tailbone, the hip bone and the back of the thigh. Switch sides.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Lacrosse Ball Chest and Shoulder Release', category: 'recovery', equipment: 'none', primaryMuscles: ['chest','front_delts'], secondaryMuscles: ['rear_delts'], instructions: "Stand facing a wall with the lacrosse ball between the wall and the meaty part of your chest, just below the collarbone and toward the shoulder. Lean in gently and make small slow movements. Stay on muscle: keep the ball off the collarbone, the armpit and the front of the neck. Switch sides.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: "Wall Biceps Stretch", category: 'recovery', equipment: 'none', primaryMuscles: ['biceps'], secondaryMuscles: ['chest','front_delts'], instructions: "Stand side-on to a wall, palm flat on it at shoulder height, fingers pointing back. Slowly turn the body away until you feel the front of the upper arm stretch. Hold 30s each side.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: "Overhead Triceps Stretch", category: 'recovery', equipment: 'none', primaryMuscles: ['triceps'], secondaryMuscles: ['lats','rear_delts'], instructions: "Raise one arm, bend the elbow and drop the hand behind the head. Use the other hand to ease the elbow back and slightly in. Hold 30s each side.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: "Supine Hamstring Stretch", category: 'recovery', equipment: 'none', primaryMuscles: ['hamstrings'], secondaryMuscles: ['calves'], instructions: "Lie on your back, loop a strap or towel around one foot and raise the straight leg until the back of the thigh stretches. Keep the other leg flat and the lower back relaxed. Hold 30s each side.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: "Standing Calf Stretch (Wall)", category: 'recovery', equipment: 'none', primaryMuscles: ['calves'], secondaryMuscles: ['hamstrings'], instructions: "Hands on a wall, one foot back with the heel down and the knee straight. Lean in until the calf stretches. Hold 30s each side.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: "Wall Calf Stretch (Bent Knee)", category: 'recovery', equipment: 'none', primaryMuscles: ['calves'], secondaryMuscles: ['ankles'], instructions: "Same position as the wall calf stretch, then soften the back knee while keeping the heel down to reach the deeper soleus. Hold 30s each side.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: "Standing Quad Stretch", category: 'recovery', equipment: 'none', primaryMuscles: ['quads'], secondaryMuscles: ['hip_flexors'], instructions: "Stand holding a wall for balance. Bend one knee and hold the ankle behind you, knees together, tucking the pelvis slightly. Hold 30s each side.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: "Behind-the-Back Chest Opener", category: 'recovery', equipment: 'none', primaryMuscles: ['chest','front_delts'], secondaryMuscles: ['biceps'], instructions: "Stand tall, clasp the hands behind the back (or hold a towel), straighten the arms and lift them slightly while opening the chest. Hold 30s.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: "Standing Crossover IT Band Stretch", category: 'recovery', equipment: 'none', primaryMuscles: ['it_band'], secondaryMuscles: ['glutes','quads'], instructions: "Stand with one leg crossed behind the other, lean the hips toward the side of the rear leg and reach the same-side arm overhead. Hold 30s each side.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: "Downward Dog", category: 'recovery', equipment: 'none', primaryMuscles: ['hamstrings','calves'], secondaryMuscles: ['shoulders','lats'], instructions: "From hands and knees, lift the hips up and back into an inverted V. Press the floor away, heels reaching down, spine long. Hold 30s.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  // ── Stretches & mobility added 2026-10-26 ──
  { name: 'Seated Straddle Stretch (Pancake)', category: 'recovery', equipment: 'none', primaryMuscles: ['adductors','hamstrings'], secondaryMuscles: ['lower_back','glutes'], instructions: "Sit with the legs as wide as is comfortable, knees and toes pointing at the ceiling. Sit up tall (on a folded towel if the low back rounds), then hinge forward from the hips with a long spine, walking the hands out along the floor. Stop at the first strong stretch along the inner thighs and breathe there; do not force the knees to roll in. Hold 45-60s.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Prone Quad Stretch', category: 'recovery', equipment: 'none', primaryMuscles: ['quads'], secondaryMuscles: ['hip_flexors'], instructions: "Lie face down. Bend one knee and draw the heel toward the glute, holding the ankle or a strap looped around it. Keep both hip bones pressed into the floor and the knees close together; if the hip lifts or the low back arches, ease off. Hold 30-45s each side.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'PNF Hamstring Contract-Relax', category: 'recovery', equipment: 'none', primaryMuscles: ['hamstrings'], secondaryMuscles: ['calves'], instructions: "Lie on your back with a strap around one foot. Raise the straight leg to a first stretch. Contract: press the heel down into the strap at about 30% effort for 6s while the leg barely moves. Relax, breathe out, and draw the leg a little higher; hold 20-30s. Repeat 3 rounds per leg. Keep the other leg flat and the knee of the working leg straight.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 30 },
  { name: '90/90 Breathing', category: 'recovery', equipment: 'none', primaryMuscles: ['abs','lower_back'], secondaryMuscles: ['hip_flexors','hamstrings'], instructions: "Lie on your back with the feet flat on a wall, hips and knees at 90 degrees. Press the heels lightly into the wall and tuck the pelvis until the low back rests on the floor. One hand on the belly, one on the lower ribs. Breathe in through the nose into the belly and sides, then breathe out fully through the mouth, letting the ribs drop. Pause 3-4s at the end of each exhale. 5 slow breaths per set.", videoUrl: null, mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Supported Bridge (Block Under Hips)', category: 'recovery', equipment: 'none', primaryMuscles: ['hip_flexors','lower_back'], secondaryMuscles: ['quads'], instructions: "Lie on your back, knees bent and feet flat. Lift the hips and slide a yoga block (or a firm cushion) under the sacrum, the flat bone at the base of the spine, not the low back. Let the hips go heavy on it, arms relaxed. To deepen, straighten one leg along the floor. Hold 60-90s, then lift the hips to remove the block.", videoUrl: null, mediaUrl: null, defaultSets: 1, defaultReps: null, defaultDuration: 90 },
  { name: 'Sphinx Pose', category: 'recovery', equipment: 'none', primaryMuscles: ['abs','lower_back'], secondaryMuscles: ['hip_flexors','chest'], instructions: "Lie face down and prop up on the forearms, elbows under the shoulders, forearms parallel. Let the hips and legs stay heavy on the floor and draw the chest forward and up, shoulders away from the ears. A gentler extension than the cobra; stop short of any pinch in the low back. Hold 30-60s.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Puppy Pose', category: 'recovery', equipment: 'none', primaryMuscles: ['lats','thoracic_spine'], secondaryMuscles: ['shoulders','triceps'], instructions: "From hands and knees, walk the hands forward while keeping the hips stacked over the knees. Let the chest sink toward the floor with the arms long and the forehead resting down. Press the palms lightly into the floor and reach the hips back without sitting onto the heels. Hold 30-60s.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Side Lunge Adductor Stretch', category: 'recovery', equipment: 'none', primaryMuscles: ['adductors'], secondaryMuscles: ['hamstrings','glutes'], instructions: "Stand with the feet wide, toes slightly out. Shift the hips back and over one foot, bending that knee in line with the toes, and keep the other leg straight with the whole foot on the floor. Chest up, both heels down. Feel it along the inside of the straight leg. Hold 30s each side, or rock slowly side to side.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Kneeling Bench Lat Stretch', category: 'recovery', equipment: 'none', primaryMuscles: ['lats','triceps'], secondaryMuscles: ['thoracic_spine','shoulders'], instructions: "Kneel facing a bench, elbows on its edge shoulder-width apart, palms together behind the head (or holding a stick). Sit the hips back toward the heels and let the head and chest sink below the arms, ribs down and back flat rather than arched. Breathe into the sides of the ribcage. Hold 30-45s.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Legs Up the Wall', category: 'recovery', equipment: 'none', primaryMuscles: ['hamstrings','lower_back'], secondaryMuscles: ['calves'], instructions: "Sit side-on to a wall, then swing the legs up it as you lie back, seat as close to the wall as is comfortable. Let the legs rest straight and relaxed, arms by the sides or on the belly. Breathe slowly. Useful after hard sessions and before sleep. Stay 3-5 min.", videoUrl: null, mediaUrl: null, defaultSets: 1, defaultReps: null, defaultDuration: 240 },
  { name: 'Adductor Rock-Back', category: 'recovery', equipment: 'none', primaryMuscles: ['adductors'], secondaryMuscles: ['hamstrings','glutes'], instructions: "On hands and knees, straighten one leg out to the side with the foot flat and in line with the kneeling knee. Keeping the back flat, rock the hips back toward the kneeling heel until the inner thigh of the straight leg stretches, pause, then rock forward. 8-10 slow reps each side.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Shin Box Get-Up', category: 'recovery', equipment: 'none', primaryMuscles: ['glutes','hip_flexors'], secondaryMuscles: ['adductors','abs'], instructions: "Sit in a shin box (90/90): front shin across the body, back leg out to the side with the knee bent. Sit tall, then drive the hips up and forward over the front knee to a tall kneel and squeeze the glutes. Lower back down under control. Use the hands only if needed. 5 each side, then switch the legs.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Kneeling Shin Stretch', category: 'recovery', equipment: 'none', primaryMuscles: ['calves'], secondaryMuscles: ['quads','ankles'], instructions: "Kneel with the tops of the feet flat on the floor, toes pointing straight back, and sit back toward the heels. To go deeper, place the hands on the floor behind you and lift the knees a little. Feel it along the front of the shins and ankles. Use a folded towel under the ankles if needed. Hold 30-45s.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Thomas Stretch (Bench)', category: 'recovery', equipment: 'none', primaryMuscles: ['hip_flexors','quads'], secondaryMuscles: ['lower_back'], instructions: "Sit on the end of a bench and lie back, hugging one knee to the chest so the low back flattens onto the bench. Let the other leg hang off the end, knee bent, and relax it so the thigh drops below the bench. The stretch is at the front of the hanging hip. Hold 30-60s each side; come up by bringing both knees to the chest first.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Squat to Stand', category: 'recovery', equipment: 'none', primaryMuscles: ['hamstrings','adductors'], secondaryMuscles: ['glutes','lower_back','ankles'], instructions: "Stand with the feet shoulder-width apart. Fold forward with soft knees and grab the toes. Holding on, drop the hips into a deep squat, chest up and elbows pressing the knees out. Then straighten the legs as far as you can while still holding the toes. Let go, roll up to standing and reach overhead. 6-8 slow reps.", videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  // ── variety audit (step 3): soft tissue, neck, wrists, knees, feet, grip, balance, conditioning, breathing ──
  { name: 'Lacrosse Ball Hamstring Roll', category: 'recovery', equipment: 'none', primaryMuscles: ['hamstrings'], secondaryMuscles: ['glutes'], instructions: "Sit on the floor with one leg straight and the lacrosse ball under the back of that thigh, hands behind you for support. Lift the hips a little and roll slowly along the thigh between the sit bone and the back of the knee, then switch legs. Start with light pressure and keep breathing normally. Keep it off the sit bone and the back of the knee. Starting point: about 45 seconds each leg.", videoUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Lacrosse Ball Quad Roll', category: 'recovery', equipment: 'none', primaryMuscles: ['quads'], secondaryMuscles: ['hip_flexors'], instructions: "Lie face down, propped on the forearms, with the lacrosse ball under the front of one thigh. Shift the weight slowly to roll between the hip and just above the kneecap, then switch legs. Start with light pressure and keep breathing normally. Keep it off the kneecap and the hip bone. Starting point: about 45 seconds each leg.", videoUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Lacrosse Ball Calf Roll', category: 'recovery', equipment: 'none', primaryMuscles: ['calves'], secondaryMuscles: [], instructions: "Sit on the floor with one calf resting on the lacrosse ball and the hands behind you. Lift the hips so some weight sits on the ball and roll slowly from below the back of the knee to above the ankle, then switch legs. Start with light pressure. Keep it off the back of the knee and the Achilles tendon just above the heel. Starting point: about 45 seconds each leg.", videoUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Lacrosse Ball Forearm Roll', category: 'recovery', equipment: 'none', primaryMuscles: ['forearms'], secondaryMuscles: ['wrists'], instructions: "Rest one forearm, palm up, on a table or counter with the lacrosse ball under the fleshy part of it. Press down lightly with the other hand and roll slowly between the wrist and the elbow, then turn the palm down and repeat. Keep the pressure light. Keep it off the wrist crease and the bony point of the elbow, and ease off if the hand tingles or goes numb. Starting point: about 30 seconds each forearm.", videoUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Lacrosse Ball Upper Trap Wall Roll', category: 'recovery', equipment: 'none', primaryMuscles: ['traps'], secondaryMuscles: ['neck'], instructions: "Stand with the lacrosse ball between the top of one shoulder (the muscle between the neck and the point of the shoulder) and a wall. Lean in lightly and make small, slow movements, then switch sides. Keep it off the neck, the spine and the bony point of the shoulder. Starting point: about 30 seconds each side.", videoUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Lacrosse Ball Lat Wall Roll', category: 'recovery', equipment: 'none', primaryMuscles: ['lats'], secondaryMuscles: ['rear_delts'], instructions: "Stand side-on to a wall with the arm on that side raised overhead. Place the lacrosse ball between the wall and the muscle at the side of your back, just behind the armpit. Lean in lightly and bend and straighten the knees to roll slowly down the side of the back, then switch sides. Keep it off the spine and out of the armpit. Starting point: about 30 seconds each side.", videoUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Lacrosse Ball Foot Roll', category: 'recovery', equipment: 'none', primaryMuscles: ['ankles'], secondaryMuscles: ['calves'], instructions: "Stand or sit with one foot on the lacrosse ball, holding a wall or chair for balance if you like. Roll the sole slowly forward and back with light pressure, then switch feet. Keep the pressure comfortable and stay off the toes. Starting point: about 45 seconds each foot.", videoUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Supine Chin Tuck', category: 'recovery', equipment: 'none', primaryMuscles: ['neck'], secondaryMuscles: ['upper_back'], instructions: "Lie on your back with knees bent and the head resting on the floor or a thin folded towel. Gently nod, drawing the chin toward the throat as if making a small double chin, without lifting the head off the floor. Hold about 3 seconds, then relax. Keep it small and gentle. Starting point: 2 sets of 8. Stop for dizziness, sharp pain or tingling in the arms.", videoUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Neck Rotation Turns', category: 'recovery', equipment: 'none', primaryMuscles: ['neck'], secondaryMuscles: ['traps'], instructions: "Sit or stand tall with the shoulders relaxed. Slowly turn the head to look over one shoulder, only as far as is comfortable, pause briefly, then turn to the other side. Keep the chin level and the movement slow. Starting point: 2 sets of 5 each way. Do not push the end of the range. Stop for dizziness, sharp pain or tingling in the arms.", videoUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Neck Isometric Side Press', category: 'recovery', equipment: 'none', primaryMuscles: ['neck'], secondaryMuscles: ['traps'], instructions: "Sit tall and place the palm against the side of the head just above the ear. Press the head gently into the hand without letting it move, hold about 5 seconds, then relax. Use a gentle effort, well short of your hardest, and do both sides. Starting point: 2 holds each side. Stop for dizziness, sharp pain or tingling in the arms.", videoUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 5 },
  { name: 'Wrist Extensor Stretch', category: 'recovery', equipment: 'none', primaryMuscles: ['forearms'], secondaryMuscles: ['wrists'], instructions: "Hold one arm out in front with the elbow straight and the palm facing down. With the other hand, gently press the back of the hand down and toward you so the fingers point to the floor. Hold about 20 to 30 seconds and feel it along the top of the forearm, then switch arms. Ease off if the wrist or elbow hurts or the fingers tingle. Starting point: 2 holds each arm.", videoUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Band Wrist Curl', category: 'strength', equipment: 'none', primaryMuscles: ['forearms'], secondaryMuscles: ['wrists'], instructions: "Sit with the forearm resting on the thigh, palm up, and the hand just past the knee. Hold one end of a light band and trap the other end under the foot. Curl the palm up toward you, then lower slowly over about 3 seconds. Use a light band and a small range at first; loaded wrists adapt slowly. Starting point: 2 sets of 12 each arm. Stop if the wrist or elbow hurts.", videoUrl: null, defaultSets: 2, defaultReps: 12, defaultDuration: null },
  { name: 'Band Reverse Wrist Curl', category: 'strength', equipment: 'none', primaryMuscles: ['forearms'], secondaryMuscles: ['wrists'], instructions: "Sit with the forearm resting on the thigh, palm down, and the hand just past the knee. Hold one end of a light band and trap the other end under the foot. Lift the back of the hand up, then lower slowly over about 3 seconds. Use a light band and a small range at first; loaded wrists adapt slowly. Starting point: 2 sets of 12 each arm. Stop if the wrist or elbow hurts.", videoUrl: null, defaultSets: 2, defaultReps: 12, defaultDuration: null },
  { name: 'Quadruped Wrist Rocks', category: 'recovery', equipment: 'none', primaryMuscles: ['wrists'], secondaryMuscles: ['forearms'], instructions: "On hands and knees on a mat, hands under the shoulders with the fingers pointing forward. Gently rock the shoulders forward and back over the hands, palms flat, in a small range. Then turn the fingers out to the sides and repeat. Your wrists carry body weight here, so go slowly, keep the range small, and sit back toward the heels if they complain. Starting point: 8 rocks in each position. Skip it on a day the wrists are sore.", videoUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Spanish Squat', category: 'strength', equipment: 'none', primaryMuscles: ['quads'], secondaryMuscles: ['glutes'], instructions: "Anchor a resistance band around a sturdy upright, such as the tower, at about knee height. Face it, loop the band behind both knees and step back until the band is tight. Sit back and down with the chest fairly upright and the shins staying close to vertical, lower to a comfortable depth, then stand. Check the anchor is solid and the band is in good condition before leaning on it. Starting point: 2 sets of 8 at a shallow depth. Stop if the knees hurt.", videoUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Wall Sit', category: 'strength', equipment: 'none', primaryMuscles: ['quads'], secondaryMuscles: ['glutes'], instructions: "Stand with your back against a wall, walk the feet forward and slide down into a shallow squat, thighs well above parallel, knees over the ankles. Keep the back against the wall and breathe. Starting point: 2 holds of 20 seconds. Come up if the front of the knee hurts.", videoUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 20 },
  { name: 'Tempo Bodyweight Squat', category: 'strength', equipment: 'none', primaryMuscles: ['quads','glutes'], secondaryMuscles: ['hamstrings'], instructions: "Stand shoulder-width apart, toes slightly out. Lower over about 3 seconds to a depth that stays comfortable, pause briefly, then stand. Knees track over the toes and the heels stay down. Starting point: 2 sets of 8. Cut the depth if the knees hurt.", videoUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Tibialis Raise (Wall)', category: 'strength', equipment: 'none', primaryMuscles: ['shins'], secondaryMuscles: ['ankles'], instructions: "Lean back against a wall with the heels about a foot from it and the knees nearly straight, not locked. Keeping the heels on the floor, lift the toes and front of the feet toward the shins, pause briefly, then lower slowly. You should feel the front of the shins working. Starting point: 2 sets of 12. Stop if the shins hurt sharply.", videoUrl: null, defaultSets: 2, defaultReps: 12, defaultDuration: null },
  { name: 'Ankle Alphabet', category: 'recovery', equipment: 'none', primaryMuscles: ['ankles'], secondaryMuscles: ['calves'], instructions: "Sit with one leg out so the foot is off the floor. Use the big toe as a pen and trace the letters A to Z in the air, moving mainly from the ankle and keeping the leg still. Keep the letters small and slow, then switch feet. Starting point: one pass each foot.", videoUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Toe Yoga', category: 'recovery', equipment: 'none', primaryMuscles: ['ankles'], secondaryMuscles: ['calves'], instructions: "Stand barefoot with both feet flat. Lift only the big toe while pressing the other four toes down, then press the big toe down and lift the other four. Alternate slowly. It is fiddly at first; if the toes cramp, rest. Starting point: 2 sets of 8.", videoUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Short Foot Exercise', category: 'recovery', equipment: 'none', primaryMuscles: ['ankles'], secondaryMuscles: ['calves'], instructions: "Stand or sit with the foot flat. Without curling the toes, draw the ball of the foot toward the heel so the arch lifts slightly, keeping the big toe, little toe and heel pressed down. Hold about 5 seconds, then relax. Starting point: 2 sets of 8 each foot.", videoUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Banded Ankle Eversion', category: 'recovery', equipment: 'none', primaryMuscles: ['ankles'], secondaryMuscles: ['calves'], instructions: "Sit with the legs out and loop a light band around the front of one foot, with the other end anchored on the inner side so the band pulls the foot inward. Turn the sole of the foot outward against the band, then return slowly. Keep the leg still so the movement comes from the ankle. Starting point: 2 sets of 12 each foot.", videoUrl: null, defaultSets: 2, defaultReps: 12, defaultDuration: null },
  { name: 'Scapular Pull-up', category: 'strength', equipment: 'none', primaryMuscles: ['lats'], secondaryMuscles: ['traps','forearms'], instructions: "Hang from the bar with straight arms. Without bending the elbows, pull the shoulder blades down so the body rises a short way, then let them rise slowly back into the hang. It is a small movement from the shoulders. Starting point: 2 sets of 6. Step down if the grip slips.", videoUrl: null, defaultSets: 2, defaultReps: 6, defaultDuration: null },
  { name: 'Towel Hang', category: 'strength', equipment: 'none', primaryMuscles: ['forearms'], secondaryMuscles: ['lats'], instructions: "Drape a small towel over the bar and hold an end in each hand. Hang with straight arms and the shoulders gently pulled down; this asks more of the grip than the bare bar. Check the towel is secure and the floor below is clear. Starting point: 2 holds of 10 seconds. Step down before the grip gives out.", videoUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 10 },
  { name: 'Flexed-Arm Hang', category: 'strength', equipment: 'none', primaryMuscles: ['lats','biceps'], secondaryMuscles: ['forearms'], instructions: "Step or jump up so the chin is above the bar with the elbows bent, then hold that position with the shoulders pulled down. Lower slowly when you start to lose it, and step down rather than drop. Starting point: 2 holds of 5 seconds. Skip it if the shoulders or elbows are sore.", videoUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 5 },
  { name: 'Single-Leg Stand', category: 'recovery', equipment: 'none', primaryMuscles: ['ankles'], secondaryMuscles: ['glutes'], instructions: "Stand near a wall with a hand ready to touch it. Shift the weight onto one foot, lift the other a few inches and stand tall, looking at a spot on the wall. Hold, then switch. Starting point: 2 holds of 20 seconds each side.", videoUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 20 },
  { name: 'Single-Leg Reach', category: 'recovery', equipment: 'none', primaryMuscles: ['ankles'], secondaryMuscles: ['glutes','hamstrings'], instructions: "Stand on one leg near a wall, standing knee soft. Reach the free foot slowly forward, to the side and behind you, tapping the floor lightly each time without putting weight on it, and return to centre between reaches. Starting point: 2 rounds of 3 reaches each way on each leg.", videoUrl: null, defaultSets: 2, defaultReps: 3, defaultDuration: null },
  { name: 'Single-Leg RDL (Bodyweight)', category: 'strength', equipment: 'none', primaryMuscles: ['hamstrings','glutes'], secondaryMuscles: ['lower_back'], instructions: "Stand on one leg near a wall, the knee slightly bent. Hinge at the hip, reaching the free leg back and the chest forward in one line, only as far as you can keep the back flat and the hips level, then stand tall. Touch the wall if you wobble. Starting point: 2 sets of 6 each leg.", videoUrl: null, defaultSets: 2, defaultReps: 6, defaultDuration: null },
  { name: 'Heel-to-Toe Walk', category: 'recovery', equipment: 'none', primaryMuscles: ['ankles'], secondaryMuscles: ['calves'], instructions: "Walk in a straight line placing the heel of one foot directly in front of the toes of the other, looking ahead, with a wall or clear lane within reach. Arms out to the sides if it helps. Starting point: 2 passes of 10 steps.", videoUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Jump Rope: Room Intervals', category: 'conditioning', equipment: 'none', primaryMuscles: ['calves','cardio'], secondaryMuscles: ['shoulders','forearms'], instructions: "Short rounds with a rope turned from the wrists, using small low hops. Before the first round, check the ceiling: you need clear space above your head plus the rope's arc, with no fan or light in the way. A weighted rope turns slower and works the shoulders and grip harder, so keep the elbows close and the rounds short. Starting point: 6 rounds of 30 seconds on, 30 seconds off. If the space is tight, make the hops smaller or skip the rope.", videoUrl: null, defaultSets: 6, defaultReps: null, defaultDuration: 30 },
  { name: 'Jump Rope: Boxer Skip', category: 'conditioning', equipment: 'none', primaryMuscles: ['calves','cardio'], secondaryMuscles: ['shoulders'], instructions: "Hop from one foot to the other in a relaxed rhythm, as if jogging in place, with the rope passing under every hop. Stay on the balls of the feet and keep the hops small and quiet. Same ceiling check as any rope work. Starting point: 6 rounds of 30 seconds with 30 seconds rest.", videoUrl: null, defaultSets: 6, defaultReps: null, defaultDuration: 30 },
  { name: 'Box Breathing', category: 'recovery', equipment: 'none', primaryMuscles: ['abs'], secondaryMuscles: ['lower_back'], instructions: "Sit or lie comfortably. Breathe in through the nose for a count of 4, hold for 4, breathe out slowly for 4, hold for 4. That is one round. Many people find slow, even breathing calming. If the holds feel uncomfortable or you feel lightheaded, shorten the counts or drop the holds and just breathe normally. Starting point: 4 rounds.", videoUrl: null, defaultSets: 4, defaultReps: null, defaultDuration: 16 },
  { name: 'Extended Exhale Breathing', category: 'recovery', equipment: 'none', primaryMuscles: ['abs'], secondaryMuscles: ['lower_back'], instructions: "Sit or lie comfortably. Breathe in through the nose for a count of 4, then out slowly through the nose or pursed lips for a count of 6. Keep it easy, never strained; shorten the counts if it feels like effort. Many people find a longer exhale calming. Starting point: 2 minutes.", videoUrl: null, defaultSets: 1, defaultReps: null, defaultDuration: 120 },
  { name: 'Belly Breathing (Lying)', category: 'recovery', equipment: 'none', primaryMuscles: ['abs'], secondaryMuscles: ['lower_back'], instructions: "Lie on your back with the knees bent, one hand on the chest and one on the belly. Breathe in slowly through the nose so the belly hand rises more than the chest hand, then breathe out slowly. Keep the shoulders and jaw loose. Starting point: 2 minutes of easy breaths.", videoUrl: null, defaultSets: 1, defaultReps: null, defaultDuration: 120 },
  { name: 'Progressive Muscle Relaxation', category: 'recovery', equipment: 'none', primaryMuscles: ['abs','lower_back'], secondaryMuscles: ['forearms'], instructions: "Lie or sit comfortably. Working from the feet up to the face, tense one muscle group at a time (feet, calves, thighs, hips, hands, arms, shoulders, face) at a mild effort for about 5 seconds, then let it go completely for 10 to 15 seconds before moving on. Never tense to a cramp, and skip any area that is injured or sore. Many people find it a good way to wind down. Starting point: one slow pass, about 3 to 5 minutes.", videoUrl: null, defaultSets: 1, defaultReps: null, defaultDuration: 300 },
  { name: 'Hip Airplane', category: 'recovery', equipment: 'none', primaryMuscles: ['hips','glutes'], secondaryMuscles: ['hamstrings','obliques'], instructions: 'Stand on one leg with a soft knee and a hand on a wall or rail for balance. Hinge forward until the torso and the lifted back leg are close to level, then rotate the chest and lifted leg open toward the side and back to face the floor, slowly and with the standing foot staying flat. Do all reps on one side, then switch. Keep to a range where the standing knee and hip feel steady.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 6, defaultDuration: null },
  { name: '90/90 Hip Lift-Off', category: 'recovery', equipment: 'none', primaryMuscles: ['hips','glutes'], secondaryMuscles: ['piriformis','adductors'], instructions: 'Sit in a 90/90 position with both knees bent to right angles and the chest tall. Keep the back-leg knee on the floor and lift only that shin and foot a little way off the floor, hold for a few seconds using the hip muscles, then lower. Do all reps on one side, then switch. Sit on a folded towel if it is hard to stay upright.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 6, defaultDuration: null },
  { name: 'Banded Hip Mobilization', category: 'recovery', equipment: 'none', primaryMuscles: ['hips','hip_flexors'], secondaryMuscles: ['glutes','quads'], instructions: 'Anchor a band low behind you, about hip height when kneeling, and loop it around the top of one thigh, in the crease of the hip. Step away until the band is taut and kneel on that leg in half-kneeling with padding under the knee. Tuck the pelvis, squeeze the glute of the kneeling leg and rock gently forward and back; the pull should be at the front of the hip. Do one side, then switch, and start with the lightest band.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Fire Hydrant', category: 'recovery', equipment: 'none', primaryMuscles: ['glutes','hips'], secondaryMuscles: ['abs','obliques'], instructions: 'On hands and knees with hands under the shoulders and knees under the hips, keep the spine still. Lift one bent knee out to the side without letting the pelvis tip or twist, then lower it slowly. Do all reps on one side, then switch.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Clamshell', category: 'recovery', equipment: 'none', primaryMuscles: ['glutes','hips'], secondaryMuscles: ['piriformis'], instructions: 'Lie on one side with the hips and shoulders stacked, knees bent to about a right angle and the ankles slightly behind the body. Keep the feet together and lift the top knee toward the ceiling without rolling the pelvis back, then lower it under control. Do all reps on one side, then switch.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 12, defaultDuration: null },
  { name: 'Front-to-Back Leg Swing', category: 'recovery', equipment: 'none', primaryMuscles: ['hamstrings','hip_flexors','hips'], secondaryMuscles: ['glutes','adductors'], instructions: 'Stand tall beside a wall or rail and swing one leg forward and back like a pendulum, keeping the torso upright and the standing knee soft. Start with small swings and let the range grow on its own, without forcing the end of the swing. Do all reps on one leg, then switch.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Lateral Leg Swing', category: 'recovery', equipment: 'none', primaryMuscles: ['adductors','glutes','hips'], secondaryMuscles: ['hip_flexors'], instructions: 'Stand facing a wall with both hands on it and swing one leg across the body and out to the side, with the torso still and the toes pointing forward. Start small and let the range grow gradually. Do all reps on one leg, then switch.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Low Lunge with Twist', category: 'recovery', equipment: 'none', primaryMuscles: ['hip_flexors','thoracic_spine'], secondaryMuscles: ['glutes','adductors','obliques'], instructions: 'From a low lunge with the back knee on a pad, place the hand on the same side as the back leg on the floor. Rotate the chest toward the front leg and reach the other arm up and back, keeping the front knee over the ankle. Hold, breathe slowly, then switch sides.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Happy Baby', category: 'recovery', equipment: 'none', primaryMuscles: ['adductors','hips'], secondaryMuscles: ['hamstrings','lower_back'], instructions: 'Lie on your back, bring the knees toward the armpits and hold the outsides of the feet or the shins. Let the knees open wider than the torso and gently draw them down while the tailbone and head stay on the floor. Rock slightly side to side if that feels good, and let go of the feet if the neck or back strains.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Windshield Wipers (Lying)', category: 'recovery', equipment: 'none', primaryMuscles: ['hips','obliques'], secondaryMuscles: ['glutes','adductors'], instructions: 'Lie on your back with the knees bent, feet a little wider than the hips and arms out to the sides. Let both knees fall slowly to one side, rotating at the hips, then bring them back up and over to the other side. Keep the shoulders on the floor and move only as far as is comfortable.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Hurdle Step-Over', category: 'recovery', equipment: 'none', primaryMuscles: ['hips','glutes'], secondaryMuscles: ['hip_flexors','adductors'], instructions: 'Stand tall beside a wall or rail and lift one knee up and out to the side as if stepping over a low hurdle behind you. Swing the leg around to the front and set the foot down, keeping the standing leg steady and the torso upright. Do all reps on one leg, then switch.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Walking Knee Hug', category: 'recovery', equipment: 'none', primaryMuscles: ['glutes','hips'], secondaryMuscles: ['hamstrings'], instructions: 'Take a step, lift the other knee and hug it to the chest with both hands while standing tall on the other leg. Let it go and step through into the next hug on the other side. Keep the pace slow enough to stay balanced. One rep is one hug on each side.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Walking Quad Pull', category: 'recovery', equipment: 'none', primaryMuscles: ['quads','hip_flexors'], secondaryMuscles: ['glutes'], instructions: 'Take a step, bend the back knee and hold the foot behind you with the same-side hand, knees close together. Stand tall and gently tuck the pelvis for a moment, then let go and step through to the other side. Keep the pace slow enough to stay balanced, and skip the pull if the knee complains. One rep is one pull on each side.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Half-Kneeling Side Bend', category: 'recovery', equipment: 'none', primaryMuscles: ['obliques','hip_flexors'], secondaryMuscles: ['lats','quads'], instructions: 'Kneel on one knee on a pad with the other foot forward, and squeeze the glute of the kneeling leg. Reach the arm on the kneeling side overhead and lean away from that knee, keeping the ribs down and the hips square. Hold, then switch sides.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Crab Reach', category: 'recovery', equipment: 'none', primaryMuscles: ['glutes','thoracic_spine'], secondaryMuscles: ['hip_flexors','rear_delts','triceps'], instructions: 'Sit with the knees bent and the hands on the floor behind you, then lift the hips into a tabletop. Keep the hips high and reach one arm up and over the head toward the opposite side, turning the chest toward the ceiling. Return the hand to the floor and alternate arms. One rep is one reach on each side.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 6, defaultDuration: null },
  { name: 'Kick Chamber Hold', category: 'recovery', equipment: 'none', primaryMuscles: ['hip_flexors','hips'], secondaryMuscles: ['glutes','adductors','abs'], instructions: 'Stand tall beside a wall or rail and slowly lift one knee up toward the chest, then turn the knee over to the side as if loading a roundhouse kick. Hold for a few seconds with the standing foot pivoting slightly and the torso upright, then lower slowly. Do all reps on one side, then switch.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Quadruped Thoracic Rotation', category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine'], secondaryMuscles: ['obliques','traps'], instructions: 'On hands and knees, place one hand behind the head and sit the hips back slightly toward the heels. Rotate that elbow down toward the opposite wrist, then turn it up toward the ceiling, following it with the eyes. Keep the hips still and move from the upper back. Do all reps on one side, then switch.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Elbows-on-Bench Thoracic Extension', category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine','lats'], secondaryMuscles: ['chest','front_delts'], instructions: 'Kneel in front of a bench or sturdy chair seat and rest the elbows on it, shoulder width apart with the palms together or the hands overhead. Sit the hips back and let the chest drop toward the floor, keeping the ribs down so the stretch stays in the upper back. Hold and breathe slowly. Come out if the shoulders pinch.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Reverse Tabletop', category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine','glutes'], secondaryMuscles: ['front_delts','chest','triceps','hamstrings'], instructions: 'Sit with the knees bent and the hands on the floor behind the hips. Press through the hands and feet to lift into a tabletop, squeezing the glutes instead of arching the low back, and let the chest open toward the ceiling. Hold for a couple of seconds, then lower slowly. Come out if the wrists or shoulders object.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 6, defaultDuration: null },
  { name: 'Scapular Push-up', category: 'recovery', equipment: 'none', primaryMuscles: ['serratus'], secondaryMuscles: ['chest','front_delts','traps'], instructions: 'Start in a high plank, or on the knees, with the arms straight. Keeping the elbows locked, let the chest sink between the shoulder blades, then push the floor away so the upper back rounds slightly and the shoulder blades spread. Move only at the shoulder blades and keep the hips level. Use the knees until the movement feels smooth.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Prone Y-T-W Raise', category: 'recovery', equipment: 'none', primaryMuscles: ['traps','rear_delts'], secondaryMuscles: ['rotator_cuff','lower_back'], instructions: 'Lie face down with the forehead resting on a folded towel. With the thumbs up, lift the arms overhead in a Y and lower them, lift them straight out to the sides in a T and lower them, then bend the elbows and draw them back into a W and lower them. Keep the neck long and lift from the shoulder blades, not by arching the low back. Use no weight to start. One rep is a Y, a T and a W.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 6, defaultDuration: null },
  { name: 'Band Shoulder External Rotation', category: 'recovery', equipment: 'none', primaryMuscles: ['rotator_cuff'], secondaryMuscles: ['rear_delts'], instructions: 'Anchor a light band at about waist height and stand side-on to it, holding the end with the hand nearest the anchor. Tuck a small rolled towel between the elbow and the ribs, with the elbow bent to a right angle. Rotate the forearm outward away from the anchor, then return slowly. Do all reps on one side, then switch.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 12, defaultDuration: null },
  { name: 'Side-Lying Shoulder External Rotation', category: 'recovery', equipment: 'none', primaryMuscles: ['rotator_cuff'], secondaryMuscles: ['rear_delts'], instructions: 'Lie on one side with the top elbow bent to a right angle and tucked against the ribs, the forearm resting across the belly. Keeping the elbow in contact with the body, rotate the forearm up toward the ceiling, then lower it slowly. Start with no weight. Do all reps on one side, then switch.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 12, defaultDuration: null },
  { name: 'Inchworm', category: 'recovery', equipment: 'none', primaryMuscles: ['hamstrings','abs'], secondaryMuscles: ['front_delts','calves','serratus'], instructions: 'Stand tall, hinge forward from the hips with the knees soft and place the hands on the floor. Walk the hands forward to a high plank, keeping the spine flat, then take small steps with the feet toward the hands. Stand up and repeat. Move slowly and bend the knees as much as needed.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: 6, defaultDuration: null },
  { name: 'Standing Hamstring Stretch', category: 'recovery', equipment: 'none', primaryMuscles: ['hamstrings'], secondaryMuscles: ['calves'], instructions: 'Stand and place one heel on a low step or the floor in front of you with the leg straight and the toes up. Hinge forward from the hips with a flat back until you feel the back of the thigh. Hold, breathe slowly, then switch legs.', videoUrl: null, mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
];

// ── Workout templates — seeded once, editable via the health app UI ──────────
// slug format: "daykey:location"  e.g. "mon:home", "mon:gym"
const SEED_WORKOUT_TEMPLATES = [
  // ── HOME / PARK WORKOUTS ────────────────────────────────────────────────────
  { slug: 'mon:home', name: 'Push Day — Mon (Home)', type: 'strength', location: 'home',
    description: 'Chest / Shoulders / Triceps + Core',
    warmup: 'Jump Rope 3 min easy, then 10 arm circles each direction',
    cooldown: 'Chest doorway stretch 60s, Shoulder dislocates 10 reps with band',
    exercises: [
      { exerciseName: 'Push-up Board Wide',              sets: 4, reps: null, repMode: 'max',  duration: null, prKey: 'Wide Push-up',     notes: 'Full range, controlled 2-sec negative' },
      { exerciseName: 'Diamond Push-up',                 sets: 3, reps: null, repMode: 'max',  duration: null, prKey: 'Diamond Push-up',  notes: 'Elbows stay close to body' },
      { exerciseName: 'Pike Push-up',                    sets: 3, reps: 10,   repMode: 'fixed',duration: null, prKey: 'Pike Push-up',     notes: 'Hips high, head to floor' },
      { exerciseName: 'Resistance Band Lateral Raise',   sets: 3, reps: 15,   repMode: 'fixed',duration: null,                            notes: 'Slow, no shrugging' },
      { exerciseName: 'Resistance Band Face Pull',       sets: 3, reps: 20,   repMode: 'fixed',duration: null,                            notes: 'Shoulder health — always do these' },
      { exerciseName: 'Resistance Band Tricep Extension',sets: 3, reps: 15,   repMode: 'fixed',duration: null,                            notes: 'Full lockout' },
      { exerciseName: 'Ab Roller Rollout',               sets: 4, reps: 8,    repMode: 'fixed',duration: null, prKey: 'Ab Roller Rollout',notes: 'From knees. Pull back with lats, not hips' },
      { exerciseName: 'Hollow Body Hold',                sets: 3, reps: null, repMode: 'timed',duration: 30,   prKey: 'Hollow Body Hold', notes: 'Lower back glued to floor' },
    ]},
  { slug: 'tue:home', name: 'Pull + Core — Tue (Home)', type: 'strength', location: 'home',
    description: 'Back / Biceps / Abs',
    warmup: 'Jog to park (cardio warm-up done), 10 scapular pull-ups to activate lats',
    cooldown: 'Lat stretch on pull-up bar 30s each side, Band pull-aparts 20 reps',
    exercises: [
      { exerciseName: 'Pull-up',                         sets: 5, reps: null, repMode: 'max',  duration: null, prKey: 'Pull-up',          notes: 'Dead hang start. Full extension at bottom' },
      { exerciseName: 'Chin-up',                         sets: 3, reps: null, repMode: 'max',  duration: null, prKey: 'Chin-up',          notes: 'Underhand. Curl the bar to you' },
      { exerciseName: 'Resistance Band Row',             sets: 4, reps: 15,   repMode: 'fixed',duration: null,                            notes: 'Squeeze shoulder blades 1s at top' },
      { exerciseName: 'Resistance Band Bicep Curl',      sets: 3, reps: 15,   repMode: 'fixed',duration: null,                            notes: 'Full extension at bottom' },
      { exerciseName: 'Hanging Leg Raise',               sets: 4, reps: 10,   repMode: 'fixed',duration: null, prKey: 'Hanging Leg Raise',notes: 'Hips stay square, no swinging' },
      { exerciseName: 'Ab Roller Rollout',               sets: 3, reps: 10,   repMode: 'fixed',duration: null, prKey: 'Ab Roller Rollout',notes: 'Progress to standing rollouts eventually' },
      { exerciseName: 'Dead Bug',                        sets: 3, reps: 10,   repMode: 'fixed',duration: null,                            notes: '10 per side. Lower back to floor always' },
    ]},
  { slug: 'wed:home', name: 'Legs + Conditioning — Wed (Home)', type: 'conditioning', location: 'home',
    description: 'Legs + Conditioning',
    warmup: 'Jump Rope 3 min, then 10 bodyweight squats slow',
    cooldown: 'Hip flexor stretch 60s each, World\'s greatest stretch 6 reps',
    exercises: [
      { exerciseName: 'Bodyweight Squat',                sets: 4, reps: 20,   repMode: 'fixed',duration: null,                            notes: 'Full depth, drive knees out' },
      { exerciseName: 'Bodyweight Bulgarian Split Squat',sets: 3, reps: 12,   repMode: 'fixed',duration: null,                            notes: '12 per leg. Use chair as rear support' },
      { exerciseName: 'Reverse Lunge',                   sets: 3, reps: 12,   repMode: 'fixed',duration: null,                            notes: '12 per leg. Step back, control the drop' },
      { exerciseName: 'Jump Squat',                      sets: 4, reps: 15,   repMode: 'fixed',duration: null,                            notes: 'Land soft, knees bent. Power output' },
      { exerciseName: 'Calf Raise (bodyweight)',         sets: 4, reps: 25,   repMode: 'fixed',duration: null,                            notes: 'Use a step edge for full range' },
      { exerciseName: 'Weighted Jump Rope',              sets: 5, reps: null, repMode: 'timed',duration: 45,                              notes: '45s on / 15s rest. Conditioning + calves' },
      { exerciseName: 'Ab Roller Rollout',               sets: 3, reps: 10,   repMode: 'fixed',duration: null, prKey: 'Ab Roller Rollout',notes: 'End every session with core' },
      { exerciseName: 'Side Plank',                      sets: 3, reps: null, repMode: 'timed',duration: 30,   prKey: 'Side Plank',       notes: '30s each side. Obliques for the V' },
    ]},
  { slug: 'thu:home', name: 'Core + Active Recovery — Thu (Home)', type: 'strength', location: 'home',
    description: 'Core Focus + Active Recovery',
    warmup: 'Light jump rope 5 min steady pace',
    cooldown: 'Cat-cow 10 reps, Hip flexor / Psoas release 60s each, Thoracic extension over roller',
    exercises: [
      { exerciseName: 'Ab Roller Rollout',               sets: 5, reps: 12,   repMode: 'fixed',duration: null, prKey: 'Ab Roller Rollout',notes: 'Main focus today — more volume' },
      { exerciseName: 'Hollow Body Hold',                sets: 4, reps: null, repMode: 'timed',duration: 30,   prKey: 'Hollow Body Hold', notes: 'Add 5s each week you hit all sets' },
      { exerciseName: 'Lying Leg Raise',                 sets: 4, reps: 15,   repMode: 'fixed',duration: null,                            notes: 'Lower back down, never let it arch' },
      { exerciseName: 'V-Up',                            sets: 3, reps: 15,   repMode: 'fixed',duration: null,                            notes: 'Controlled, feel the crunch' },
      { exerciseName: 'Side Plank',                      sets: 3, reps: null, repMode: 'timed',duration: 40,   prKey: 'Side Plank',       notes: 'Increase by 5s weekly' },
      { exerciseName: 'Dead Bug',                        sets: 3, reps: 10,   repMode: 'fixed',duration: null,                            notes: 'Slow and deliberate' },
      { exerciseName: 'Plank',                           sets: 3, reps: null, repMode: 'timed',duration: 60,   prKey: 'Plank',            notes: 'Squeeze glutes and quads too' },
      { exerciseName: 'Resistance Band Face Pull',       sets: 3, reps: 20,   repMode: 'fixed',duration: null,                            notes: 'Shoulder maintenance — do daily if possible' },
    ]},
  { slug: 'fri:home', name: 'Push Day — Fri (Home)', type: 'strength', location: 'home',
    description: 'Chest / Shoulders / Triceps (progressive)',
    warmup: 'Jump Rope 3 min, then 10 slow push-ups as warm-up sets',
    cooldown: 'Chest doorway stretch, Band pull-aparts 20 reps',
    exercises: [
      { exerciseName: 'Push-up Board Wide',              sets: 4, reps: null, repMode: 'max',  duration: null, prKey: 'Wide Push-up',     notes: 'Beat Monday\'s reps if possible' },
      { exerciseName: 'Push-up Board Narrow',            sets: 3, reps: null, repMode: 'max',  duration: null, prKey: 'Push-up Board Narrow', notes: 'Elbows tight, squeeze triceps at top' },
      { exerciseName: 'Pike Push-up',                    sets: 3, reps: 12,   repMode: 'fixed',duration: null, prKey: 'Pike Push-up',     notes: 'Try for 2 more reps than Monday' },
      { exerciseName: 'Resistance Band Lateral Raise',   sets: 4, reps: 15,   repMode: 'fixed',duration: null,                            notes: 'Pause at top for a beat' },
      { exerciseName: 'Resistance Band Tricep Extension',sets: 3, reps: 15,   repMode: 'fixed',duration: null,                            notes: 'Single arm version for extra stability' },
      { exerciseName: 'Ab Roller Rollout',               sets: 4, reps: 10,   repMode: 'fixed',duration: null, prKey: 'Ab Roller Rollout',notes: 'More reps than Monday' },
      { exerciseName: 'Hollow Body Rock',                sets: 3, reps: 10,   repMode: 'fixed',duration: null,                            notes: 'Maintain the hollow shape while rocking' },
    ]},
  { slug: 'sat:home', name: 'Full Body Circuit — Sat (Park)', type: 'conditioning', location: 'park',
    description: 'Full Body Circuit — Park Day (post-jog)',
    warmup: 'Already jogged here — 5 min easy jump rope to stay warm, then 10 arm circles',
    cooldown: 'Jog or walk home is the cooldown. Stretch hips and chest when you get back.',
    exercises: [
      { exerciseName: 'Pull-up',                         sets: 4, reps: null, repMode: 'max',  duration: null, prKey: 'Pull-up',          notes: 'Rest 2 min between sets. Chase your PR' },
      { exerciseName: 'Dip',                             sets: 3, reps: null, repMode: 'max',  duration: null, prKey: 'Dip',              notes: 'Use park parallel bars' },
      { exerciseName: 'Push-up Board Wide',              sets: 3, reps: 20,   repMode: 'fixed',duration: null,                            notes: 'Superset with pull-ups if recovering' },
      { exerciseName: 'Bodyweight Squat',                sets: 3, reps: 25,   repMode: 'fixed',duration: null,                            notes: 'Fast pace, conditioning focus' },
      { exerciseName: 'Jump Rope',                       sets: 3, reps: null, repMode: 'timed',duration: 120,                             notes: '2 min rounds, 60s rest' },
      { exerciseName: 'Shadow Boxing',                   sets: 3, reps: null, repMode: 'timed',duration: 180,                             notes: '3-min rounds. Work technique, not just power' },
      { exerciseName: 'Hanging Leg Raise',               sets: 4, reps: 12,   repMode: 'fixed',duration: null, prKey: 'Hanging Leg Raise',notes: 'Slow controlled, use the park bar' },
      { exerciseName: 'Ab Roller Rollout',               sets: 3, reps: 12,   repMode: 'fixed',duration: null, prKey: 'Ab Roller Rollout',notes: 'You brought the roller? Do it. Otherwise plank 3×60s' },
    ]},
  { slug: 'sun:home', name: 'Active Recovery — Sun (Home)', type: 'recovery', location: 'home',
    description: 'Active Recovery + Core',
    warmup: 'Light walk or easy 10 min jog — whatever feels right',
    cooldown: 'Full mobility flow: World\'s greatest stretch, hip flexor release, lat stretch, cat-cow, thoracic extension.',
    exercises: [
      { exerciseName: 'Ab Roller Rollout',               sets: 3, reps: 10,   repMode: 'fixed',duration: null,                            notes: 'Light, not max effort' },
      { exerciseName: 'Plank',                           sets: 3, reps: null, repMode: 'timed',duration: 60,   prKey: 'Plank',            notes: 'Focus on breathing' },
      { exerciseName: 'Dead Bug',                        sets: 3, reps: 10,   repMode: 'fixed',duration: null,                            notes: 'Reset the core' },
      { exerciseName: 'Resistance Band Face Pull',       sets: 3, reps: 20,   repMode: 'fixed',duration: null,                            notes: 'Shoulder health maintenance' },
      { exerciseName: 'Band Pull-Apart',                 sets: 3, reps: 20,   repMode: 'fixed',duration: null,                            notes: 'Upper back health' },
      { exerciseName: 'Jump Rope',                       sets: 1, reps: null, repMode: 'timed',duration: 300,                             notes: '5 min easy — just stay loose' },
    ]},

  // ── GYM WORKOUTS (work days) ────────────────────────────────────────────────
  { slug: 'mon:gym', name: 'Push Day — Mon (Gym)', type: 'strength', location: 'gym',
    description: 'Chest / Shoulders / Triceps (Gym)',
    warmup: 'Treadmill 5 min easy, then empty-bar bench press 2×10',
    cooldown: 'Chest doorway stretch 60s, cable rear-delt fly 2×20 for shoulder balance',
    exercises: [
      { exerciseName: 'Barbell Bench Press',             sets: 4, reps: null, repMode: 'max',  duration: null, prKey: 'Barbell Bench Press',   notes: 'Work up to a heavy top set, then 3×5' },
      { exerciseName: 'Incline Dumbbell Press',          sets: 3, reps: 12,   repMode: 'fixed',duration: null, prKey: 'Incline Dumbbell Press', notes: 'Full stretch at bottom' },
      { exerciseName: 'Cable Chest Fly',                 sets: 3, reps: 15,   repMode: 'fixed',duration: null,                                  notes: 'Cross-body, squeeze at centre' },
      { exerciseName: 'Dumbbell Overhead Press',         sets: 3, reps: 10,   repMode: 'fixed',duration: null, prKey: 'Dumbbell Overhead Press', notes: 'Seated or standing' },
      { exerciseName: 'Cable Tricep Pushdown',           sets: 3, reps: 15,   repMode: 'fixed',duration: null,                                  notes: 'Full extension, elbows pinned' },
      { exerciseName: 'Cable Lateral Raise',             sets: 3, reps: 15,   repMode: 'fixed',duration: null,                                  notes: 'Slow and controlled, no shrugging' },
      { exerciseName: 'Ab Roller Rollout',               sets: 4, reps: 10,   repMode: 'fixed',duration: null, prKey: 'Ab Roller Rollout',      notes: 'Brought it? Do it. Otherwise cable crunch 4×15' },
    ]},
  { slug: 'tue:gym', name: 'Pull + Core — Tue (Gym)', type: 'strength', location: 'gym',
    description: 'Back / Biceps (Gym)',
    warmup: 'Treadmill 5 min, then lat pulldown 2×10 light',
    cooldown: 'Lat stretch 30s each side, foam roll upper back',
    exercises: [
      { exerciseName: 'Lat Pulldown',                    sets: 4, reps: null, repMode: 'max',  duration: null, prKey: 'Lat Pulldown',          notes: 'Full range, chest to bar, control the negative' },
      { exerciseName: 'Seated Cable Row',                sets: 4, reps: 12,   repMode: 'fixed',duration: null, prKey: 'Seated Cable Row',       notes: 'Squeeze shoulder blades 1s at top' },
      { exerciseName: 'Single-Arm Dumbbell Row',         sets: 3, reps: 12,   repMode: 'fixed',duration: null, prKey: 'Single-Arm Dumbbell Row',notes: '12 per side' },
      { exerciseName: 'EZ-Bar Curl',                     sets: 3, reps: 12,   repMode: 'fixed',duration: null, prKey: 'EZ-Bar Curl',            notes: 'Full extension at bottom' },
      { exerciseName: 'Dumbbell Hammer Curl',            sets: 3, reps: 12,   repMode: 'fixed',duration: null,                                  notes: 'Neutral grip — hits brachialis' },
      { exerciseName: 'Cable Face Pull',                 sets: 3, reps: 20,   repMode: 'fixed',duration: null,                                  notes: 'Shoulder health — always do these' },
      { exerciseName: 'Hanging Leg Raise',               sets: 4, reps: 12,   repMode: 'fixed',duration: null, prKey: 'Hanging Leg Raise',      notes: 'Use pull-up bar or captain\'s chair' },
    ]},
  { slug: 'wed:gym', name: 'Legs + Conditioning — Wed (Gym)', type: 'strength', location: 'gym',
    description: 'Legs + Conditioning (Gym)',
    warmup: 'Bike or treadmill 5 min, then 2×10 goblet squat light',
    cooldown: 'Hip flexor 60s each, hamstring stretch, foam roll quads',
    exercises: [
      { exerciseName: 'Barbell Back Squat',              sets: 4, reps: null, repMode: 'max',  duration: null, prKey: 'Barbell Back Squat',    notes: 'Work up to 3×5 heavy, or moderate weight high rep' },
      { exerciseName: 'Romanian Deadlift (RDL)',         sets: 3, reps: 10,   repMode: 'fixed',duration: null, prKey: 'Romanian Deadlift',     notes: 'Hinge, flat back, feel the hamstring stretch' },
      { exerciseName: 'Leg Press',                       sets: 3, reps: 15,   repMode: 'fixed',duration: null,                                  notes: 'Full range, knees out' },
      { exerciseName: 'Leg Curl',                        sets: 3, reps: 12,   repMode: 'fixed',duration: null,                                  notes: '3-second negative' },
      { exerciseName: 'Calf Raise (machine)',            sets: 4, reps: 20,   repMode: 'fixed',duration: null,                                  notes: 'Full range, pause top and bottom' },
      { exerciseName: 'Cable Crunch',                    sets: 3, reps: 15,   repMode: 'fixed',duration: null,                                  notes: 'Round the spine into it' },
      { exerciseName: 'Side Plank',                      sets: 3, reps: null, repMode: 'timed',duration: 30,   prKey: 'Side Plank',            notes: '30s each side' },
    ]},
  { slug: 'thu:gym', name: 'Core + Active Recovery — Thu (Gym)', type: 'strength', location: 'gym',
    description: 'Core + Active Recovery (Gym)',
    warmup: 'Bike 10 min easy',
    cooldown: 'Full stretch — hip flexors, lats, thoracic. Take your time.',
    exercises: [
      { exerciseName: 'Cable Crunch',                    sets: 5, reps: 15,   repMode: 'fixed',duration: null,                                  notes: 'Round the spine fully' },
      { exerciseName: 'Cable Wood Chop (High)',          sets: 3, reps: 12,   repMode: 'fixed',duration: null,                                  notes: '12 per side — rotate, don\'t arm-swing' },
      { exerciseName: 'Hanging Leg Raise',               sets: 4, reps: 12,   repMode: 'fixed',duration: null, prKey: 'Hanging Leg Raise',      notes: 'Controlled, no swing' },
      { exerciseName: 'Plank',                           sets: 3, reps: null, repMode: 'timed',duration: 60,   prKey: 'Plank',                  notes: 'Squeeze everything' },
      { exerciseName: 'Cable Face Pull',                 sets: 3, reps: 20,   repMode: 'fixed',duration: null,                                  notes: 'Shoulder maintenance' },
    ]},
  { slug: 'fri:gym', name: 'Push Day — Fri (Gym)', type: 'strength', location: 'gym',
    description: 'Chest / Shoulders / Triceps (Gym, progressive)',
    warmup: 'Treadmill 5 min, bench warm-up sets',
    cooldown: 'Chest stretch, cable rear-delt fly 2×20',
    exercises: [
      { exerciseName: 'Barbell Bench Press',             sets: 4, reps: null, repMode: 'max',  duration: null, prKey: 'Barbell Bench Press',   notes: 'Beat Monday\'s numbers' },
      { exerciseName: 'Incline Dumbbell Press',          sets: 3, reps: 12,   repMode: 'fixed',duration: null, prKey: 'Incline Dumbbell Press', notes: 'Go heavier than Monday' },
      { exerciseName: 'Pec Deck',                        sets: 3, reps: 15,   repMode: 'fixed',duration: null,                                  notes: 'Pump finish for chest' },
      { exerciseName: 'Dumbbell Lateral Raise',          sets: 4, reps: 15,   repMode: 'fixed',duration: null,                                  notes: 'Slightly more than Monday if possible' },
      { exerciseName: 'Cable Tricep Pushdown',           sets: 3, reps: 15,   repMode: 'fixed',duration: null,                                  notes: 'Single-rope for variety' },
      { exerciseName: 'Overhead Tricep Extension',       sets: 3, reps: 12,   repMode: 'fixed',duration: null, prKey: 'Overhead Tricep Extension', notes: 'Cable or dumbbell' },
      { exerciseName: 'Cable Crunch',                    sets: 4, reps: 15,   repMode: 'fixed',duration: null,                                  notes: 'Core finisher' },
    ]},

  // ── EQUIPMENT PLANS (slug 'kit:<item>', not a weekday, so they never become a day's plan) ──
  { slug: 'kit:power-tower', name: 'Power Tower: Pull and Dip', type: 'strength', location: 'home',
    description: "Back, chest and triceps on the tower. Stop each pull set 1-2 reps short of failure.",
    warmup: "Scapular pull-ups x8, arm circles 10 each way, 30s easy hang",
    cooldown: "Lat stretch on the bar 30s each side, chest doorway stretch 30s",
    exercises: [
      { exerciseName: 'Pull-up',                           sets: 4, reps: null, repMode: 'max', duration: null, notes: "Stop 1-2 reps short of failure. Dead hang start, chin over the bar" },
      { exerciseName: 'Dip',                               sets: 4, reps: '6-10', repMode: 'fixed', duration: null, notes: "Shoulders to bar level, no bouncing" },
      { exerciseName: 'Chin-up',                           sets: 3, reps: null, repMode: 'max', duration: null, notes: "Underhand. Same rule: stop 1-2 reps short of failure" },
      { exerciseName: 'Hanging Knee Raise',                sets: 3, reps: '8-12', repMode: 'fixed', duration: null, notes: "Hang from the bar or use the captain's chair. No swinging" },
      { exerciseName: 'Dead Hang',                         sets: 2, reps: null, repMode: 'timed', duration: 30, notes: "Active shoulders, full grip. Easy to finish the session on" },
    ]},
  { slug: 'kit:bands', name: 'Resistance Bands: Pull and Shoulders', type: 'strength', location: 'home',
    description: "Back, arms and rear shoulders with bands. Anchor the band on the tower bar where needed.",
    warmup: "Arm circles 10 each way, 15 band pull-aparts light",
    cooldown: "Band pull-aparts x15, doorway chest stretch 30s",
    exercises: [
      { exerciseName: 'Band-Assisted Pull-up',             sets: 4, reps: '5-8', repMode: 'fixed', duration: null, notes: "Band looped over the tower bar, knee or foot in the loop. Move to a thinner band as you get stronger" },
      { exerciseName: 'Resistance Band Row',               sets: 3, reps: '12-15', repMode: 'fixed', duration: null, notes: "Squeeze the shoulder blades for 1s at the end" },
      { exerciseName: 'Resistance Band Face Pull',         sets: 3, reps: 15, repMode: 'fixed', duration: null, notes: "Pull to the face, elbows high. Shoulder health work" },
      { exerciseName: 'Resistance Band Bicep Curl',        sets: 3, reps: 12, repMode: 'fixed', duration: null, notes: "Elbows pinned to the sides, full extension at the bottom" },
      { exerciseName: 'Resistance Band Tricep Extension',  sets: 3, reps: 12, repMode: 'fixed', duration: null, notes: "Band anchored high on the tower, push straight down (pushdown) to full lockout" },
      { exerciseName: 'Resistance Band Lateral Raise',     sets: 3, reps: 15, repMode: 'fixed', duration: null, notes: "Slow, no shrugging" },
    ]},
  { slug: 'kit:parallettes', name: 'Parallettes: Push and Core', type: 'strength', location: 'home',
    description: "Pressing and core on parallettes. No freestanding handstands in this plan.",
    warmup: "Wrist circles 20s each way, wrist rocks 10, arm circles 10 each way",
    cooldown: "Wrist flexor stretch 30s each side, chest doorway stretch 30s",
    exercises: [
      { exerciseName: 'Tuck L-sit Hold',                   sets: 4, reps: null, repMode: 'timed', duration: 15, notes: "Aim for 10-20 s. Feet may rest down at first" },
      { exerciseName: 'Parallette Push-up',                sets: 4, reps: '8-12', repMode: 'fixed', duration: null, notes: "Deep, chest between the handles" },
      { exerciseName: 'Pseudo-Planche Lean',               sets: 3, reps: null, repMode: 'timed', duration: 15, notes: "Straight arms, lean the shoulders forward over the hands. Ease off if the wrists complain" },
      { exerciseName: 'Pike Push-up',                      sets: 3, reps: '6-10', repMode: 'fixed', duration: null, notes: "Hips high, feet on the floor. Head goes between the hands" },
      { exerciseName: 'Plank Shoulder Taps',               sets: 3, reps: 20, repMode: 'fixed', duration: null, notes: "Total taps. Hips level and still" },
    ]},
  { slug: 'kit:push-up-board', name: 'Push-up Board: Four Hand Positions', type: 'strength', location: 'home',
    description: "Standard, wide, close-grip and pike push-ups on the board, then a plank.",
    warmup: "Arm circles 10 each way, 10 easy push-ups on the floor",
    cooldown: "Chest doorway stretch 30s each side, shoulder dislocates with a band x10",
    exercises: [
      { exerciseName: 'Push-up',                           sets: 4, reps: '8-15', repMode: 'fixed', duration: null, notes: "Standard position. Hands on the marks for this position; check the colour chart printed on your board, as the exact positions may differ from what is described here (unverified)." },
      { exerciseName: 'Push-up Board Wide',                sets: 3, reps: '8-15', repMode: 'fixed', duration: null, notes: "Wide position. Hands on the marks for this position; check the colour chart printed on your board, as the exact positions may differ from what is described here (unverified)." },
      { exerciseName: 'Push-up Board Narrow',              sets: 3, reps: '8-15', repMode: 'fixed', duration: null, notes: "Close-grip position. Elbows brush the ribs. Hands on the marks for this position; check the colour chart printed on your board, as the exact positions may differ from what is described here (unverified)." },
      { exerciseName: 'Pike Push-up',                      sets: 3, reps: '8-15', repMode: 'fixed', duration: null, notes: "Pike position, hips high. Hands on the marks for this position; check the colour chart printed on your board, as the exact positions may differ from what is described here (unverified)." },
      { exerciseName: 'Plank',                             sets: 3, reps: null, repMode: 'timed', duration: 30, notes: "30-45 s. Straight line head to heels" },
    ]},
  { slug: 'kit:dip-belt', name: 'Dip Belt: Weighted Pull and Dip', type: 'strength', location: 'home',
    description: "Heavy pull-ups and dips on the bar and dip station, then bodyweight back-off sets. Stop each loaded set 1-2 reps short of failure.",
    warmup: "Scapular pull-ups x8, arm circles 10 each way, one easy bodyweight set of pull-ups and dips",
    cooldown: "Lat stretch on the bar 30s each side, chest doorway stretch 30s",
    exercises: [
      { exerciseName: 'Weighted Pull-up', sets: 4, reps: 5, repMode: 'fixed', duration: null, notes: "Dead hang to chin over the bar, no swing" },
      { exerciseName: 'Weighted Dip', sets: 4, reps: 6, repMode: 'fixed', duration: null, notes: "Controlled descent, plate kept still" },
      { exerciseName: 'Weighted Chin-up', sets: 3, reps: 6, repMode: 'fixed', duration: null, notes: "Underhand grip, lower slowly" },
      { exerciseName: 'Pull-up', sets: 2, reps: null, repMode: 'max', duration: null, notes: "Belt off. Stop 1-2 reps short of failure" },
      { exerciseName: 'Dip', sets: 2, reps: null, repMode: 'max', duration: null, notes: "Belt off. Stop 1-2 reps short of failure" },
      { exerciseName: 'Hanging Knee Raise', sets: 3, reps: 12, repMode: 'fixed', duration: null, notes: "No swing, curl the pelvis up" },
    ]},
  { slug: 'kit:ab-straps', name: 'Ab Straps: Hanging Core', type: 'strength', location: 'home',
    description: "Hanging core work with the grip taken out of it, so the abs tire before the forearms do.",
    warmup: "Cat-cow x8, dead hang 20s, easy knee raises x5",
    cooldown: "Slow nasal breathing 1 min, lying twist 30s each side",
    exercises: [
      { exerciseName: 'Ab Strap Knee Raise', sets: 3, reps: 12, repMode: 'fixed', duration: null, notes: "Curl the pelvis, lower slowly" },
      { exerciseName: 'Ab Strap Oblique Knee Raise', sets: 3, reps: 10, repMode: 'fixed', duration: null, notes: "10 per side, no swing" },
      { exerciseName: 'Ab Strap Leg Raise', sets: 3, reps: 8, repMode: 'fixed', duration: null, notes: "Bend the knees if the legs start to swing" },
      { exerciseName: 'Plank', sets: 3, reps: null, repMode: 'timed', duration: 45, notes: "45 s, ribs down" },
      { exerciseName: 'Dead Bug', sets: 3, reps: 10, repMode: 'fixed', duration: null, notes: "10 per side. Lower back stays on the floor" },
      { exerciseName: 'Hollow Body Hold', sets: 3, reps: null, repMode: 'timed', duration: 30, notes: "30 s, lower back pressed down" },
    ]},
  { slug: 'kit:landmine-power', name: 'Landmine Power: Rotation and Drive', type: 'strength', location: 'gym',
    description: "Explosive rotation, pressing and leg drive for striking and grappling. Do it fresh, before any other lifting and not straight before hard sparring or rolling. Rest about 90 seconds between power sets so each rep stays fast.",
    warmup: "Easy row or jog 3 min, hip circles and thoracic rotations 10 each side, one light set of each of the first three exercises",
    cooldown: "Hip flexor stretch 30s each side, thoracic rotation 10 each side, slow breathing 1 min",
    exercises: [
      { exerciseName: 'Landmine Deadlift to Rotational Press', sets: 3, reps: 4, repMode: 'fixed', duration: null, notes: "4 per side. Hips start the movement" },
      { exerciseName: 'Landmine Punch', sets: 4, reps: 4, repMode: 'fixed', duration: null, notes: "4 per side, from your fight stance. Stop when the bar slows" },
      { exerciseName: 'Landmine Rotation', sets: 3, reps: 6, repMode: 'fixed', duration: null, notes: "6 per side. Feet pivot, lower back does not twist" },
      { exerciseName: 'Landmine Push Press', sets: 3, reps: 5, repMode: 'fixed', duration: null, notes: "Legs drive the press" },
      { exerciseName: 'Landmine Reverse Lunge', sets: 3, reps: 6, repMode: 'fixed', duration: null, notes: "6 per side, controlled" },
      { exerciseName: 'Landmine Meadows Row', sets: 3, reps: 8, repMode: 'fixed', duration: null, notes: "8 per side, controlled" },
      { exerciseName: 'Landmine Anti-Rotation', sets: 2, reps: 8, repMode: 'fixed', duration: null, notes: "8 per side, slow, hips stay square" },
    ]},
  { slug: 'kit:mat', name: 'Mat: Legs and Mobility', type: 'strength', location: 'home',
    description: "Lower-body work and mobility on a mat. The other four equipment plans are upper body, so this one carries the legs.",
    warmup: "March in place 1 min, hip circles 10 each way",
    cooldown: "Slow nasal breathing 1 min, finish with the three mobility drills above",
    exercises: [
      { exerciseName: 'Bodyweight Squat',                  sets: 3, reps: '15-20', repMode: 'fixed', duration: null, notes: "Full depth, heels down" },
      { exerciseName: 'Reverse Lunge',                     sets: 3, reps: 10, repMode: 'fixed', duration: null, notes: "10 each side. Knee tracks over the toes" },
      { exerciseName: 'Glute Bridge',                      sets: 3, reps: 15, repMode: 'fixed', duration: null, notes: "Squeeze at the top for 1s" },
      { exerciseName: 'Dead Bug',                          sets: 3, reps: 10, repMode: 'fixed', duration: null, notes: "10 per side. Lower back stays on the floor" },
      { exerciseName: 'Side Plank',                        sets: 2, reps: null, repMode: 'timed', duration: 30, notes: "30 s each side" },
      { exerciseName: 'Cat-Cow',                           sets: 2, reps: 10, repMode: 'fixed', duration: null, notes: "Slow, with the breath" },
      { exerciseName: 'Pigeon Stretch',                    sets: 2, reps: null, repMode: 'timed', duration: 45, notes: "45 s each side" },
      { exerciseName: 'World\'s Greatest Stretch',         sets: 2, reps: 6, repMode: 'fixed', duration: null, notes: "6 per side to finish" },
    ]},
  // ── Variety (step 3): more non-day plans. No buy link: each needs several items or one the catalogue does not link. ──
  { slug: 'kit:ab-roller-core', name: 'Ab Roller and Core', type: 'strength', location: 'home',
    description: "A core session built around the ab roller, with floor work either side. Start every rollout from the knees and keep the range short until it feels easy.",
    warmup: "Cat-cow 8 slow rounds, dead bug 5 each side",
    cooldown: "Child's pose 45 s, cobra stretch 20 s",
    exercises: [
      { exerciseName: 'Ab Roller Knee Tuck',               sets: 3, reps: 8, repMode: 'fixed', duration: null, notes: "Start with a short range. Ribs down, no sagging in the low back" },
      { exerciseName: 'Ab Roller Rollout',                 sets: 3, reps: 6, repMode: 'fixed', duration: null, notes: "From the knees, short range first. Stop the set if the low back sags" },
      { exerciseName: 'Hollow Body Hold',                  sets: 3, reps: null, repMode: 'timed', duration: 20, notes: "Low back stays on the floor. Bend the knees to make it easier" },
      { exerciseName: 'Dead Bug',                          sets: 3, reps: 8, repMode: 'fixed', duration: null, notes: "8 per side. Slow, low back flat" },
      { exerciseName: 'Side Plank',                        sets: 2, reps: null, repMode: 'timed', duration: 20, notes: "20 s each side. Straight line from ankle to ear" },
      { exerciseName: 'Plank',                             sets: 2, reps: null, repMode: 'timed', duration: 30, notes: "Straight line head to heels. Stop when the hips start to sag" },
    ]},
  { slug: 'kit:rope-conditioning', name: 'Weighted Rope and Bodyweight Conditioning', type: 'conditioning', location: 'home',
    description: "Short rope rounds and bodyweight work that fit a room. Check the ceiling before the first round: you need clear space above your head and the rope's arc. Rounds are starting points.",
    warmup: "March in place 1 min, ankle rocks 10 each side, arm circles 10 each way",
    cooldown: "Calf wall stretch 30 s each side, slow breathing for 1 min",
    exercises: [
      { exerciseName: 'Jump Rope: Room Intervals',        sets: 6, reps: null, repMode: 'timed', duration: 30, notes: "30 s on, 30 s off. Small low hops, turn from the wrists" },
      { exerciseName: 'Jump Rope: Boxer Skip',            sets: 4, reps: null, repMode: 'timed', duration: 30, notes: "30 s on, 30 s off. Relaxed hops, balls of the feet" },
      { exerciseName: 'Mountain Climber',                  sets: 3, reps: null, repMode: 'timed', duration: 30, notes: "30 s, hands under the shoulders, steady pace" },
      { exerciseName: 'Bodyweight Squat',                  sets: 3, reps: 15, repMode: 'fixed', duration: null, notes: "Heels down, no jump, controlled" },
      { exerciseName: 'Shadow Boxing',                     sets: 3, reps: null, repMode: 'timed', duration: 120, notes: "Three 2-minute rounds, light and technical. Keep punches short in a low-ceiling room" },
    ]},
  { slug: 'kit:tower-bands-full-body', name: 'Full Body: Tower and Bands', type: 'strength', location: 'home',
    description: "A whole-body session from the power tower and resistance bands. Stop each set 1-2 reps short of failure.",
    warmup: "Scapular pull-ups x6, band pull-aparts x12, bodyweight squats x10",
    cooldown: "Lat stretch on the bar 30 s each side, doorway chest stretch 30 s each side",
    exercises: [
      { exerciseName: 'Pull-up',                           sets: 3, reps: null, repMode: 'max', duration: null, notes: "Stop 1-2 reps short of failure" },
      { exerciseName: 'Dip',                               sets: 3, reps: '6-10', repMode: 'fixed', duration: null, notes: "Shoulders to bar level, no bouncing" },
      { exerciseName: 'Resistance Band Row',               sets: 3, reps: 12, repMode: 'fixed', duration: null, notes: "Squeeze the shoulder blades for 1s at the end" },
      { exerciseName: 'Push-up',                           sets: 3, reps: '8-12', repMode: 'fixed', duration: null, notes: "Full range, body in one line" },
      { exerciseName: 'Reverse Lunge',                     sets: 3, reps: 10, repMode: 'fixed', duration: null, notes: "10 each side. Knee tracks over the toes" },
      { exerciseName: 'Glute Bridge',                      sets: 3, reps: 15, repMode: 'fixed', duration: null, notes: "Squeeze at the top for 1s" },
      { exerciseName: 'Hanging Knee Raise',                sets: 3, reps: '8-10', repMode: 'fixed', duration: null, notes: "No swinging. Use the captain's chair if the grip is tired" },
    ]},
  { slug: 'kit:minimal-20', name: '20-Minute Minimal Day', type: 'strength', location: 'home',
    description: "No equipment and about 20 minutes, for a day with little time or space. One pass through, then a short cooldown.",
    warmup: "Hip circles 10 each way, arm circles 10 each way, 10 easy squats",
    cooldown: "Child's pose 45 s, slow breathing for 1 min",
    exercises: [
      { exerciseName: 'Push-up',                           sets: 3, reps: '8-12', repMode: 'fixed', duration: null, notes: "Rest 45 s between sets. Drop to the knees if the form goes" },
      { exerciseName: 'Bodyweight Squat',                  sets: 3, reps: 15, repMode: 'fixed', duration: null, notes: "Full depth that stays comfortable" },
      { exerciseName: 'Reverse Lunge',                     sets: 2, reps: 10, repMode: 'fixed', duration: null, notes: "10 each side" },
      { exerciseName: 'Glute Bridge',                      sets: 2, reps: 15, repMode: 'fixed', duration: null, notes: "Squeeze at the top for 1s" },
      { exerciseName: 'Dead Bug',                          sets: 2, reps: 8, repMode: 'fixed', duration: null, notes: "8 per side. Low back stays on the floor" },
      { exerciseName: 'Plank',                             sets: 2, reps: null, repMode: 'timed', duration: 30, notes: "Straight line head to heels" },
    ]},
  { slug: 'kit:deload-light', name: 'Deload: Light Full Body', type: 'strength', location: 'home',
    description: "A deload session: about half the usual sets, easy effort, nothing near failure. Use it in a lighter week in place of a hard day. It sits beside your weekly plan and does not replace it.",
    warmup: "Cat-cow 8 slow rounds, hip circles 8 each way, arm circles 10 each way",
    cooldown: "Child's pose 45 s, legs up the wall 2 min if you have the wall space",
    exercises: [
      { exerciseName: 'Push-up',                           sets: 2, reps: '6-8', repMode: 'fixed', duration: null, notes: "Easy. Leave 3-4 reps in reserve" },
      { exerciseName: 'Tempo Bodyweight Squat',            sets: 2, reps: 8, repMode: 'fixed', duration: null, notes: "3 s down, easy depth" },
      { exerciseName: 'Resistance Band Row',               sets: 2, reps: 12, repMode: 'fixed', duration: null, notes: "Light band, smooth reps" },
      { exerciseName: 'Glute Bridge',                      sets: 2, reps: 10, repMode: 'fixed', duration: null, notes: "Slow, squeeze at the top" },
      { exerciseName: 'Dead Bug',                          sets: 2, reps: 6, repMode: 'fixed', duration: null, notes: "6 per side" },
      { exerciseName: 'Dead Hang',                         sets: 2, reps: null, repMode: 'timed', duration: 15, notes: "Easy hang, step down well before the grip fades" },
    ]},
];

const SEED_ROUTINES = [
  {
    name: 'MMA Dynamic Warmup (12 min)',
    type: 'warmup',
    notes: 'Quick prep before pads, bag work, drilling, or lifting.',
    items: [
      { name: 'Jump Rope', duration: 120, reps: null, sets: 1, notes: 'Light bounce, nasal breathing', instructions: 'Build heat first, stay relaxed through shoulders.', mediaUrl: null },
      { name: 'World\'s Greatest Stretch', duration: null, reps: 6, sets: 1, notes: 'Per side', instructions: 'Elbow to instep, then rotate chest open.', mediaUrl: 'https://www.youtube.com/results?search_query=worlds+greatest+stretch+demo' },
      { name: 'Hip Escape (Shrimp)', duration: null, reps: 10, sets: 2, notes: 'Each side', instructions: 'Drive off foot and slide hips away.', mediaUrl: null },
      { name: 'Shadow Boxing', duration: 180, reps: null, sets: 1, notes: 'Loose combos + footwork', instructions: 'Stay technical, do not throw max power in warmup.', mediaUrl: null },
    ],
  },
  {
    name: 'Lower Body Mobility (15 min)',
    type: 'stretching',
    notes: 'Use after training or on active recovery days.',
    items: [
      { name: 'Couch Stretch', duration: 60, reps: null, sets: 2, notes: 'Each side', instructions: 'Posterior pelvic tilt and glute squeeze.', mediaUrl: 'https://www.youtube.com/results?search_query=couch+stretch+demo' },
      { name: '90/90 Hip Switch', duration: 90, reps: null, sets: 2, notes: 'Controlled', instructions: 'Rotate through hips without arching back.', mediaUrl: 'https://www.youtube.com/results?search_query=90+90+hip+switch+mobility' },
      { name: 'Hamstring Floss', duration: null, reps: 10, sets: 2, notes: 'Each side', instructions: 'Rock in and out of end range, avoid pain.', mediaUrl: 'https://www.youtube.com/results?search_query=hamstring+floss+mobility' },
      { name: 'Ankle Dorsiflexion Wall Drill', duration: null, reps: 12, sets: 2, notes: 'Each side', instructions: 'Knee tracks over middle toes; heel planted.', mediaUrl: 'https://www.youtube.com/results?search_query=ankle+dorsiflexion+wall+drill' },
    ],
  },
  {
    name: 'Post-Workout Cooldown (10 min)',
    type: 'cooldown',
    notes: 'Bring heart rate down and recover tissue quality.',
    items: [
      { name: 'Walk + Deep Breathing', duration: 180, reps: null, sets: 1, notes: 'Slow pace', instructions: 'Inhale 4 sec, exhale 6 sec.', mediaUrl: null },
      { name: 'Pigeon Stretch', duration: 60, reps: null, sets: 2, notes: 'Each side', instructions: 'Relax and breathe into hip.', mediaUrl: 'https://www.youtube.com/results?search_query=pigeon+stretch+tutorial' },
      { name: 'Thoracic Open Book', duration: null, reps: 8, sets: 2, notes: 'Each side', instructions: 'Keep knees stacked while opening chest.', mediaUrl: 'https://www.youtube.com/results?search_query=thoracic+open+book+stretch' },
      { name: 'Bretzel Stretch', duration: 45, reps: null, sets: 2, notes: 'Each side', instructions: 'Move gently into end range.', mediaUrl: 'https://www.youtube.com/results?search_query=bretzel+stretch+demo' },
    ],
  },
];

const SEED_PLANS = [
  {
    name: '12-Week MMA Fight Camp',
    sport: 'mma',
    durationWeeks: 12,
    description: 'Full fight camp with periodisation. Builds from aerobic base through strength and power, peaks with fight-pace sparring, then tapers in final two weeks.',
    phases: JSON.stringify([
      {
        name: 'Base', weeks: '1–4', focus: 'Aerobic base, technical drilling, strength foundation',
        weeklySchedule: [
          { day: 1, title: 'BJJ Drilling', type: 'bjj', duration: 90, description: 'Guard work, escapes, transitions. Light positional rolling only.' },
          { day: 2, title: 'Strength — Lower', type: 'strength', duration: 60, description: 'Squat 4×5, RDL 4×8, leg press 3×10. Core finisher.' },
          { day: 3, title: 'Muay Thai Technique', type: 'muay_thai', duration: 90, description: 'Bag + pad work. Jab-cross, teep, roundhouse. Focus on form, not power.' },
          { day: 4, title: 'Strength — Upper', type: 'strength', duration: 60, description: 'Bench 4×5, row 4×6, OHP 3×8, pull-ups 3×max.' },
          { day: 5, title: 'MMA Skills', type: 'mma', duration: 90, description: 'Wrestling entries, sprawls, clinch work. Light MMA drilling.' },
          { day: 6, title: 'Conditioning', type: 'conditioning', duration: 45, description: 'Assault bike 6×3min/1min rest + bag rounds.' },
          { day: 0, title: 'Rest / Mobility', type: 'recovery', duration: 30, description: 'Foam roll, light stretching, or complete rest.' },
        ],
      },
      {
        name: 'Build', weeks: '5–8', focus: 'Power development, increased sparring volume, conditioning intensity',
        weeklySchedule: [
          { day: 1, title: 'BJJ — Live Rolling', type: 'bjj', duration: 90, description: 'Technical drilling + 3–4 rounds live rolling.' },
          { day: 2, title: 'Power — Lower', type: 'strength', duration: 60, description: 'Jump squats 4×5, deadlift 4×3 heavy, box jumps. Explosive focus.' },
          { day: 3, title: 'Muay Thai Sparring', type: 'muay_thai', duration: 90, description: 'Technique + light sparring. 4–5 rounds 50–70% intensity.' },
          { day: 4, title: 'Power — Upper', type: 'strength', duration: 60, description: 'Bench 4×3 heavy, DB rows, cable work. Keep session short and intense.' },
          { day: 5, title: 'MMA Sparring', type: 'mma', duration: 90, description: 'Full MMA rounds 60–70%. Focus on game plan execution.' },
          { day: 6, title: 'Hard Conditioning', type: 'conditioning', duration: 45, description: 'Tabata bike, burpee/bag circuit, suicide sprints.' },
          { day: 0, title: 'Active Recovery', type: 'recovery', duration: 45, description: 'Light jog or skate + mobility work.' },
        ],
      },
      {
        name: 'Peak', weeks: '9–10', focus: 'Fight-pace conditioning, full sparring, sharpen technique',
        weeklySchedule: [
          { day: 1, title: 'BJJ — Competition Pace', type: 'bjj', duration: 60, description: '5-min rounds, fight pace. No light drilling — go.' },
          { day: 2, title: 'Conditioning Only', type: 'conditioning', duration: 45, description: 'No lifting. Assault bike AMRAP + bag work + sprints.' },
          { day: 3, title: 'Full MMA Sparring', type: 'mma', duration: 90, description: '80–90% intensity. Full rounds. Focus on flow and timing.' },
          { day: 4, title: 'Skill Sharpening', type: 'technique', duration: 60, description: 'Technical drilling only. Sharpen specific sequences.' },
          { day: 5, title: 'Final Hard Sparring', type: 'mma', duration: 90, description: 'Last hard session before taper. Full rounds.' },
          { day: 6, title: 'Light Conditioning', type: 'cardio', duration: 30, description: 'Easy bike, shadow boxing. Stay loose.' },
          { day: 0, title: 'Rest', type: 'recovery', duration: 0, description: 'Complete rest. Eat, sleep, recover.' },
        ],
      },
      {
        name: 'Taper', weeks: '11–12', focus: 'Reduce volume, maintain sharpness, peak for competition',
        weeklySchedule: [
          { day: 1, title: 'Skill Work', type: 'technique', duration: 45, description: 'Light drilling only. Feel sharp, not tired.' },
          { day: 2, title: 'Easy Conditioning', type: 'cardio', duration: 30, description: 'Bike at 50%. Shadow box. No weight training.' },
          { day: 3, title: 'Light Sparring', type: 'mma', duration: 45, description: '2–3 technical rounds only. Stay healthy.' },
          { day: 4, title: 'Active Rest', type: 'recovery', duration: 30, description: 'Walk, light stretch, foam roll.' },
          { day: 5, title: 'Final Tune-Up', type: 'technique', duration: 30, description: 'Visualisation + light drilling. Feel ready.' },
          { day: 6, title: 'Rest', type: 'recovery', duration: 0, description: 'Rest. Eat well. Hydrate. Sleep.' },
          { day: 0, title: 'Rest', type: 'recovery', duration: 0, description: 'Competition week — rest or travel.' },
        ],
      },
    ]),
  },
  {
    name: '8-Week Off-Season Strength Block',
    sport: 'strength',
    durationWeeks: 8,
    description: 'Off-season focus on building a strength base and adding muscle. Minimal sparring to let the body recover and grow. Two strength days per week with conditioning maintenance.',
    phases: JSON.stringify([
      {
        name: 'Accumulation', weeks: '1–4', focus: 'Volume accumulation, build work capacity',
        weeklySchedule: [
          { day: 1, title: 'Upper Push + Pull A', type: 'strength', duration: 70, description: 'Bench 4×8, incline DB 3×10, OHP 3×10, pull-ups 4×max, cable row 3×12.' },
          { day: 2, title: 'Lower — Squat Focus', type: 'strength', duration: 70, description: 'Back squat 4×8, Bulgarian split squat 3×10, leg press 3×12, RDL 3×10.' },
          { day: 3, title: 'MMA Skills (Light)', type: 'technique', duration: 60, description: 'Drilling and bag work only. No sparring. Maintain technique.' },
          { day: 4, title: 'Upper Push + Pull B', type: 'strength', duration: 60, description: 'DB bench 4×10, face pulls 3×15, lateral raises 4×15, cable curls 3×12, pushdowns 3×12.' },
          { day: 5, title: 'Lower — Hinge Focus', type: 'strength', duration: 70, description: 'Deadlift 4×5, hip thrust 4×10, leg curl 3×12, calf raise 4×15.' },
          { day: 6, title: 'Conditioning', type: 'conditioning', duration: 40, description: 'Easy 30-min bike + bag rounds to maintain cardio.' },
          { day: 0, title: 'Rest', type: 'recovery', duration: 0, description: 'Full rest or light mobility.' },
        ],
      },
      {
        name: 'Intensification', weeks: '5–8', focus: 'Heavier loads, lower reps, peak strength',
        weeklySchedule: [
          { day: 1, title: 'Heavy Upper A', type: 'strength', duration: 70, description: 'Bench 5×3, OHP 4×5, weighted pull-ups 4×5, DB row 4×8.' },
          { day: 2, title: 'Heavy Lower — Squat', type: 'strength', duration: 70, description: 'Back squat 5×3, front squat 3×5, single leg work 3×8.' },
          { day: 3, title: 'MMA + Conditioning', type: 'mma', duration: 75, description: 'Bag work + light rolling. Maintain skills and cardio.' },
          { day: 4, title: 'Heavy Upper B', type: 'strength', duration: 60, description: 'Close-grip bench 4×5, cable rows heavy, arms. Accessory work.' },
          { day: 5, title: 'Heavy Lower — Hinge', type: 'strength', duration: 70, description: 'Deadlift 5×3, hip thrust heavy, hamstring focus.' },
          { day: 6, title: 'Active Recovery', type: 'recovery', duration: 40, description: 'Light skate or bike. Mobility. No intensity.' },
          { day: 0, title: 'Rest', type: 'recovery', duration: 0, description: 'Full rest.' },
        ],
      },
    ]),
  },
  {
    name: '6-Week BJJ Competition Prep',
    sport: 'bjj',
    durationWeeks: 6,
    description: 'The GYM strength & conditioning around your BJJ classes — you handle the mat work at class (Mon/Wed/Fri). Builds strength and grappling-specific conditioning, then peaks and deloads so you hit comp week fresh. Legs stay fresh on class days; the heavy leg day is on a non-class day.',
    phases: JSON.stringify([
      {
        name: 'Build', weeks: '1–3', focus: 'Gym strength + conditioning volume, supporting your BJJ classes',
        weeklySchedule: [
          { day: 1, title: 'Upper Strength (BJJ class tonight)', type: 'strength', duration: 50, description: 'Keep legs fresh for class. Bench 4×6, weighted pull-ups 4×6, DB shoulder press 3×8, cable row 3×10, face pulls 3×15.' },
          { day: 2, title: 'Conditioning + Calisthenics', type: 'conditioning', duration: 40, description: 'Off day. Jog to the park 15 min, then 4 rounds: 8 pull-ups, 10 dips, 15 push-ups, 15 hanging leg raises.' },
          { day: 3, title: 'Grip + Core (BJJ class tonight)', type: 'strength', duration: 35, description: 'Light on legs. Farmer carries 4×40m, dead hangs 4×max, hanging leg raise 4×12, ab rollout 3×10, hip mobility.' },
          { day: 4, title: 'Lower Strength — Heavy (no class)', type: 'strength', duration: 60, description: 'Your main leg day, no rolling after. Back squat 4×5, Romanian deadlift 4×6, hip thrust 4×8, Bulgarian split squat 3×8, calf raise 3×15.' },
          { day: 5, title: 'Light / Rest (open mat tonight)', type: 'recovery', duration: 20, description: 'Prioritise the mat. Optional: 10 min bike, band pull-aparts, mobility. Nothing that leaves you sore.' },
          { day: 6, title: 'Conditioning — Intervals', type: 'conditioning', duration: 35, description: 'Off day. Assault bike or hill sprints 8×30s hard / 90s easy, then a core circuit (planks, hollow holds, Russian twists).' },
          { day: 0, title: 'Full-Body Power', type: 'strength', duration: 50, description: 'Trap-bar deadlift 5×3 explosive, push press 4×5, weighted chin-ups 4×5, kettlebell swings 4×15, loaded carries.' },
        ],
      },
      {
        name: 'Peak + Deload', weeks: '4–6', focus: 'Heavier low-volume strength weeks 4–5, deload week 6 — arrive fresh',
        weeklySchedule: [
          { day: 1, title: 'Upper Strength — Heavy (BJJ tonight)', type: 'strength', duration: 40, description: 'Short and heavy, legs fresh. Bench 5×3, weighted pull-ups 5×3, OHP 3×5. WEEK 6 (deload): light 2×5 at 60%.' },
          { day: 2, title: 'Conditioning — Sharp', type: 'conditioning', duration: 30, description: 'Bike intervals 6×40s hard. WEEK 6: easy 15 min flush only.' },
          { day: 3, title: 'Grip + Core (BJJ tonight)', type: 'strength', duration: 30, description: 'Heavy carries, dead hangs, core. WEEK 6: mobility and light core only.' },
          { day: 4, title: 'Lower Strength — Heavy (no class)', type: 'strength', duration: 50, description: 'Back squat 5×3, deadlift 3×3, hip thrust heavy. WEEK 6 (deload): light 2×5, no grinding.' },
          { day: 5, title: 'Rest / Light (open mat tonight)', type: 'recovery', duration: 15, description: 'Rest or 10 min mobility. Save it for the mat.' },
          { day: 6, title: 'Conditioning — Maintain', type: 'conditioning', duration: 25, description: 'Moderate bike + core. WEEK 6: full rest.' },
          { day: 0, title: 'Power + Recovery', type: 'strength', duration: 35, description: 'Light explosive work (jumps, med-ball throws) + mobility. WEEK 6 (comp week): full rest, visualise, hydrate.' },
        ],
      },
    ]),
  },
  {
    name: '4-Week BJJ Competition Prep',
    sport: 'bjj',
    durationWeeks: 4,
    description: 'A month out. The GYM strength & conditioning around your BJJ classes (Mon/Wed/Fri) — you do the mat work at class. Two build weeks, then peak and a deload final week so you arrive fresh. Heavy legs land on a non-class day.',
    phases: JSON.stringify([
      {
        name: 'Build', weeks: '1–2', focus: 'Gym strength + conditioning, legs fresh for class days',
        weeklySchedule: [
          { day: 1, title: 'Upper Strength (BJJ class tonight)', type: 'strength', duration: 50, description: 'Keep legs fresh. Bench 4×6, weighted pull-ups 4×6, DB shoulder press 3×8, cable row 3×10, face pulls 3×15.' },
          { day: 2, title: 'Conditioning + Calisthenics', type: 'conditioning', duration: 40, description: 'Off day. Jog to the park 15 min, then 4 rounds: 8 pull-ups, 10 dips, 15 push-ups, 15 hanging leg raises.' },
          { day: 3, title: 'Grip + Core (BJJ class tonight)', type: 'strength', duration: 35, description: 'Light on legs. Farmer carries 4×40m, dead hangs 4×max, hanging leg raise 4×12, ab rollout 3×10, hip mobility.' },
          { day: 4, title: 'Lower Strength — Heavy (no class)', type: 'strength', duration: 60, description: 'Main leg day. Back squat 4×5, Romanian deadlift 4×6, hip thrust 4×8, Bulgarian split squat 3×8, calf raise 3×15.' },
          { day: 5, title: 'Light / Rest (open mat tonight)', type: 'recovery', duration: 20, description: 'Prioritise the mat. Optional 10 min bike, band pull-aparts, mobility. Nothing that leaves you sore.' },
          { day: 6, title: 'Conditioning — Intervals', type: 'conditioning', duration: 35, description: 'Off day. Assault bike or hill sprints 8×30s hard / 90s easy, then a core circuit.' },
          { day: 0, title: 'Full-Body Power', type: 'strength', duration: 50, description: 'Trap-bar deadlift 5×3 explosive, push press 4×5, weighted chin-ups 4×5, kettlebell swings 4×15, carries.' },
        ],
      },
      {
        name: 'Peak + Deload', weeks: '3–4', focus: 'Heavy low-volume week 3, deload week 4 — arrive fresh',
        weeklySchedule: [
          { day: 1, title: 'Upper Strength — Heavy (BJJ tonight)', type: 'strength', duration: 40, description: 'Short and heavy. Bench 5×3, weighted pull-ups 5×3, OHP 3×5. WEEK 4 (deload): light 2×5 at 60%.' },
          { day: 2, title: 'Conditioning — Sharp', type: 'conditioning', duration: 30, description: 'Bike intervals 6×40s hard. WEEK 4: easy 15 min flush only.' },
          { day: 3, title: 'Grip + Core (BJJ tonight)', type: 'strength', duration: 30, description: 'Heavy carries, dead hangs, core. WEEK 4: mobility and light core only.' },
          { day: 4, title: 'Lower Strength — Heavy (no class)', type: 'strength', duration: 50, description: 'Back squat 5×3, deadlift 3×3, hip thrust heavy. WEEK 4 (deload): light 2×5, no grinding.' },
          { day: 5, title: 'Rest / Light (open mat tonight)', type: 'recovery', duration: 15, description: 'Rest or 10 min mobility. Save it for the mat.' },
          { day: 6, title: 'Conditioning — Maintain', type: 'conditioning', duration: 25, description: 'Moderate bike + core. WEEK 4: full rest.' },
          { day: 0, title: 'Power + Recovery', type: 'strength', duration: 35, description: 'Light explosive work + mobility. WEEK 4 (comp week): full rest, visualise, hydrate.' },
        ],
      },
    ]),
  },
  {
    name: '2-Week BJJ Competition Prep',
    sport: 'bjj',
    durationWeeks: 2,
    description: 'Short notice. The GYM side only: keep strength sharp without building fatigue, then deload into comp. Your BJJ classes (Mon/Wed/Fri) carry the mat work. No new stimulus — stay fresh.',
    phases: JSON.stringify([
      {
        name: 'Sharpen', weeks: '1–1', focus: 'Maintain strength, light conditioning, zero soreness',
        weeklySchedule: [
          { day: 1, title: 'Upper — Light/Sharp (BJJ tonight)', type: 'strength', duration: 35, description: 'Crisp, not heavy. Bench 3×3 @ 80%, pull-ups 3×5, band face pulls 3×15. Fast reps, leave 3 in the tank.' },
          { day: 2, title: 'Easy Conditioning', type: 'conditioning', duration: 25, description: 'Off day. Easy jog or bike 20 min + mobility. Nothing hard.' },
          { day: 3, title: 'Core + Mobility (BJJ tonight)', type: 'recovery', duration: 25, description: 'Hanging leg raise 3×10, ab rollout 3×8, hip mobility. Keep it light.' },
          { day: 4, title: 'Lower — Light/Sharp (no class)', type: 'strength', duration: 35, description: 'Squat 3×3 @ 80%, hip thrust 3×5, calf raise 2×15. Explosive, no grinding.' },
          { day: 5, title: 'Rest (open mat tonight)', type: 'recovery', duration: 0, description: 'Full rest off the mat. Save your legs.' },
          { day: 6, title: 'Light Conditioning', type: 'conditioning', duration: 20, description: 'Off day. Easy bike + stretch. Stay loose.' },
          { day: 0, title: 'Rest / Mobility', type: 'recovery', duration: 20, description: 'Walk, foam roll, mobility.' },
        ],
      },
      {
        name: 'Taper', weeks: '2–2', focus: 'Deload, keep sharp, peak for comp day',
        weeklySchedule: [
          { day: 1, title: 'Primer (BJJ tonight)', type: 'strength', duration: 20, description: 'A few crisp sets: 3 explosive squat jumps, 3×3 fast push-ups, band work. Just prime the system.' },
          { day: 2, title: 'Easy Movement', type: 'recovery', duration: 20, description: 'Walk, mobility, light stretch. No training.' },
          { day: 3, title: 'Mobility (BJJ tonight)', type: 'recovery', duration: 15, description: 'Hip and shoulder mobility only. Feel loose.' },
          { day: 4, title: 'Active Rest (no class)', type: 'recovery', duration: 20, description: 'Foam roll, light stretch. Recover.' },
          { day: 5, title: 'Final Primer', type: 'strength', duration: 15, description: 'A handful of explosive reps to feel snappy. Nothing tiring.' },
          { day: 6, title: 'Rest', type: 'recovery', duration: 0, description: 'Rest. Eat well, hydrate, sleep.' },
          { day: 0, title: 'Rest', type: 'recovery', duration: 0, description: 'Competition day — rest or travel.' },
        ],
      },
    ]),
  },
  {
    name: '8-Week BJJ Competition Prep',
    sport: 'bjj',
    durationWeeks: 8,
    description: 'Longer runway. The GYM strength & conditioning around your BJJ classes (Mon/Wed/Fri) — builds a strength base, raises it, then peaks and deloads into comp day. Heavy legs on a non-class day; final week is a deload.',
    phases: JSON.stringify([
      {
        name: 'Base', weeks: '1–2', focus: 'Strength foundation + aerobic base, moderate volume',
        weeklySchedule: [
          { day: 1, title: 'Upper Strength (BJJ tonight)', type: 'strength', duration: 55, description: 'Legs fresh. Bench 4×8, pull-ups 4×8, DB shoulder press 3×10, cable row 3×12, face pulls 3×15.' },
          { day: 2, title: 'Aerobic + Calisthenics', type: 'conditioning', duration: 40, description: 'Off day. Easy 25 min jog/bike (build base) + 3 rounds park calisthenics.' },
          { day: 3, title: 'Grip + Core (BJJ tonight)', type: 'strength', duration: 35, description: 'Farmer carries 4×40m, dead hangs, hanging leg raise 4×12, ab rollout 3×10, mobility.' },
          { day: 4, title: 'Lower Strength (no class)', type: 'strength', duration: 60, description: 'Back squat 4×8, RDL 4×8, leg press 3×10, hip thrust 3×10, calf raise 3×15.' },
          { day: 5, title: 'Light / Rest (open mat)', type: 'recovery', duration: 20, description: 'Mobility, bands. Prioritise the mat.' },
          { day: 6, title: 'Conditioning — Base', type: 'conditioning', duration: 40, description: 'Off day. Steady 30 min bike or jog + core circuit.' },
          { day: 0, title: 'Full-Body', type: 'strength', duration: 55, description: 'Trap-bar deadlift 4×5, push press 4×6, chin-ups 4×8, KB swings 4×15, carries.' },
        ],
      },
      {
        name: 'Build', weeks: '3–5', focus: 'Raise strength, grappling-specific conditioning',
        weeklySchedule: [
          { day: 1, title: 'Upper Strength (BJJ tonight)', type: 'strength', duration: 50, description: 'Bench 5×5, weighted pull-ups 4×6, DB press 3×8, row 3×10, face pulls 3×15.' },
          { day: 2, title: 'Conditioning + Calisthenics', type: 'conditioning', duration: 40, description: 'Off day. Jog to park 15 min, then 4 rounds: 8 pull-ups, 10 dips, 15 push-ups, 15 leg raises.' },
          { day: 3, title: 'Grip + Core (BJJ tonight)', type: 'strength', duration: 35, description: 'Heavy carries, dead hangs 4×max, hanging leg raise 4×12, ab rollout 3×10.' },
          { day: 4, title: 'Lower Strength — Heavy (no class)', type: 'strength', duration: 60, description: 'Back squat 5×5, Romanian deadlift 4×6, hip thrust 4×8, Bulgarian split squat 3×8.' },
          { day: 5, title: 'Light / Rest (open mat)', type: 'recovery', duration: 20, description: 'Mobility, band work. Save it for the mat.' },
          { day: 6, title: 'Conditioning — Intervals', type: 'conditioning', duration: 35, description: 'Off day. Assault bike or hill sprints 8×30s + core circuit.' },
          { day: 0, title: 'Full-Body Power', type: 'strength', duration: 50, description: 'Trap-bar deadlift 5×3 explosive, push press 4×5, weighted chin-ups 4×5, KB swings, carries.' },
        ],
      },
      {
        name: 'Peak', weeks: '6–7', focus: 'Heavy low-volume strength, sharp conditioning',
        weeklySchedule: [
          { day: 1, title: 'Upper — Heavy (BJJ tonight)', type: 'strength', duration: 40, description: 'Bench 5×3, weighted pull-ups 5×3, OHP 3×5. Short and heavy, legs fresh.' },
          { day: 2, title: 'Conditioning — Sharp', type: 'conditioning', duration: 30, description: 'Off day. Bike intervals 6×40s hard / 80s easy + core.' },
          { day: 3, title: 'Grip + Core (BJJ tonight)', type: 'strength', duration: 30, description: 'Heavy carries, dead hangs, core. Keep it brief.' },
          { day: 4, title: 'Lower — Heavy (no class)', type: 'strength', duration: 45, description: 'Back squat 5×3, deadlift 3×3, hip thrust heavy.' },
          { day: 5, title: 'Rest / Light (open mat)', type: 'recovery', duration: 15, description: 'Rest or 10 min mobility.' },
          { day: 6, title: 'Conditioning — Maintain', type: 'conditioning', duration: 25, description: 'Off day. Moderate bike + core.' },
          { day: 0, title: 'Power + Recovery', type: 'strength', duration: 35, description: 'Light explosive work (jumps, throws) + mobility.' },
        ],
      },
      {
        name: 'Deload', weeks: '8–8', focus: 'Cut volume, stay sharp, peak for comp day',
        weeklySchedule: [
          { day: 1, title: 'Primer (BJJ tonight)', type: 'strength', duration: 20, description: 'A few crisp sets — light bench 2×5, band work. Prime, do not tire.' },
          { day: 2, title: 'Easy Movement', type: 'recovery', duration: 20, description: 'Walk, mobility, light stretch.' },
          { day: 3, title: 'Mobility (BJJ tonight)', type: 'recovery', duration: 15, description: 'Hip and shoulder mobility only.' },
          { day: 4, title: 'Active Rest (no class)', type: 'recovery', duration: 20, description: 'Foam roll, light stretch.' },
          { day: 5, title: 'Final Primer', type: 'strength', duration: 15, description: 'A handful of explosive reps to feel snappy.' },
          { day: 6, title: 'Rest', type: 'recovery', duration: 0, description: 'Rest. Eat well, hydrate, sleep.' },
          { day: 0, title: 'Rest', type: 'recovery', duration: 0, description: 'Competition day — rest or travel.' },
        ],
      },
    ]),
  },
];

// ── Starter stretching plan (ExercisePlan) ────────────────────────────────────
// For someone who has never stretched consistently: 8 holds, one per side where it
// matters, about 10 minutes with the changeovers. Items name exercises; exerciseId
// is looked up per account at seed time because ids differ between databases.
// `sets` is the number of holds (2 = once each side); `duration` is seconds per hold.
const SEED_EXERCISE_PLANS = [
  {
    name: 'Daily Starter Stretch (10 min)',
    type: 'stretch',
    description: 'Eight easy holds for hips, hamstrings, chest, shoulders, upper back, calves and neck. Hold each for 30 seconds, once on each side, breathing slowly. Mild stretch only: it should never hurt. Do it every day, after a walk or a workout, or just before bed.',
    items: [
      { name: 'Half-Kneeling Hip Flexor Stretch', sets: 2, reps: null, duration: 30, notes: 'Hips. Once each side.' },
      { name: 'Supine Hamstring Stretch',         sets: 2, reps: null, duration: 30, notes: 'Hamstrings. Once each side; a towel works as a strap.' },
      { name: 'Supine Piriformis Stretch',        sets: 2, reps: null, duration: 30, notes: 'Hips and glutes. Once each side.' },
      { name: 'Doorway Chest Stretch',            sets: 2, reps: null, duration: 30, notes: 'Chest. Once each side.' },
      { name: 'Cross-Body Shoulder Stretch',      sets: 2, reps: null, duration: 30, notes: 'Shoulders. Once each side.' },
      { name: 'Thoracic Open Book',               sets: 2, reps: null, duration: 30, notes: 'Upper back. Slow rotation, hold at the end. Once each side.' },
      { name: 'Standing Calf Stretch (Wall)',     sets: 2, reps: null, duration: 30, notes: 'Calves. Heel down, once each side.' },
      { name: 'Upper Trap Stretch',               sets: 2, reps: null, duration: 30, notes: 'Neck. Ear toward shoulder, once each side.' },
    ],
  },
  // ── Daily-stretch presets ────────────────────────────────────────────────
  // Starting points for the user's "daily stretches" list (api/daily-stretches.js).
  // Loading one COPIES its items into the user's own list, so editing the list
  // never changes these. `sets` is holds, 2 = once each side, 1 = a single hold.
  // Every name must exist in SEED_EXERCISES (a test enforces it).
  {
    name: 'Desk Worker Posture Stretch',
    type: 'stretch',
    description: 'For a day spent sitting: neck, chest, upper back and the hip flexors that stay bent in a chair. About 5 minutes.',
    items: [
      { name: 'Upper Trap Stretch',               sets: 2, reps: null, duration: 30, notes: 'Neck.' },
      { name: 'Levator Scapulae Stretch',         sets: 2, reps: null, duration: 30, notes: 'Neck and shoulder blade.' },
      { name: 'Doorway Chest Stretch',            sets: 2, reps: null, duration: 30, notes: 'Chest.' },
      { name: 'Thoracic Open Book',               sets: 2, reps: null, duration: 30, notes: 'Upper back.' },
      { name: 'Half-Kneeling Hip Flexor Stretch', sets: 2, reps: null, duration: 30, notes: 'Hip flexors.' },
    ],
  },
  {
    name: 'Hips & Lower Body Stretch (BJJ)',
    type: 'stretch',
    description: 'Hip flexors, piriformis, adductors, hamstrings and glutes: the range guard work and passing ask for. About 8 minutes.',
    items: [
      { name: 'Half-Kneeling Hip Flexor Stretch', sets: 2, reps: null, duration: 45, notes: 'Hip flexors.' },
      { name: 'Supine Piriformis Stretch',        sets: 2, reps: null, duration: 45, notes: 'Piriformis.' },
      { name: 'Frog Stretch',                     sets: 1, reps: null, duration: 45, notes: 'Adductors. One hold.' },
      { name: 'Butterfly Stretch',                sets: 1, reps: null, duration: 45, notes: 'Adductors. One hold.' },
      { name: 'Supine Hamstring Stretch',         sets: 2, reps: null, duration: 45, notes: 'Hamstrings.' },
      { name: 'Pigeon Stretch',                   sets: 2, reps: null, duration: 45, notes: 'Glutes.' },
    ],
  },
  {
    name: 'Upper Body & Shoulders Stretch',
    type: 'stretch',
    description: 'Chest, shoulders, arms, wrists and lats, for after pressing, pulling or gripping. About 7 minutes.',
    items: [
      { name: 'Doorway Chest Stretch',            sets: 2, reps: null, duration: 30, notes: 'Chest.' },
      { name: 'Cross-Body Shoulder Stretch',      sets: 2, reps: null, duration: 30, notes: 'Rear shoulder.' },
      { name: 'Sleeper Stretch',                  sets: 2, reps: null, duration: 45, notes: 'Shoulder rotation. Gentle pressure only.' },
      { name: 'Overhead Triceps Stretch',         sets: 2, reps: null, duration: 30, notes: 'Triceps.' },
      { name: 'Wall Biceps Stretch',              sets: 2, reps: null, duration: 30, notes: 'Biceps.' },
      { name: 'Doorway Wrist Stretch',            sets: 2, reps: null, duration: 30, notes: 'Forearms and wrists.' },
      { name: "Child's Pose",                     sets: 1, reps: null, duration: 45, notes: 'Lats. One hold.' },
    ],
  },
  {
    name: 'Quick 5 Minute Stretch',
    type: 'stretch',
    description: 'Five holds of 30 seconds a side that cover the tightest places. When there is only five minutes.',
    items: [
      { name: 'Half-Kneeling Hip Flexor Stretch', sets: 2, reps: null, duration: 30, notes: 'Hips.' },
      { name: 'Supine Hamstring Stretch',         sets: 2, reps: null, duration: 30, notes: 'Hamstrings.' },
      { name: 'Doorway Chest Stretch',            sets: 2, reps: null, duration: 30, notes: 'Chest.' },
      { name: 'Thoracic Open Book',               sets: 2, reps: null, duration: 30, notes: 'Upper back.' },
      { name: 'Upper Trap Stretch',               sets: 2, reps: null, duration: 30, notes: 'Neck.' },
    ],
  },
];

// ── Seed content refresh ─────────────────────────────────────────────────────
// Seeding inserts by name and never revisits a row, so a corrected seed would never reach an
// account that already has the exercise. seedData() therefore also refreshes the CONTENT of
// existing non-custom seed rows: instructions and videoUrl, matched by exact seed name.
// SEED_CONTENT_VERSION is a hash of exactly that content, so it moves whenever (and only when)
// a seed's content changes and nobody has to remember to bump it. An account that has already
// applied this version skips the whole pass after one UserSettings read.
// Nothing here inserts, deletes or touches a custom row, a logged set, a PR or a template.
const SEED_CONTENT_KEY = 'exerciseSeedContent';
const SEED_CONTENT_VERSION = crypto.createHash('sha1')
  .update(JSON.stringify(SEED_EXERCISES.map(e => [e.name, e.instructions ?? null, e.videoUrl ?? null])))
  .digest('hex').slice(0, 12);

// ── Per-user database factory ─────────────────────────────────────────────────

const getDatabase = (username) => {
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(require('./lib/dataDir')(), `${username}_health.sqlite`),
        logging: false
    });

    // ── Existing models ────────────────────────────────────────────────────────

    const WeightEntry = sequelize.define('WeightEntry', {
        date:   { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
        weight: { type: DataTypes.FLOAT,    allowNull: false },
        unit:   { type: DataTypes.ENUM('kg', 'lbs'), allowNull: false, defaultValue: 'lbs' },
        notes:  { type: DataTypes.TEXT,     allowNull: true },
    });

    const Exercise = sequelize.define('Exercise', {
        date:     { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
        type:     { type: DataTypes.STRING,   allowNull: false },
        duration: { type: DataTypes.INTEGER,  allowNull: false },
        calories: { type: DataTypes.INTEGER,  allowNull: true },
        distance: { type: DataTypes.FLOAT,    allowNull: true },
        notes:    { type: DataTypes.TEXT,     allowNull: true },
    });

    const Meal = sequelize.define('Meal', {
        date:        { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
        time:        { type: DataTypes.TIME,     allowNull: false },
        mealType:    { type: DataTypes.ENUM('breakfast', 'lunch', 'dinner', 'snack'), allowNull: false },
        description: { type: DataTypes.TEXT,     allowNull: false },
        calories:    { type: DataTypes.INTEGER,  allowNull: true },
        protein:     { type: DataTypes.FLOAT,    allowNull: true },
        carbs:       { type: DataTypes.FLOAT,    allowNull: true },
        fats:        { type: DataTypes.FLOAT,    allowNull: true },
        notes:       { type: DataTypes.TEXT,     allowNull: true },
    });

    const Goal = sequelize.define('Goal', {
        type:         { type: DataTypes.ENUM('weight', 'exercise', 'calories'), allowNull: false },
        targetValue:  { type: DataTypes.FLOAT,    allowNull: false },
        currentValue: { type: DataTypes.FLOAT,    allowNull: true },
        deadline:     { type: DataTypes.DATEONLY, allowNull: true },
        description:  { type: DataTypes.TEXT,     allowNull: true },
        completed:    { type: DataTypes.BOOLEAN,  defaultValue: false },
        // Added for goal-driven coaching. Skill/strength goals use type 'exercise'
        // with an exerciseName; progression holds the step plan the coach follows.
        title:        { type: DataTypes.STRING,   allowNull: true },  // e.g. "Handstand", "Leg Press 400"
        exerciseName: { type: DataTypes.STRING,   allowNull: true },  // the exercise/skill this goal targets
        unit:         { type: DataTypes.STRING,   allowNull: true },  // 'lbs' | 'reps' | 'sec' | …
        progression:  { type: DataTypes.TEXT,     allowNull: true },  // progression steps / accessory plan
        // Active goals (api/goals.js is the one definition of "active"). `completed`
        // stays for old readers and is kept equal to status === 'done' on every write.
        status:       { type: DataTypes.STRING,   allowNull: false, defaultValue: 'active' }, // active | paused | done
        priority:     { type: DataTypes.INTEGER,  allowNull: true },   // lower = higher; null sorts last
        kind:         { type: DataTypes.STRING,   allowNull: true },   // strength | skill | mobility | body_comp | nutrition | habit | other
        inBrief:      { type: DataTypes.BOOLEAN,  allowNull: false, defaultValue: true },  // include in the Discord morning brief
        nudge:        { type: DataTypes.BOOLEAN,  allowNull: false, defaultValue: false }, // eligible for nudges / check-ins
    });

    const Routine = sequelize.define('Routine', {
        name:  { type: DataTypes.STRING, allowNull: false },
        type:  { type: DataTypes.STRING, allowNull: false, defaultValue: 'warmup' },
        notes: { type: DataTypes.TEXT,   allowNull: true },
        items: { type: DataTypes.TEXT,   allowNull: true, defaultValue: '[]' },
    });

    const ScheduleProfile = sequelize.define('ScheduleProfile', {
        workDays:       { type: DataTypes.TEXT, allowNull: true },
        workShiftStart: { type: DataTypes.STRING, allowNull: true },
        workShiftEnd:   { type: DataTypes.STRING, allowNull: true },
        bjjDays:        { type: DataTypes.TEXT, allowNull: true },
        muayThaiDays:   { type: DataTypes.TEXT, allowNull: true },
        openMatDays:    { type: DataTypes.TEXT, allowNull: true },
    });

    const Competition = sequelize.define('Competition', {
        name:                 { type: DataTypes.STRING,   allowNull: false },
        sport:                { type: DataTypes.STRING,   allowNull: false, defaultValue: 'other' },
        date:                 { type: DataTypes.DATEONLY, allowNull: false },
        location:             { type: DataTypes.STRING,   allowNull: true },
        weightClass:          { type: DataTypes.STRING,   allowNull: true },
        registrationDeadline: { type: DataTypes.DATEONLY, allowNull: true },
        notes:                { type: DataTypes.TEXT,     allowNull: true },
        isActive:             { type: DataTypes.BOOLEAN,  defaultValue: true },
        result:               { type: DataTypes.STRING,   allowNull: true },
    });

    const TrainingSession = sequelize.define('TrainingSession', {
        date:            { type: DataTypes.DATEONLY, allowNull: false },
        type:            { type: DataTypes.STRING,   allowNull: false },
        title:           { type: DataTypes.STRING,   allowNull: true },
        plannedDuration: { type: DataTypes.INTEGER,  allowNull: true },
        status:          { type: DataTypes.STRING,   allowNull: false, defaultValue: 'planned' },
        actualDuration:  { type: DataTypes.INTEGER,  allowNull: true },
        effort:          { type: DataTypes.INTEGER,  allowNull: true },
        energy:          { type: DataTypes.INTEGER,  allowNull: true },
        notes:           { type: DataTypes.TEXT,     allowNull: true },
        competitionId:   { type: DataTypes.INTEGER,  allowNull: true },
        missedReason:    { type: DataTypes.STRING,   allowNull: true },
    });

    // ── New models ─────────────────────────────────────────────────────────────

    // Shared exercise library (seeded on first login)
    const ExerciseDefinition = sequelize.define('ExerciseDefinition', {
        name:             { type: DataTypes.STRING, allowNull: false },
        category:         { type: DataTypes.STRING, allowNull: false }, // strength | conditioning | cardio | mma | bjj | muay_thai
        equipment:        { type: DataTypes.STRING, allowNull: false }, // barbell | dumbbell | cable_machine | machine | bodyweight | bag | pads | cardio_machine | none
        primaryMuscles:   { type: DataTypes.TEXT,   allowNull: true },  // JSON array
        secondaryMuscles: { type: DataTypes.TEXT,   allowNull: true },  // JSON array
        instructions:     { type: DataTypes.TEXT,   allowNull: true },
        videoUrl:         { type: DataTypes.STRING, allowNull: true },
        isCustom:         { type: DataTypes.BOOLEAN, defaultValue: false },
    });

    // A logged workout session
    const WorkoutSession = sequelize.define('WorkoutSession', {
        date:      { type: DataTypes.DATEONLY, allowNull: false },
        type:      { type: DataTypes.STRING,   allowNull: false }, // strength | conditioning | mma | bjj | muay_thai | recovery
        title:     { type: DataTypes.STRING,   allowNull: true },
        startedAt: { type: DataTypes.DATE,     allowNull: true },
        finishedAt:{ type: DataTypes.DATE,     allowNull: true },
        duration:  { type: DataTypes.INTEGER,  allowNull: true },  // minutes
        effort:    { type: DataTypes.INTEGER,  allowNull: true },  // 1–5
        notes:     { type: DataTypes.TEXT,     allowNull: true },
        status:    { type: DataTypes.STRING,   allowNull: false, defaultValue: 'active' }, // active | finished
    });

    // Individual set within a workout session
    const WorkoutSet = sequelize.define('WorkoutSet', {
        sessionId:     { type: DataTypes.INTEGER, allowNull: false },
        exerciseId:    { type: DataTypes.INTEGER, allowNull: true },   // FK to ExerciseDefinition
        exerciseName:  { type: DataTypes.STRING,  allowNull: false },  // denormalised
        exerciseOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // which exercise in the session
        setNumber:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }, // which set of this exercise
        reps:          { type: DataTypes.INTEGER, allowNull: true },
        weight:        { type: DataTypes.FLOAT,   allowNull: true },
        weightUnit:    { type: DataTypes.STRING,  allowNull: false, defaultValue: 'lbs' },
        duration:      { type: DataTypes.INTEGER, allowNull: true },   // seconds, for timed sets
        distance:      { type: DataTypes.FLOAT,   allowNull: true },
        distanceUnit:  { type: DataTypes.STRING,  allowNull: true },
        rpe:           { type: DataTypes.INTEGER, allowNull: true },   // 1–10
        notes:         { type: DataTypes.TEXT,    allowNull: true },
        failed:        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, // marked failed by the owner
        failPoint:     { type: DataTypes.STRING,  allowNull: true },   // bottom | middle | top | grip, only when failed
    });

    // Training plan template
    const TrainingPlan = sequelize.define('TrainingPlan', {
        name:          { type: DataTypes.STRING,  allowNull: false },
        sport:         { type: DataTypes.STRING,  allowNull: false }, // mma | bjj | muay_thai | strength | general
        durationWeeks: { type: DataTypes.INTEGER, allowNull: false },
        description:   { type: DataTypes.TEXT,    allowNull: true },
        phases:        { type: DataTypes.TEXT,    allowNull: true },  // JSON
        isCustom:      { type: DataTypes.BOOLEAN, defaultValue: false },
    });

    // User following a plan
    const TrainingPlanAssignment = sequelize.define('TrainingPlanAssignment', {
        planId:      { type: DataTypes.INTEGER, allowNull: false },
        startDate:   { type: DataTypes.DATEONLY, allowNull: false },
        status:      { type: DataTypes.STRING,  allowNull: false, defaultValue: 'active' }, // active | completed | paused
    });

    // Saved workout template (reusable workout card)
    const WorkoutTemplate = sequelize.define('WorkoutTemplate', {
        name:        { type: DataTypes.STRING, allowNull: false },
        type:        { type: DataTypes.STRING, allowNull: false, defaultValue: 'strength' },
        description: { type: DataTypes.TEXT,   allowNull: true },
        // JSON array of { exerciseId, exerciseName, defaultSets, defaultReps, defaultDuration, notes }
        exercises:   { type: DataTypes.TEXT,   allowNull: false, defaultValue: '[]' },
        isCustom:    { type: DataTypes.BOOLEAN, defaultValue: true },
    });

    // Known session titles — "Push", "Pull", "Legs" and the rest of a typical
    // split. Exists so the Logs page shows a real title instead of whatever
    // got typed that day, or a single exercise name standing in for the whole
    // session. `name` is not marked unique: uniqueness is enforced canonically
    // (case/punctuation/plural insensitive) in api/session-titles.js, the same
    // way exercise names are, and a bare DB-level exact-string constraint
    // would catch far less than that while still letting "pull" and "Pull."
    // duplicate each other.
    const SessionTitle = sequelize.define('SessionTitle', {
        name: { type: DataTypes.STRING, allowNull: false },
    });

    // "When I say X I mean Y" — an exercise name question answered once, kept.
    // Added 2026-10-11 (HANDOFF item 34): "Bench press" was asked about every
    // single time, because the answer lived only in that chat turn. `key` is
    // exercise-names.js canonicalKey() of what was typed; `name` is the
    // account's own exercise it means. Additive — sync() creates the table.
    const ExerciseAlias = sequelize.define('ExerciseAlias', {
        key:  { type: DataTypes.STRING, allowNull: false },
        name: { type: DataTypes.STRING, allowNull: false },
    });

    // Personal records — best performance per exercise over time
    const PersonalRecord = sequelize.define('PersonalRecord', {
        exerciseName: { type: DataTypes.STRING,  allowNull: false },
        reps:         { type: DataTypes.INTEGER, allowNull: true },   // max reps in a set
        sets:         { type: DataTypes.INTEGER, allowNull: true },   // how many sets at that count
        weight:       { type: DataTypes.FLOAT,   allowNull: true },   // null = bodyweight
        weightUnit:   { type: DataTypes.STRING,  allowNull: false, defaultValue: 'lbs' },
        durationSecs: { type: DataTypes.INTEGER, allowNull: true },   // for timed exercises (plank hold)
        date:         { type: DataTypes.DATEONLY, allowNull: false },
        notes:        { type: DataTypes.TEXT,    allowNull: true },
    }, { tableName: 'PersonalRecords' });


    // ── Skill tree, fitness tests, benchmarks (additive: sync() creates them) ──
    // The tree itself is DATA in content/calisthenics/skill-tree.json; these
    // tables hold only what THIS user did. A skill is achieved when an attempt
    // with result 'succeeded' exists - derived, never stored (api/skill-tree.js).
    const SkillAttempt = sequelize.define('SkillAttempt', {
        skillId: { type: DataTypes.STRING,   allowNull: false },
        date:    { type: DataTypes.DATEONLY, allowNull: false },
        result:  { type: DataTypes.STRING,   allowNull: false },   // 'succeeded' | 'not_yet'
        reps:    { type: DataTypes.INTEGER,  allowNull: true },
        seconds: { type: DataTypes.INTEGER,  allowNull: true },
        notes:   { type: DataTypes.TEXT,     allowNull: true },
    }, { tableName: 'SkillAttempts' });

    // One row per measured item per test. `item` is a fitness-tests.js id, or a
    // slug for a custom benchmark; `detail` is JSON (treadmill protocol, side...).
    const FitnessResult = sequelize.define('FitnessResult', {
        item:    { type: DataTypes.STRING,   allowNull: false },
        battery: { type: DataTypes.STRING,   allowNull: true },
        value:   { type: DataTypes.FLOAT,    allowNull: false },
        unit:    { type: DataTypes.STRING,   allowNull: true },
        date:    { type: DataTypes.DATEONLY, allowNull: false },
        detail:  { type: DataTypes.TEXT,     allowNull: true },
        notes:   { type: DataTypes.TEXT,     allowNull: true },
    }, { tableName: 'FitnessResults' });

    const Benchmark = sequelize.define('Benchmark', {
        item:       { type: DataTypes.STRING,  allowNull: false, unique: true },
        name:       { type: DataTypes.STRING,  allowNull: false },
        short:      { type: DataTypes.STRING,  allowNull: true },
        unit:       { type: DataTypes.STRING,  allowNull: true },
        better:     { type: DataTypes.STRING,  allowNull: false, defaultValue: 'higher' },
        focus:      { type: DataTypes.STRING,  allowNull: true },
        everyWeeks: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        dayOfWeek:  { type: DataTypes.INTEGER, allowNull: true },   // null = the user's benchmark day
        position:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        enabled:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        seedKey:    { type: DataTypes.STRING,  allowNull: true },
    }, { tableName: 'Benchmarks' });

    // Which defaults have ever been created for this user. A default that is in
    // here is never re-created, which is what makes a deletion stick.
    const BenchmarkSeed = sequelize.define('BenchmarkSeed', {
        seedKey: { type: DataTypes.STRING, primaryKey: true },
    }, { tableName: 'BenchmarkSeeds', timestamps: false });

    // Small per-user key/value: equipment, focus, benchmark day, reminder state.
    const UserSetting = sequelize.define('UserSetting', {
        key:   { type: DataTypes.STRING, primaryKey: true },
        value: { type: DataTypes.TEXT },
    }, { tableName: 'UserSettings', timestamps: false });

    // Daily nutrition targets (api/nutrition-targets.js). One row (id 1) per account file,
    // so no owner column. A new table: sync() creates it, nothing existing is altered.
    const NutritionTarget = sequelize.define('NutritionTarget', {
        id:        { type: DataTypes.INTEGER, primaryKey: true },
        calories:  { type: DataTypes.INTEGER, allowNull: true },
        protein:   { type: DataTypes.INTEGER, allowNull: true },
        carbs:     { type: DataTypes.INTEGER, allowNull: true },
        fats:      { type: DataTypes.INTEGER, allowNull: true },
        source:    { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'manual' },
        updatedOn: { type: DataTypes.DATEONLY, allowNull: true },
    }, { tableName: 'NutritionTargets', timestamps: false });

    // Where you train, and what is there (GYMS-AND-EQUIPMENT.md phase 1). Per-user file,
    // so no owner column. `slug` is what plan templates target ("home", "park", "gym");
    // `equipmentId` is an id from content/equipment/catalogue.json - the ONE list - kept
    // as a plain string so a catalogue edit needs no migration. A paused gym is kept off
    // plan suggestions (active=false; pausedUntil is the ET resume date, if any); its
    // logged history is untouched. New tables only: sync() creates them, nothing altered.
    const Gym = sequelize.define('Gym', {
        slug:        { type: DataTypes.STRING,  allowNull: false, unique: true },
        name:        { type: DataTypes.STRING,  allowNull: false },
        active:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        pausedUntil: { type: DataTypes.STRING,  allowNull: true },   // YYYY-MM-DD, ET
        notes:       { type: DataTypes.TEXT,    allowNull: true },
        sortOrder:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    });
    const GymEquipment = sequelize.define('GymEquipment', {
        gymId:       { type: DataTypes.INTEGER, allowNull: false },
        equipmentId: { type: DataTypes.STRING,  allowNull: false },
        label:       { type: DataTypes.STRING,  allowNull: true },
        attrs:       { type: DataTypes.TEXT,    allowNull: true },   // JSON: heights, rated load, ...
    }, { indexes: [{ unique: true, fields: ['gymId', 'equipmentId'] }] });

    // Ongoing training limits (injury, travel, equipment) that adapt every suggested workout
    // until cleared. Health owns them (api/constraints.js); cortex used to keep one in its
    // own settings. A new table only: sync() creates it, nothing existing is altered.
    // `until` is an ET date (YYYY-MM-DD); a row past it is expired but kept as history.
    const WorkoutConstraint = sequelize.define('WorkoutConstraint', {
        text:      { type: DataTypes.TEXT,    allowNull: false },
        equipment: { type: DataTypes.STRING,  allowNull: true },
        until:     { type: DataTypes.STRING,  allowNull: true },
        active:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        source:    { type: DataTypes.STRING,  allowNull: true },   // web | cortex | cortex-import
        clearedAt: { type: DataTypes.DATE,    allowNull: true },
    });

    // Exercise plan builder (mobility / warmup / cooldown / circuit)
    const ExercisePlan = sequelize.define('ExercisePlan', {
        name:        { type: DataTypes.STRING, allowNull: false },
        type:        { type: DataTypes.STRING, allowNull: false, defaultValue: 'mobility' },
        description: { type: DataTypes.TEXT,   allowNull: true },
        // JSON array of { exerciseId, name, sets, reps, duration, side, notes }
        items:       { type: DataTypes.TEXT,   allowNull: false, defaultValue: '[]' },
    });

    // Remembers which USDA FoodData Central record an ingredient string resolved
    // to, so a name is matched once and then reused.
    //
    // The cache is the feature, not an optimisation. USDA returns dozens of hits
    // for "heavy cream" across Foundation, SR Legacy and Branded datasets, and the
    // top result is frequently a branded product with different macros. Picking
    // wrong yields a confidently wrong number, which is worse than a blank —
    // nutrition coaching reads these as fact. Caching the chosen fdcId means a bad
    // match is corrected once rather than re-guessed on every log.
    const IngredientMatch = sequelize.define('IngredientMatch', {
        // Lowercased, trimmed ingredient string as it appears in the recipe.
        query:      { type: DataTypes.STRING,  allowNull: false, unique: true },
        fdcId:      { type: DataTypes.INTEGER, allowNull: true },   // null = known-unmatchable
        foodName:   { type: DataTypes.STRING,  allowNull: true },   // what USDA called it
        dataType:   { type: DataTypes.STRING,  allowNull: true },   // Foundation | SR Legacy | Branded
        // Per-100g macros, cached so logging a meal needs no network call at all
        // once every ingredient has been seen before.
        kcal:       { type: DataTypes.FLOAT,   allowNull: true },
        protein:    { type: DataTypes.FLOAT,   allowNull: true },
        carbs:      { type: DataTypes.FLOAT,   allowNull: true },
        fats:       { type: DataTypes.FLOAT,   allowNull: true },
        // Set true when a human confirmed it; those are never re-resolved.
        confirmed:  { type: DataTypes.BOOLEAN, defaultValue: false },
    });

    // A meal you eat the same way repeatedly, saved so it is one click instead of
    // seven fields — and so the macros are the same number every time rather than
    // re-estimated on each log.
    //
    // `ingredients` holds slots, not a recipe: each carries the role ("protein
    // powder"), the amount ("2 scoops"), and optionally the specific product
    // currently being used with the macros off its label. See api/meal-template.js
    // for why the product is stored per slot and not merged into the ingredient
    // name — briefly, the tub changes far more often than the shake does, and the
    // two must be editable apart.
    const MealTemplate = sequelize.define('MealTemplate', {
        name:        { type: DataTypes.STRING, allowNull: false },
        mealType:    { type: DataTypes.ENUM('breakfast', 'lunch', 'dinner', 'snack'), allowNull: false, defaultValue: 'snack' },
        ingredients: { type: DataTypes.TEXT,   allowNull: false, defaultValue: '[]' },
        notes:       { type: DataTypes.TEXT,   allowNull: true },
        archived:    { type: DataTypes.BOOLEAN, defaultValue: false },
    });

    // A batch cooked from a saved meal: "I made three of these on Sunday."
    //
    // Separate from MealTemplate, and a SNAPSHOT rather than a reference, which
    // is the whole point. A template is deliberately live — the tub of protein
    // behind the shake changes whenever something else is on sale, and swapping
    // it is one field on one slot so every FUTURE log is right. A batch is the
    // opposite: those portions are already in the fridge, made with whatever was
    // open that day. Recomputing them from the template later would silently
    // restate Sunday's dinner in terms of Thursday's yogurt.
    //
    // So `slots` and the per-portion macros are frozen here at prep time, and
    // logging a portion copies them out rather than recalculating. It also means
    // a batch outlives the template it came from: rename it, edit it, delete it,
    // and the three portions still in the fridge still log correctly.
    const MealPrep = sequelize.define('MealPrep', {
        name:       { type: DataTypes.STRING, allowNull: false },
        // Nullable on purpose: the template may be edited or deleted while
        // portions remain. Kept only to offer "prep this again".
        templateId: { type: DataTypes.INTEGER, allowNull: true },
        mealType:   { type: DataTypes.ENUM('breakfast', 'lunch', 'dinner', 'snack'), allowNull: false, defaultValue: 'snack' },
        portions:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        portionsLeft: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        preppedOn:  { type: DataTypes.DATEONLY, allowNull: false },
        // Per portion, not per batch — that is the number every log needs, and
        // storing the batch total would mean re-dividing on each log by a
        // `portions` that can be corrected after the fact.
        kcal:    { type: DataTypes.FLOAT, allowNull: true },
        protein: { type: DataTypes.FLOAT, allowNull: true },
        carbs:   { type: DataTypes.FLOAT, allowNull: true },
        fats:    { type: DataTypes.FLOAT, allowNull: true },
        // What went in, and how the number was arrived at. Same reasoning as
        // Meal.notes: a total that cannot be explained later is one that gets
        // doubted and then ignored.
        slots:      { type: DataTypes.TEXT, allowNull: false, defaultValue: '[]' },
        provenance: { type: DataTypes.TEXT, allowNull: true },
        notes:      { type: DataTypes.TEXT, allowNull: true },
    });

    // ── Seed function ──────────────────────────────────────────────────────────

    async function seedData() {
        // Additive merge: insert any seed exercise whose name isn't in the DB yet
        const existingNames = new Set(
            (await ExerciseDefinition.findAll({ attributes: ['name'] })).map(e => e.name)
        );
        const toInsert = SEED_EXERCISES.filter(e => !existingNames.has(e.name));
        if (toInsert.length > 0) {
            await ExerciseDefinition.bulkCreate(
                toInsert.map(e => ({
                    ...e,
                    primaryMuscles:   JSON.stringify(e.primaryMuscles),
                    secondaryMuscles: JSON.stringify(e.secondaryMuscles),
                }))
            );
        }
        await refreshSeedContent();
            const routineCount = await Routine.count();
            if (routineCount === 0) {
              await Routine.bulkCreate(
                SEED_ROUTINES.map(r => ({
                  name: r.name,
                  type: r.type,
                  notes: r.notes,
                  items: JSON.stringify(r.items),
                }))
              );
            }
        // Keep the SEEDED plans in sync by name: insert new ones, and refresh the
        // content of existing NON-custom seeds (so a fixed plan — e.g. gym S&C instead
        // of mat drills — reaches accounts that already have it, and an active
        // assignment keeps pointing at the same row/id with the new phases). A plan the
        // user built (isCustom) is never touched.
        for (const seed of SEED_PLANS) {
            const [row, created] = await TrainingPlan.findOrCreate({ where: { name: seed.name }, defaults: seed });
            if (!created && !row.isCustom) {
                await row.update({
                    sport: seed.sport, durationWeeks: seed.durationWeeks,
                    description: seed.description, phases: seed.phases,
                });
            }
        }

        // Starter exercise plans: additive by name, and never overwritten (ExercisePlan has
        // no isCustom flag, so a plan the user has edited or renamed must be left alone).
        // Runs after the exercise merge above so every item can be matched to its id.
        const idByName = new Map((await ExerciseDefinition.findAll({ attributes: ['id', 'name'] })).map(e => [e.name, e.id]));
        for (const p of SEED_EXERCISE_PLANS) {
            await ExercisePlan.findOrCreate({
                where: { name: p.name },
                defaults: {
                    name: p.name, type: p.type, description: p.description,
                    items: JSON.stringify(p.items.map(i => ({ exerciseId: idByName.get(i.name) ?? null, ...i }))),
                },
            });
        }

        // Seed workout templates — additive by slug stored in name field
        const existingTemplateNames = new Set(
            (await WorkoutTemplate.findAll({ attributes: ['name'] })).map(t => t.name)
        );
        const templatesToInsert = SEED_WORKOUT_TEMPLATES.filter(t => !existingTemplateNames.has(t.slug));
        if (templatesToInsert.length > 0) {
            await WorkoutTemplate.bulkCreate(templatesToInsert.map(t => ({
                name:        t.slug,
                type:        t.type,
                description: JSON.stringify({ label: t.name, location: t.location, warmup: t.warmup, cooldown: t.cooldown }),
                exercises:   JSON.stringify(t.exercises),
                isCustom:    false,
            })));
        }
    }

    // Bring existing non-custom seed rows up to the current seed text and video links.
    // Never throws: a failure is logged, the marker is left unset so the next login retries,
    // and the app starts regardless. Each update is idempotent, so a half-finished pass is safe.
    async function refreshSeedContent() {
        try {
            const mark = await UserSetting.findByPk(SEED_CONTENT_KEY);
            if (mark && mark.value === SEED_CONTENT_VERSION) return;
            const byName = new Map();
            for (const r of await ExerciseDefinition.findAll()) {
                if (r.isCustom) continue;
                if (!byName.has(r.name)) byName.set(r.name, []);
                byName.get(r.name).push(r);
            }
            for (const seed of SEED_EXERCISES) {
                const next = { instructions: seed.instructions ?? null, videoUrl: seed.videoUrl ?? null };
                for (const row of byName.get(seed.name) || []) {
                    if (row.instructions !== next.instructions || row.videoUrl !== next.videoUrl) await row.update(next);
                }
            }
            await UserSetting.upsert({ key: SEED_CONTENT_KEY, value: SEED_CONTENT_VERSION });
        } catch (e) {
            console.error('seed content refresh failed:', e.message);
        }
    }

    // Idempotent, additive-only migrations for tables that predate new columns.
    // health uses plain sequelize.sync() (no alter), so new nullable columns must
    // be added by hand. ADD COLUMN is safe in SQLite; we swallow "duplicate column".
    async function migrate() {
        const adds = [
            ['Goals', 'title',        'VARCHAR(255)'],
            ['Goals', 'exerciseName', 'VARCHAR(255)'],
            ['Goals', 'unit',         'VARCHAR(32)'],
            ['Goals', 'progression',  'TEXT'],
            ['Goals', 'status',       "VARCHAR(16) NOT NULL DEFAULT 'active'"],
            ['Goals', 'priority',     'INTEGER'],
            ['Goals', 'kind',         'VARCHAR(32)'],
            ['Goals', 'inBrief',      'TINYINT(1) NOT NULL DEFAULT 1'],
            ['Goals', 'nudge',        'TINYINT(1) NOT NULL DEFAULT 0'],
            // Coaching (api/coaching.js): a set the owner marked failed, and where it gave out.
            ['WorkoutSets', 'failed',    'TINYINT(1) NOT NULL DEFAULT 0'],
            ['WorkoutSets', 'failPoint', 'VARCHAR(16)'],
        ];
        for (const [table, col, type] of adds) {
            try {
                await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN "${col}" ${type}`);
            } catch (e) {
                if (!/duplicate column|already exists/i.test(e.message || '')) {
                    console.error(`migrate: ${table}.${col} failed:`, e.message);
                }
            }
        }
        // Backfill: a goal completed before `status` existed is 'done'. Only rows still at
        // the column default are touched, so a rerun (or a later reopen) changes nothing.
        try {
            await sequelize.query(`UPDATE "Goals" SET "status" = 'done' WHERE "completed" = 1 AND "status" = 'active'`);
        } catch (e) {
            console.error('migrate: Goals.status backfill failed:', e.message);
        }
    }

    return {
        sequelize,
        migrate,
        WeightEntry,
        Exercise,
        Meal,
        Goal,
        Routine,
        ScheduleProfile,
        Competition,
        TrainingSession,
        ExerciseDefinition,
        WorkoutSession,
        WorkoutSet,
        SessionTitle,
        ExerciseAlias,
        TrainingPlan,
        TrainingPlanAssignment,
        WorkoutTemplate,
        ExercisePlan,
        PersonalRecord,
        IngredientMatch,
        MealTemplate,
        MealPrep,
        SkillAttempt,
        FitnessResult,
        Benchmark,
        BenchmarkSeed,
        UserSetting,
        NutritionTarget,
        Gym,
        GymEquipment,
        WorkoutConstraint,
        seedData,
        sequelize,
    };
};

module.exports = getDatabase;
// Exposed for tests and the coverage report; the factory stays the default export.
module.exports.SEED_EXERCISES = SEED_EXERCISES;
module.exports.SEED_CONTENT_VERSION = SEED_CONTENT_VERSION;
module.exports.SEED_WORKOUT_TEMPLATES = SEED_WORKOUT_TEMPLATES;
module.exports.SEED_EXERCISE_PLANS = SEED_EXERCISE_PLANS;
