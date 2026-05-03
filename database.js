const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// ── Seed data ────────────────────────────────────────────────────────────────

const SEED_EXERCISES = [
  // BARBELL
  { name: 'Barbell Back Squat',      category: 'strength',     equipment: 'barbell',        primaryMuscles: ['quads','glutes'],              secondaryMuscles: ['hamstrings','lower_back','core'],   instructions: 'Bar on upper traps. Brace core, sit hips back and down until thighs parallel. Drive through heels.', videoUrl: 'https://www.youtube.com/watch?v=ultWZbUMPL8' },
  { name: 'Barbell Deadlift',         category: 'strength',     equipment: 'barbell',        primaryMuscles: ['hamstrings','lower_back','glutes'], secondaryMuscles: ['traps','lats','forearms','quads'], instructions: 'Bar over mid-foot. Flatten back, brace hard. Push floor away, lock hips at top.',                 videoUrl: 'https://www.youtube.com/watch?v=op9kVnSso6Q' },
  { name: 'Romanian Deadlift',        category: 'strength',     equipment: 'barbell',        primaryMuscles: ['hamstrings','glutes'],          secondaryMuscles: ['lower_back'],                       instructions: 'Hold bar at hips, soft knee. Hinge back until hamstring stretch, return.',                        videoUrl: null },
  { name: 'Barbell Bench Press',      category: 'strength',     equipment: 'barbell',        primaryMuscles: ['chest'],                       secondaryMuscles: ['front_delts','triceps'],            instructions: 'Lie flat, grip slightly wider than shoulders. Lower to lower chest, press up.',                    videoUrl: 'https://www.youtube.com/watch?v=rT7DgCr-3pg' },
  { name: 'Barbell Overhead Press',   category: 'strength',     equipment: 'barbell',        primaryMuscles: ['front_delts','side_delts'],     secondaryMuscles: ['triceps','traps','upper_chest'],    instructions: 'Bar at shoulder height. Press straight overhead. Lean slightly under bar at lockout.',             videoUrl: 'https://www.youtube.com/watch?v=2yjwXTZQDDI' },
  { name: 'Barbell Bent-Over Row',    category: 'strength',     equipment: 'barbell',        primaryMuscles: ['lats','rhomboids'],             secondaryMuscles: ['biceps','rear_delts','lower_back'], instructions: 'Hinge to ~45°. Row bar to lower chest, lead with elbows, keep back flat.',                        videoUrl: 'https://www.youtube.com/watch?v=vT2GjY_Umpw' },
  { name: 'Barbell Hip Thrust',       category: 'strength',     equipment: 'barbell',        primaryMuscles: ['glutes'],                      secondaryMuscles: ['hamstrings','quads'],               instructions: 'Shoulders on bench, bar across hips. Drive hips to full extension, squeeze glutes.',               videoUrl: null },
  { name: 'Barbell Front Squat',      category: 'strength',     equipment: 'barbell',        primaryMuscles: ['quads'],                       secondaryMuscles: ['glutes','upper_back','core'],       instructions: 'Bar on front delts, elbows high. Squat straight down keeping torso upright.',                     videoUrl: null },
  { name: 'Barbell Good Morning',     category: 'strength',     equipment: 'barbell',        primaryMuscles: ['lower_back','hamstrings'],      secondaryMuscles: ['glutes'],                          instructions: 'Bar on upper back, hinge at hips with soft knees until torso near parallel.',                    videoUrl: null },
  // DUMBBELL
  { name: 'Dumbbell Bench Press',            category: 'strength', equipment: 'dumbbell', primaryMuscles: ['chest'],                  secondaryMuscles: ['front_delts','triceps'],       instructions: 'Lie flat, dumbbells at chest. Press up and slightly in, control descent.',              videoUrl: null },
  { name: 'Incline Dumbbell Press',          category: 'strength', equipment: 'dumbbell', primaryMuscles: ['upper_chest','front_delts'], secondaryMuscles: ['triceps'],                  instructions: 'Bench at 30–45°. Press dumbbells from chest up and slightly together.',                videoUrl: null },
  { name: 'Dumbbell Shoulder Press',         category: 'strength', equipment: 'dumbbell', primaryMuscles: ['front_delts','side_delts'], secondaryMuscles: ['triceps'],                  instructions: 'Seated, dumbbells at shoulder height. Press to lockout, lower with control.',          videoUrl: null },
  { name: 'Dumbbell Lateral Raise',          category: 'strength', equipment: 'dumbbell', primaryMuscles: ['side_delts'],             secondaryMuscles: ['traps'],                      instructions: 'Slight forward lean, raise to shoulder height with soft elbow, thumbs slightly down.',  videoUrl: null },
  { name: 'Dumbbell Rear Delt Fly',          category: 'strength', equipment: 'dumbbell', primaryMuscles: ['rear_delts'],             secondaryMuscles: ['rhomboids','traps'],           instructions: 'Hinge ~90°, raise dumbbells out to sides leading with elbows.',                       videoUrl: null },
  { name: 'Dumbbell Bicep Curl',             category: 'strength', equipment: 'dumbbell', primaryMuscles: ['biceps'],                 secondaryMuscles: ['brachialis'],                 instructions: 'Supinated grip, curl toward shoulders without swinging, lower fully.',                 videoUrl: null },
  { name: 'Dumbbell Hammer Curl',            category: 'strength', equipment: 'dumbbell', primaryMuscles: ['brachialis','biceps'],    secondaryMuscles: ['forearms'],                   instructions: 'Neutral (thumbs up) grip, curl to shoulder, keep elbows pinned.',                     videoUrl: null },
  { name: 'Dumbbell Row',                    category: 'strength', equipment: 'dumbbell', primaryMuscles: ['lats','rhomboids'],       secondaryMuscles: ['biceps','rear_delts'],         instructions: 'Support on bench, row dumbbell to hip, elbow close to body, full stretch at bottom.',  videoUrl: null },
  { name: 'Dumbbell Romanian Deadlift',      category: 'strength', equipment: 'dumbbell', primaryMuscles: ['hamstrings','glutes'],    secondaryMuscles: ['lower_back'],                 instructions: 'Dumbbells in front of thighs, hinge hips back, lower along shins, return.',           videoUrl: null },
  { name: 'Dumbbell Bulgarian Split Squat',  category: 'strength', equipment: 'dumbbell', primaryMuscles: ['quads','glutes'],         secondaryMuscles: ['hamstrings','calves'],         instructions: 'Rear foot elevated on bench. Squat on front leg until rear knee nearly touches floor.', videoUrl: null },
  { name: 'Dumbbell Lunge',                  category: 'strength', equipment: 'dumbbell', primaryMuscles: ['quads','glutes'],         secondaryMuscles: ['hamstrings','calves'],         instructions: 'Step forward, lower rear knee toward floor, push back to start.',                      videoUrl: null },
  { name: 'Goblet Squat',                    category: 'strength', equipment: 'dumbbell', primaryMuscles: ['quads','glutes'],         secondaryMuscles: ['core','adductors'],            instructions: 'Hold dumbbell at chest. Squat deep with elbows inside knees, drive through heels.',   videoUrl: null },
  { name: "Farmer's Carry",                  category: 'strength', equipment: 'dumbbell', primaryMuscles: ['traps','forearms'],       secondaryMuscles: ['core','quads'],               instructions: 'Hold heavy dumbbells at sides, walk with tall posture and tight core.',                videoUrl: null },
  { name: 'Dumbbell Shrug',                  category: 'strength', equipment: 'dumbbell', primaryMuscles: ['traps'],                  secondaryMuscles: ['forearms'],                   instructions: 'Elevate shoulders straight up, hold 1 second, lower fully.',                          videoUrl: null },
  { name: 'Dumbbell Tricep Kickback',        category: 'strength', equipment: 'dumbbell', primaryMuscles: ['triceps'],                secondaryMuscles: [],                             instructions: 'Hinge forward, upper arm parallel to floor, extend forearm back to lockout.',          videoUrl: null },
  // CABLE
  { name: 'Lat Pulldown',          category: 'strength', equipment: 'cable_machine', primaryMuscles: ['lats'],          secondaryMuscles: ['biceps','rhomboids','rear_delts'], instructions: 'Wide grip, lean slightly back. Pull bar to upper chest, squeeze lats, slow return.',       videoUrl: null },
  { name: 'Seated Cable Row',      category: 'strength', equipment: 'cable_machine', primaryMuscles: ['rhomboids','lats'], secondaryMuscles: ['biceps','rear_delts'],           instructions: 'Feet on platform. Pull handle to navel, squeeze shoulder blades, slow return.',           videoUrl: null },
  { name: 'Cable Chest Fly',       category: 'strength', equipment: 'cable_machine', primaryMuscles: ['chest'],         secondaryMuscles: ['front_delts'],                   instructions: 'Cables high. Bring handles together in front of chest with slight elbow bend.',             videoUrl: null },
  { name: 'Cable Tricep Pushdown', category: 'strength', equipment: 'cable_machine', primaryMuscles: ['triceps'],       secondaryMuscles: [],                               instructions: 'High pulley, elbows pinned to sides. Push down to lockout, slow return.',                  videoUrl: null },
  { name: 'Cable Bicep Curl',      category: 'strength', equipment: 'cable_machine', primaryMuscles: ['biceps'],        secondaryMuscles: ['brachialis'],                   instructions: 'Low pulley, underhand grip. Curl to shoulders, elbows pinned.',                            videoUrl: null },
  { name: 'Cable Face Pull',       category: 'strength', equipment: 'cable_machine', primaryMuscles: ['rear_delts'],    secondaryMuscles: ['rhomboids','traps'],             instructions: 'High pulley with rope. Pull to face, hands finishing at ear level, elbows high.',           videoUrl: null },
  { name: 'Cable Lateral Raise',   category: 'strength', equipment: 'cable_machine', primaryMuscles: ['side_delts'],    secondaryMuscles: [],                               instructions: 'Low side pulley. Raise arm to shoulder height with soft elbow, control the return.',        videoUrl: null },
  { name: 'Cable Crunch',          category: 'strength', equipment: 'cable_machine', primaryMuscles: ['abs'],           secondaryMuscles: ['obliques'],                     instructions: 'Kneel facing high pulley, rope behind neck. Crunch elbows toward knees.',                  videoUrl: null },
  { name: 'Wood Chop',             category: 'strength', equipment: 'cable_machine', primaryMuscles: ['obliques','abs'], secondaryMuscles: ['shoulders','lats'],             instructions: 'High pulley to one side. Pull diagonally across body in chopping motion.',                  videoUrl: null },
  // MACHINE
  { name: 'Leg Press',             category: 'strength', equipment: 'machine', primaryMuscles: ['quads','glutes'],    secondaryMuscles: ['hamstrings'],   instructions: 'Feet shoulder-width. Lower until 90°, press through heels, do not lock out.',      videoUrl: null },
  { name: 'Leg Extension',         category: 'strength', equipment: 'machine', primaryMuscles: ['quads'],             secondaryMuscles: [],               instructions: 'Pad above ankles. Extend to near lockout, lower with control.',                    videoUrl: null },
  { name: 'Leg Curl',              category: 'strength', equipment: 'machine', primaryMuscles: ['hamstrings'],        secondaryMuscles: ['calves'],       instructions: 'Pad behind lower leg. Curl heels to glutes, squeeze, lower with control.',          videoUrl: null },
  { name: 'Hip Adductor Machine',  category: 'strength', equipment: 'machine', primaryMuscles: ['adductors'],         secondaryMuscles: ['glutes'],       instructions: 'Legs spread on pads. Bring legs together, hold briefly, return slowly.',            videoUrl: null },
  { name: 'Hip Abductor Machine',  category: 'strength', equipment: 'machine', primaryMuscles: ['abductors','glutes'], secondaryMuscles: [],              instructions: 'Pads on outer thighs. Push legs apart against resistance, return slowly.',          videoUrl: null },
  { name: 'Chest Press Machine',   category: 'strength', equipment: 'machine', primaryMuscles: ['chest'],             secondaryMuscles: ['front_delts','triceps'], instructions: 'Handles at chest height. Press forward to near lockout, control return.',         videoUrl: null },
  { name: 'Shoulder Press Machine',category: 'strength', equipment: 'machine', primaryMuscles: ['front_delts','side_delts'], secondaryMuscles: ['triceps'], instructions: 'Press overhead, control descent back to shoulder level.',                         videoUrl: null },
  { name: 'Seated Calf Raise',     category: 'strength', equipment: 'machine', primaryMuscles: ['calves'],            secondaryMuscles: [],               instructions: 'Pads on lower thighs, balls of feet on edge. Rise as high as possible, lower fully.', videoUrl: null },
  // BODYWEIGHT
  { name: 'Pull-up',           category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['lats'],          secondaryMuscles: ['biceps','rhomboids','rear_delts'], instructions: 'Overhand grip, hang fully. Pull chest toward bar, lower fully.',              videoUrl: null },
  { name: 'Chin-up',           category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['biceps','lats'], secondaryMuscles: ['rhomboids'],                      instructions: 'Underhand grip. Pull chin over bar, lower fully.',                           videoUrl: null },
  { name: 'Push-up',           category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['chest'],         secondaryMuscles: ['triceps','front_delts','core'],   instructions: 'Hands slightly wider than shoulders. Lower chest to floor, press up.',        videoUrl: null },
  { name: 'Diamond Push-up',   category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['triceps'],       secondaryMuscles: ['chest','front_delts'],            instructions: 'Hands close forming diamond shape under chest. Lower and press.',            videoUrl: null },
  { name: 'Dip',               category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['triceps','chest'], secondaryMuscles: ['front_delts'],                 instructions: 'Support on parallel bars. Lower until shoulders at bar level, press up.',     videoUrl: null },
  { name: 'Plank',             category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['abs','core'],    secondaryMuscles: ['glutes','shoulders'],             instructions: 'Forearms on floor, body straight from head to heels. Breathe normally.',     videoUrl: null },
  { name: 'Side Plank',        category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['obliques'],      secondaryMuscles: ['abs','glutes'],                  instructions: 'One forearm on floor, stack feet. Hips up, body straight. Hold.',            videoUrl: null },
  { name: 'Hanging Leg Raise', category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['abs','hip_flexors'], secondaryMuscles: ['obliques'],                 instructions: 'Hang from bar. Raise legs to 90°, lower with control.',                     videoUrl: null },
  { name: 'Inverted Row',      category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['rhomboids','lats'], secondaryMuscles: ['biceps','rear_delts'],         instructions: 'Under bar at waist height, body straight. Pull chest to bar.',              videoUrl: null },
  { name: 'Burpee',            category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['full_body'],     secondaryMuscles: [],                                instructions: 'Squat down, kick feet back, push-up, jump feet in, jump up overhead.',      videoUrl: null },
  { name: 'Jump Squat',        category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['quads','glutes'], secondaryMuscles: ['calves'],                       instructions: 'Squat to parallel, explode up, land softly with bent knees.',               videoUrl: null },
  { name: 'Mountain Climber',  category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['core','hip_flexors'], secondaryMuscles: ['chest','shoulders'],        instructions: 'Push-up position. Drive knees toward chest alternately.',                   videoUrl: null },
  { name: 'Box Jump',          category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['quads','glutes'], secondaryMuscles: ['hamstrings','calves'],           instructions: 'Swing arms, jump onto box landing with soft knees. Step back down.',        videoUrl: null },
  // MMA / BAGS
  { name: 'Heavy Bag — Boxing Combos',  category: 'mma',         equipment: 'bag',      primaryMuscles: ['shoulders','chest','core'],  secondaryMuscles: ['triceps','legs'],        instructions: 'Work 1-2, 1-2-3-2, body combos. Rotate hips. 3-min rounds.',               videoUrl: null },
  { name: 'Heavy Bag — Kick Work',      category: 'mma',         equipment: 'bag',      primaryMuscles: ['quads','glutes','hip_flexors'], secondaryMuscles: ['calves','core'],    instructions: 'Low kicks, body kicks, head kicks. Step in, pivot hip over for power.',      videoUrl: null },
  { name: 'Heavy Bag — Knees & Elbows', category: 'mma',         equipment: 'bag',      primaryMuscles: ['core','hip_flexors'],        secondaryMuscles: ['shoulders'],            instructions: 'Clinch position. Drive knees into bag. Step in for elbows at angle.',       videoUrl: null },
  { name: 'Heavy Bag — MMA Combos',     category: 'mma',         equipment: 'bag',      primaryMuscles: ['full_body'],                 secondaryMuscles: [],                       instructions: 'Mix punches, kicks, knees, elbows. Level changes. Simulate fight pace.',    videoUrl: null },
  { name: 'Speedbag',                   category: 'mma',         equipment: 'bag',      primaryMuscles: ['shoulders','forearms'],      secondaryMuscles: ['triceps'],              instructions: 'Eye level, elbows up. Alternating fists in rhythm. Start slow, build speed.', videoUrl: null },
  { name: 'Shadow Boxing',              category: 'mma',         equipment: 'none',     primaryMuscles: ['shoulders','core'],          secondaryMuscles: ['legs'],                 instructions: 'Visualize opponent. Work footwork, angles, level changes. 3-min rounds.',   videoUrl: null },
  { name: 'Shadow Boxing — Muay Thai',  category: 'muay_thai',   equipment: 'none',     primaryMuscles: ['full_body'],                 secondaryMuscles: [],                       instructions: 'Incorporate teeps, roundhouse kicks, knees, elbows. Work stance and timing.', videoUrl: null },
  { name: 'Pad Work — Boxing',          category: 'mma',         equipment: 'pads',     primaryMuscles: ['full_body'],                 secondaryMuscles: [],                       instructions: 'Follow coach calls. Stay sharp, reset after each combo. Work defense.',      videoUrl: null },
  { name: 'Pad Work — Muay Thai',       category: 'muay_thai',   equipment: 'pads',     primaryMuscles: ['full_body'],                 secondaryMuscles: [],                       instructions: 'Full Muay Thai combos with holder. All eight weapons.',                     videoUrl: null },
  { name: 'Sparring',                   category: 'mma',         equipment: 'none',     primaryMuscles: ['full_body'],                 secondaryMuscles: [],                       instructions: 'Technical sparring. Apply techniques from training. Respect partners.',     videoUrl: null },
  { name: 'Clinch Work',                category: 'muay_thai',   equipment: 'none',     primaryMuscles: ['shoulders','traps','core'],  secondaryMuscles: ['neck','legs'],           instructions: 'Inside Muay Thai clinch: neck wrestling, drive knees, create angles.',      videoUrl: null },
  { name: 'Takedown Drilling',          category: 'mma',         equipment: 'none',     primaryMuscles: ['hips','quads','core'],       secondaryMuscles: ['lower_back'],           instructions: 'Shots, double/single legs, hip tosses. Drill with partner, high reps.',    videoUrl: null },
  { name: 'Sprawl Drill',               category: 'mma',         equipment: 'none',     primaryMuscles: ['hip_flexors','core'],        secondaryMuscles: ['glutes','lower_back'],  instructions: 'Partner shoots, sprawl hips to mat, drive weight down, return to feet.',   videoUrl: null },
  { name: 'Neck Bridge',                category: 'mma',         equipment: 'bodyweight', primaryMuscles: ['neck'],                    secondaryMuscles: ['traps','upper_back'],   instructions: 'On back, push onto crown of head. Rock gently. Progress to full bridge.',  videoUrl: null },
  // BJJ
  { name: 'BJJ Drilling',         category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','full_body'], secondaryMuscles: [],         instructions: 'Repetitive technique drilling with partner or solo.',                         videoUrl: null },
  { name: 'BJJ Live Rolling',     category: 'bjj', equipment: 'none', primaryMuscles: ['full_body'],               secondaryMuscles: [],         instructions: 'Full resistance grappling rounds. 5–8 min rounds with varying partners.',    videoUrl: null },
  { name: 'Hip Escape (Shrimp)',  category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips'],             secondaryMuscles: ['glutes'], instructions: 'On back, bridge and shrimp hips sideways to create space. Drill length of mat.', videoUrl: null },
  { name: 'Guard Retention Drill',category: 'bjj', equipment: 'none', primaryMuscles: ['core','hip_flexors'],      secondaryMuscles: ['legs'],   instructions: 'Maintain guard while partner tries to pass. Train sensitivity and reaction.', videoUrl: null },
  // CARDIO
  { name: 'Assault Bike — Steady State', category: 'cardio',       equipment: 'cardio_machine', primaryMuscles: ['full_body'], secondaryMuscles: [], instructions: 'Maintain consistent RPM. Arms and legs together. Good for aerobic base.',    videoUrl: null },
  { name: 'Assault Bike — Intervals',    category: 'conditioning', equipment: 'cardio_machine', primaryMuscles: ['full_body'], secondaryMuscles: [], instructions: 'All-out sprint, then rest. E.g. 10s on / 50s off × 10, or Tabata 20/10.',  videoUrl: null },
  { name: 'Assault Bike — AMRAP',        category: 'conditioning', equipment: 'cardio_machine', primaryMuscles: ['full_body'], secondaryMuscles: [], instructions: 'Max calories in set time (30 sec or 1 min). Used in WODs.',               videoUrl: null },
  { name: 'Treadmill Run',               category: 'cardio',       equipment: 'cardio_machine', primaryMuscles: ['quads','calves','hamstrings'], secondaryMuscles: ['glutes','core'], instructions: 'Steady pace. Land midfoot. Use for base building or tempo.',             videoUrl: null },
  { name: 'Treadmill Sprint Intervals',  category: 'conditioning', equipment: 'cardio_machine', primaryMuscles: ['quads','calves'], secondaryMuscles: ['glutes','hamstrings'], instructions: 'High speed 20–30s, step off or walk for recovery. Repeat.',              videoUrl: null },
  { name: 'Treadmill Incline Walk',      category: 'cardio',       equipment: 'cardio_machine', primaryMuscles: ['glutes','hamstrings'], secondaryMuscles: ['calves','core'],  instructions: '10–15% incline, moderate pace. Do not hold rails. Low-impact cardio.',   videoUrl: null },
  // BASKETBALL / COURT
  { name: 'Suicide Sprints',       category: 'conditioning', equipment: 'none', primaryMuscles: ['quads','calves'],  secondaryMuscles: ['core'],      instructions: 'Sprint to free throw line and back, half court and back, full court and back.', videoUrl: null },
  { name: 'Basketball — Pickup Game', category: 'cardio',    equipment: 'none', primaryMuscles: ['full_body'],       secondaryMuscles: [],            instructions: 'Full game play. Great aerobic/anaerobic interval mix.',                        videoUrl: null },
  // ICE RINK
  { name: 'Skating — Endurance Laps',   category: 'cardio',       equipment: 'none', primaryMuscles: ['glutes','adductors','quads'], secondaryMuscles: ['calves','core'], instructions: 'Steady pace. Focus on long strides and edge work.',                   videoUrl: null },
  { name: 'Skating — Sprint Intervals', category: 'conditioning', equipment: 'none', primaryMuscles: ['quads','glutes','adductors'], secondaryMuscles: ['core'],          instructions: 'All-out sprint one length, coast back, repeat.',                      videoUrl: null },
  { name: 'Skating — Agility Drills',   category: 'conditioning', equipment: 'none', primaryMuscles: ['adductors','glutes'],         secondaryMuscles: ['core'],          instructions: 'Crossovers, quick stops, backward skating, transitions.',             videoUrl: null },
  // RECOVERY / STRETCHING
  { name: 'World\'s Greatest Stretch', category: 'recovery', equipment: 'none', primaryMuscles: ['hips','hamstrings','thoracic_spine'], secondaryMuscles: ['glutes','core'], instructions: 'Lunge forward, elbow to instep, rotate chest open, then switch sides.', videoUrl: 'https://www.youtube.com/results?search_query=worlds+greatest+stretch+demo' },
  { name: 'Couch Stretch',              category: 'recovery', equipment: 'none', primaryMuscles: ['quads','hip_flexors'], secondaryMuscles: ['glutes'], instructions: 'Rear shin vertical against wall/bench. Tuck pelvis and squeeze glute to open hip flexor.', videoUrl: 'https://www.youtube.com/results?search_query=couch+stretch+demo' },
  { name: '90/90 Hip Switch',           category: 'recovery', equipment: 'none', primaryMuscles: ['hips','glutes'], secondaryMuscles: ['core'], instructions: 'Sit in 90/90, rotate knees side to side without using hands if possible.', videoUrl: 'https://www.youtube.com/results?search_query=90+90+hip+switch+mobility' },
  { name: 'Pigeon Stretch',             category: 'recovery', equipment: 'none', primaryMuscles: ['glutes','hips'], secondaryMuscles: ['lower_back'], instructions: 'Front shin across body, extend rear leg, fold forward slowly and breathe.', videoUrl: 'https://www.youtube.com/results?search_query=pigeon+stretch+tutorial' },
  { name: 'Hamstring Floss',            category: 'recovery', equipment: 'none', primaryMuscles: ['hamstrings'], secondaryMuscles: ['calves'], instructions: 'From half-kneel, rock hips back while extending front knee and pulling toes up.', videoUrl: 'https://www.youtube.com/results?search_query=hamstring+floss+mobility' },
  { name: 'Thoracic Open Book',         category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine'], secondaryMuscles: ['shoulders'], instructions: 'Lie side-on with knees bent, open top arm across body and rotate upper back.', videoUrl: 'https://www.youtube.com/results?search_query=thoracic+open+book+stretch' },
  { name: 'Bretzel Stretch',            category: 'recovery', equipment: 'none', primaryMuscles: ['quads','hip_flexors','thoracic_spine'], secondaryMuscles: ['glutes'], instructions: 'Side-lying mobility drill for quad/hip plus thoracic rotation.', videoUrl: 'https://www.youtube.com/results?search_query=bretzel+stretch+demo' },
  { name: 'Ankle Dorsiflexion Wall Drill', category: 'recovery', equipment: 'none', primaryMuscles: ['calves','ankles'], secondaryMuscles: [], instructions: 'Drive knee toward wall over toes while heel stays down; control both directions.', videoUrl: 'https://www.youtube.com/results?search_query=ankle+dorsiflexion+wall+drill' },
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
    description: 'Focused BJJ competition preparation. High drilling volume, live rolling, targeted conditioning. Minimal striking to maximise grappling gains.',
    phases: JSON.stringify([
      {
        name: 'Development', weeks: '1–3', focus: 'Technical drilling volume, positional work, aerobic grappling',
        weeklySchedule: [
          { day: 1, title: 'BJJ — Guard Focus', type: 'bjj', duration: 100, description: 'Guard passing + retention drills 30 min. Positional sparring from guard 4×8 min.' },
          { day: 2, title: 'Strength + Core', type: 'strength', duration: 60, description: 'Deadlift, hip thrust, pull-ups, cable row. Strong posterior chain for grappling.' },
          { day: 3, title: 'BJJ — Top Game', type: 'bjj', duration: 90, description: 'Takedowns, top control, passes. Full drilling sequence + positional.' },
          { day: 4, title: 'Conditioning', type: 'conditioning', duration: 40, description: 'Assault bike intervals + hip escapes + guard retention drill. Grappling-specific.' },
          { day: 5, title: 'BJJ — Open Rolling', type: 'bjj', duration: 90, description: '6–8 rounds live rolling. Experiment with game plan. Work weaknesses.' },
          { day: 6, title: 'Open Mat', type: 'bjj', duration: 90, description: 'Extra rolling or drilling. Focus on competition game plan.' },
          { day: 0, title: 'Rest', type: 'recovery', duration: 0, description: 'Full rest.' },
        ],
      },
      {
        name: 'Peaking', weeks: '4–6', focus: 'Competition-pace rolling, sharpen A-game, taper final week',
        weeklySchedule: [
          { day: 1, title: 'BJJ — Drilling + Positional', type: 'bjj', duration: 90, description: 'Drill A-game sequences 30 min. Competition-pace positional work.' },
          { day: 2, title: 'Light Conditioning', type: 'conditioning', duration: 30, description: 'Easy bike. Hip mobility drills. Light bodyweight.' },
          { day: 3, title: 'BJJ — Hard Rolling', type: 'bjj', duration: 90, description: 'Competition-intensity rounds. Apply A-game. 5-min rounds, no breaks.' },
          { day: 4, title: 'Technique Sharpening', type: 'technique', duration: 45, description: 'Drill specific sequences that need polish. No live rolling.' },
          { day: 5, title: 'BJJ — Final Prep Rolling', type: 'bjj', duration: 60, description: '3–4 technical rounds only. Stay healthy and sharp.' },
          { day: 6, title: 'Rest / Visualisation', type: 'recovery', duration: 20, description: 'Rest. Visualise your A-game and competition scenarios.' },
          { day: 0, title: 'Rest', type: 'recovery', duration: 0, description: 'Full rest or easy walk.' },
        ],
      },
    ]),
  },
];

// ── Per-user database factory ─────────────────────────────────────────────────

const getDatabase = (username) => {
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, 'data', `${username}_health.sqlite`),
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

    // ── Seed function ──────────────────────────────────────────────────────────

    async function seedData() {
        const exCount = await ExerciseDefinition.count();
        if (exCount === 0) {
            await ExerciseDefinition.bulkCreate(
                SEED_EXERCISES.map(e => ({
                    ...e,
                    primaryMuscles:   JSON.stringify(e.primaryMuscles),
                    secondaryMuscles: JSON.stringify(e.secondaryMuscles),
                }))
            );
        }
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
        const planCount = await TrainingPlan.count();
        if (planCount === 0) {
            await TrainingPlan.bulkCreate(SEED_PLANS);
        }
    }

    return {
        sequelize,
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
        TrainingPlan,
        TrainingPlanAssignment,
        seedData,
    };
};

module.exports = getDatabase;
