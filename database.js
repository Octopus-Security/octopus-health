const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// ── Seed data ────────────────────────────────────────────────────────────────

const SEED_EXERCISES = [
  // BARBELL — MAIN LIFTS
  { name: 'Barbell Back Squat',      category: 'strength',     equipment: 'barbell',        primaryMuscles: ['quads','glutes'],              secondaryMuscles: ['hamstrings','lower_back','core'],   instructions: 'Bar on upper traps. Brace core, sit hips back and down until thighs parallel. Drive through heels.', videoUrl: 'https://www.youtube.com/watch?v=ultWZbUMPL8', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_9dc3e59f-6c8c-45ff-9a9d-e6cb62ec6f4b.webp', defaultSets: 4, defaultReps: 5, defaultDuration: null },
  { name: 'Barbell Deadlift',         category: 'strength',     equipment: 'barbell',        primaryMuscles: ['hamstrings','lower_back','glutes'], secondaryMuscles: ['traps','lats','forearms','quads'], instructions: 'Bar over mid-foot. Flatten back, brace hard. Push floor away, lock hips at top.',                 videoUrl: 'https://www.youtube.com/watch?v=op9kVnSso6Q', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_c4d8f8dd-2ce8-497f-8d43-9a8b51e3e4d1.webp', defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Barbell Front Squat',      category: 'strength',     equipment: 'barbell',        primaryMuscles: ['quads'],                       secondaryMuscles: ['glutes','upper_back','core'],       instructions: 'Bar on front delts, elbows high. Squat straight down keeping torso upright.',                     videoUrl: 'https://www.youtube.com/watch?v=G2W0vJW5PVw', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_f7b9e8d1-3a2d-4e5f-9c1a-2b3d4e5f6a7b.webp', defaultSets: 4, defaultReps: 6, defaultDuration: null },
  { name: 'Barbell Bench Press',      category: 'strength',     equipment: 'barbell',        primaryMuscles: ['chest'],                       secondaryMuscles: ['front_delts','triceps'],            instructions: 'Lie flat, grip slightly wider than shoulders. Lower to lower chest, press up.',                    videoUrl: 'https://www.youtube.com/watch?v=rT7DgCr-3pg', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_e2b1c5d4-3f2a-4d6e-8a9c-1b2c3d4e5f6a.webp', defaultSets: 4, defaultReps: 5, defaultDuration: null },
  { name: 'Barbell Overhead Press',   category: 'strength',     equipment: 'barbell',        primaryMuscles: ['front_delts','side_delts'],     secondaryMuscles: ['triceps','traps','upper_chest'],    instructions: 'Bar at shoulder height. Press straight overhead. Lean slightly under bar at lockout.',             videoUrl: 'https://www.youtube.com/watch?v=2yjwXTZQDDI', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_d1a2b3c4-e5f6-4a7b-8c9d-0e1f2a3b4c5d.webp', defaultSets: 4, defaultReps: 5, defaultDuration: null },
  { name: 'Barbell Bent-Over Row',    category: 'strength',     equipment: 'barbell',        primaryMuscles: ['lats','rhomboids'],             secondaryMuscles: ['biceps','rear_delts','lower_back'], instructions: 'Hinge to ~45°. Row bar to lower chest, lead with elbows, keep back flat.',                        videoUrl: 'https://www.youtube.com/watch?v=vT2GjY_Umpw', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f.webp', defaultSets: 4, defaultReps: 6, defaultDuration: null },
  { name: 'Romanian Deadlift (RDL)',  category: 'strength',     equipment: 'barbell',        primaryMuscles: ['hamstrings','glutes'],          secondaryMuscles: ['lower_back'],                       instructions: 'Hold bar at hips, soft knee. Hinge back until hamstring stretch, return.',                        videoUrl: 'https://www.youtube.com/watch?v=3eKfN8gLKvs', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_b2c3d4e5-f6a7-b8c9-d0e1-f2a3b4c5d6e7.webp', defaultSets: 4, defaultReps: 8, defaultDuration: null },
  { name: 'Barbell Hip Thrust',       category: 'strength',     equipment: 'barbell',        primaryMuscles: ['glutes'],                      secondaryMuscles: ['hamstrings','quads'],               instructions: 'Shoulders on bench, bar across hips. Drive hips to full extension, squeeze glutes.',               videoUrl: 'https://www.youtube.com/watch?v=JxHanJbgfgI', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6.webp', defaultSets: 4, defaultReps: 8, defaultDuration: null },
  { name: 'Barbell Good Morning',     category: 'strength',     equipment: 'barbell',        primaryMuscles: ['lower_back','hamstrings'],      secondaryMuscles: ['glutes'],                          instructions: 'Bar on upper back, hinge at hips with soft knees until torso near parallel.',                    videoUrl: 'https://www.youtube.com/watch?v=LhNFiZ3EF8U', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_9f0a1b2c-d3e4-f5a6-b7c8-d9e0f1a2b3c4.webp', defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Barbell Pendulum Squat',   category: 'strength',     equipment: 'barbell',        primaryMuscles: ['quads','glutes'],              secondaryMuscles: ['hamstrings','core'],                instructions: 'Load barbell against rack. Step through and squat. Great alternative to back squat.',              videoUrl: 'https://www.youtube.com/watch?v=d70LwHDx8o0', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_8e9f0a1b-2c3d-e4f5-a6b7-c8d9e0f1a2b3.webp', defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Barbell Hack Squat',       category: 'strength',     equipment: 'barbell',        primaryMuscles: ['quads'],                       secondaryMuscles: ['glutes','hamstrings'],              instructions: 'Bar held behind back at legs. Machine-like squat. Quad-dominant.',                               videoUrl: 'https://www.youtube.com/watch?v=l70CjLQqE2I', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_7d8e9f0a-b1c2-d3e4-f5a6-b7c8d9e0f1a2.webp', defaultSets: 3, defaultReps: 10, defaultDuration: null },

  // DUMBBELL — PRESSING
  { name: 'Dumbbell Bench Press',            category: 'strength', equipment: 'dumbbell', primaryMuscles: ['chest'],                  secondaryMuscles: ['front_delts','triceps'],       instructions: 'Lie flat, dumbbells at chest. Press up and slightly in, control descent.',              videoUrl: 'https://www.youtube.com/watch?v=VmWf01mTBIc', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_6c7d8e9f-0a1b-2c3d-e4f5-a6b7c8d9e0f1.webp', defaultSets: 4, defaultReps: 8, defaultDuration: null },
  { name: 'Incline Dumbbell Press',          category: 'strength', equipment: 'dumbbell', primaryMuscles: ['upper_chest','front_delts'], secondaryMuscles: ['triceps'],                  instructions: 'Bench at 30–45°. Press dumbbells from chest up and slightly together.',                videoUrl: 'https://www.youtube.com/watch?v=8iPEnn-ltC8', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_5b6c7d8e-f9a0-b1c2-d3e4-f5a6b7c8d9e0.webp', defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Decline Dumbbell Press',          category: 'strength', equipment: 'dumbbell', primaryMuscles: ['lower_chest'],             secondaryMuscles: ['triceps','front_delts'],    instructions: 'Decline bench. Press from lower chest position.',                                      videoUrl: 'https://www.youtube.com/watch?v=qVaVn-uTjcU', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_4a5b6c7d-e8f9-a0b1-c2d3-e4f5a6b7c8d9.webp', defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Dumbbell Shoulder Press',         category: 'strength', equipment: 'dumbbell', primaryMuscles: ['front_delts','side_delts'], secondaryMuscles: ['triceps'],                  instructions: 'Seated, dumbbells at shoulder height. Press to lockout, lower with control.',          videoUrl: 'https://www.youtube.com/watch?v=qEwKn7FlQ9Q', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_39a4b5c6-d7e8-f9a0-b1c2-d3e4f5a6b7c8.webp', defaultSets: 4, defaultReps: 8, defaultDuration: null },
  { name: 'Dumbbell Arnold Press',           category: 'strength', equipment: 'dumbbell', primaryMuscles: ['front_delts','side_delts','rear_delts'], secondaryMuscles: ['triceps'], instructions: 'Rotate palms forward while pressing overhead. Full shoulder involvement.',                 videoUrl: 'https://www.youtube.com/watch?v=6Z15_WdXmj4', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_28a9b0c1-d2e3-f4a5-b6c7-d8e9f0a1b2c3.webp', defaultSets: 3, defaultReps: 10, defaultDuration: null },
  // DUMBBELL — ROWING
  { name: 'Dumbbell Row',                    category: 'strength', equipment: 'dumbbell', primaryMuscles: ['lats','rhomboids'],       secondaryMuscles: ['biceps','rear_delts'],         instructions: 'Support on bench, row dumbbell to hip, elbow close to body, full stretch at bottom.',  videoUrl: 'https://www.youtube.com/watch?v=pYcM8p4qXA4', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_1798a9b0-c1d2-e3f4-a5b6-c7d8e9f0a1b2.webp', defaultSets: 4, defaultReps: 8, defaultDuration: null },
  { name: 'Dumbbell Single-Arm Row',         category: 'strength', equipment: 'dumbbell', primaryMuscles: ['lats'],                   secondaryMuscles: ['biceps','rhomboids'],         instructions: 'Tall plank, row DB to ribcage. Explosive drive, control lower.',                      videoUrl: 'https://www.youtube.com/watch?v=K0zFKw3MIeE', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_069f8a9b-0c1d-e2f3-a4b5-c6d7e8f9a0b1.webp', defaultSets: 4, defaultReps: 8, defaultDuration: null },
  { name: 'Dumbbell Pullovers',              category: 'strength', equipment: 'dumbbell', primaryMuscles: ['chest','lats'],           secondaryMuscles: ['serratus'],                    instructions: 'Flat bench, DB over chest. Lower behind head, arc motion. Full range.',                videoUrl: 'https://www.youtube.com/watch?v=fcLlqx7aZjY', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_f5e6d7c8-b9a0-1c2d-e3f4-a5b6c7d8e9f0.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  // DUMBBELL — LATERALS & REAR DELTS
  { name: 'Dumbbell Lateral Raise',          category: 'strength', equipment: 'dumbbell', primaryMuscles: ['side_delts'],             secondaryMuscles: ['traps'],                      instructions: 'Slight forward lean, raise to shoulder height with soft elbow, thumbs slightly down.',  videoUrl: 'https://www.youtube.com/watch?v=3VcluBkNpAE', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_e4f5c6d7-a8b9-0c1d-e2f3-a4b5c6d7e8f9.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Dumbbell Rear Delt Fly',          category: 'strength', equipment: 'dumbbell', primaryMuscles: ['rear_delts'],             secondaryMuscles: ['rhomboids','traps'],           instructions: 'Hinge ~90°, raise dumbbells out to sides leading with elbows.',                       videoUrl: 'https://www.youtube.com/watch?v=dD7Zpg-MJWU', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_d3e4f5a6-b7c8-d9e0-f1a2-b3c4d5e6f7a8.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Dumbbell Front Raise',            category: 'strength', equipment: 'dumbbell', primaryMuscles: ['front_delts'],            secondaryMuscles: ['upper_chest'],                instructions: 'Neutral grip, raise to eye level, control descent.',                                  videoUrl: 'https://www.youtube.com/watch?v=lWCfzq8Bpzw', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_c2d3e4f5-a6b7-c8d9-e0f1-a2b3c4d5e6f7.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  // DUMBBELL — ARMS
  { name: 'Dumbbell Bicep Curl',             category: 'strength', equipment: 'dumbbell', primaryMuscles: ['biceps'],                 secondaryMuscles: ['brachialis'],                 instructions: 'Supinated grip, curl toward shoulders without swinging, lower fully.',                 videoUrl: 'https://www.youtube.com/watch?v=ykJmroCGujU', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_b1c2d3e4-f5a6-b7c8-d9e0-f1a2b3c4d5e6.webp', defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Dumbbell Hammer Curl',            category: 'strength', equipment: 'dumbbell', primaryMuscles: ['brachialis','biceps'],    secondaryMuscles: ['forearms'],                   instructions: 'Neutral (thumbs up) grip, curl to shoulder, keep elbows pinned.',                     videoUrl: 'https://www.youtube.com/watch?v=zC3nLlEvinA', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_a0b1c2d3-e4f5-a6b7-c8d9-e0f1a2b3c4d5.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Dumbbell Concentration Curl',     category: 'strength', equipment: 'dumbbell', primaryMuscles: ['biceps'],                 secondaryMuscles: [],                             instructions: 'Seated, elbow on inner knee. Curl with strict form, squeeze peak.',                     videoUrl: 'https://www.youtube.com/watch?v=28DKYmXWAKM', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_9f0e1f2a-3b4c-d5e6-f7a8-b9c0d1e2f3a4.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Dumbbell Tricep Kickback',        category: 'strength', equipment: 'dumbbell', primaryMuscles: ['triceps'],                secondaryMuscles: [],                             instructions: 'Hinge forward, upper arm parallel to floor, extend forearm back to lockout.',          videoUrl: 'https://www.youtube.com/watch?v=6SS0PC4mB8A', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_8e9d0e1f-2a3b-c4d5-e6f7-a8b9c0d1e2f3.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Dumbbell Tricep Overhead Press',  category: 'strength', equipment: 'dumbbell', primaryMuscles: ['triceps'],                secondaryMuscles: ['chest'],                      instructions: 'Hold one DB overhead, lower behind head. Keep core stable.',                            videoUrl: 'https://www.youtube.com/watch?v=2yVyK1K-OOo', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_7d8c9d0e-1f2a-b3c4-d5e6-f7a8b9c0d1e2.webp', defaultSets: 3, defaultReps: 10, defaultDuration: null },
  // DUMBBELL — LOWER BODY & CORE
  { name: 'Dumbbell Romanian Deadlift',      category: 'strength', equipment: 'dumbbell', primaryMuscles: ['hamstrings','glutes'],    secondaryMuscles: ['lower_back'],                 instructions: 'Dumbbells in front of thighs, hinge hips back, lower along shins, return.',           videoUrl: 'https://www.youtube.com/watch?v=HT3I9IG8E2Q', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_6c7d8e9d-0f1a-2b3c-d4e5-f6a7b8c9d0e1.webp', defaultSets: 4, defaultReps: 8, defaultDuration: null },
  { name: 'Dumbbell Bulgarian Split Squat',  category: 'strength', equipment: 'dumbbell', primaryMuscles: ['quads','glutes'],         secondaryMuscles: ['hamstrings','calves'],         instructions: 'Rear foot elevated on bench. Squat on front leg until rear knee nearly touches floor.', videoUrl: 'https://www.youtube.com/watch?v=nZJzaVdpTGI', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_5b6c7d8c-e9f0-a1b2-c3d4-e5f6a7b8c9d0.webp', defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Dumbbell Lunge',                  category: 'strength', equipment: 'dumbbell', primaryMuscles: ['quads','glutes'],         secondaryMuscles: ['hamstrings','calves'],         instructions: 'Step forward, lower rear knee toward floor, push back to start.',                      videoUrl: 'https://www.youtube.com/watch?v=Z2a8aG9nVJY', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_4a5b6c7b-d8e9-f0a1-b2c3-d4e5f6a7b8c9.webp', defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Dumbbell Walking Lunge',          category: 'strength', equipment: 'dumbbell', primaryMuscles: ['quads','glutes'],         secondaryMuscles: ['hamstrings','core'],           instructions: 'Walk forward, lunging with each step. Full range motion.',                             videoUrl: 'https://www.youtube.com/watch?v=UtdvvGaEsOU', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_3949a5b6-c7d8-e9f0-a1b2-c3d4e5f6a7b8.webp', defaultSets: 3, defaultReps: 20, defaultDuration: null },
  { name: 'Goblet Squat',                    category: 'strength', equipment: 'dumbbell', primaryMuscles: ['quads','glutes'],         secondaryMuscles: ['core','adductors'],            instructions: 'Hold dumbbell at chest. Squat deep with elbows inside knees, drive through heels.',   videoUrl: 'https://www.youtube.com/watch?v=r4WB4LmrHuk', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_281898a9-b0c1-d2e3-f4a5-b6c7d8e9f0a1.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: "Farmer's Carry",                  category: 'strength', equipment: 'dumbbell', primaryMuscles: ['traps','forearms'],       secondaryMuscles: ['core','quads'],               instructions: 'Hold heavy dumbbells at sides, walk with tall posture and tight core.',                videoUrl: 'https://www.youtube.com/watch?v=XVYQvTZG9OE', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_171798a8-b9c0-d1e2-f3a4-b5c6d7e8f9a0.webp', defaultSets: 3, defaultReps: 40, defaultDuration: null },
  { name: 'Dumbbell Shrug',                  category: 'strength', equipment: 'dumbbell', primaryMuscles: ['traps'],                  secondaryMuscles: ['forearms'],                   instructions: 'Elevate shoulders straight up, hold 1 second, lower fully.',                          videoUrl: 'https://www.youtube.com/watch?v=cKlRc-erJBA', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_060f1a0b-1c2d-e3f4-a5b6-c7d8e9f0a1b2.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Dumbbell Suitcase Carry',         category: 'strength', equipment: 'dumbbell', primaryMuscles: ['obliques','core'],        secondaryMuscles: ['lats','traps'],               instructions: 'Hold single dumbbell at side, walk upright. Anti-lateral flexion.',                     videoUrl: 'https://www.youtube.com/watch?v=qXA_WuCrwvM', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_f5e4d3c2-b1a0-9f8e-7d6c-5b4a3938271a.webp', defaultSets: 3, defaultReps: 40, defaultDuration: null },
  // CABLE MACHINE
  { name: 'Lat Pulldown',          category: 'strength', equipment: 'cable_machine', primaryMuscles: ['lats'],          secondaryMuscles: ['biceps','rhomboids','rear_delts'], instructions: 'Wide grip, lean slightly back. Pull bar to upper chest, squeeze lats, slow return.',       videoUrl: 'https://www.youtube.com/watch?v=4PYk6KPvZvE', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_e4d3c2b1-a0f9-e8d7-c6b5-a4938271a09f.webp', defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Seated Cable Row',      category: 'strength', equipment: 'cable_machine', primaryMuscles: ['rhomboids','lats'], secondaryMuscles: ['biceps','rear_delts'],           instructions: 'Feet on platform. Pull handle to navel, squeeze shoulder blades, slow return.',           videoUrl: 'https://www.youtube.com/watch?v=nLJ_v0ixRVQ', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_d3c2b1a0-9f8e-7d6c-5b4a39382717.webp', defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Cable Chest Fly',       category: 'strength', equipment: 'cable_machine', primaryMuscles: ['chest'],         secondaryMuscles: ['front_delts'],                   instructions: 'Cables high. Bring handles together in front of chest with slight elbow bend.',             videoUrl: 'https://www.youtube.com/watch?v=bnHyMiGMmvg', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_c2b1a09f-8e7d-6c5b-4a39-38271a09f8e7.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Cable Tricep Pushdown', category: 'strength', equipment: 'cable_machine', primaryMuscles: ['triceps'],       secondaryMuscles: [],                               instructions: 'High pulley, elbows pinned to sides. Push down to lockout, slow return.',                  videoUrl: 'https://www.youtube.com/watch?v=EgEX8m0gYy0', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_b1a09f8e-7d6c-5b4a-3938-271a09f8e7d6.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Cable Bicep Curl',      category: 'strength', equipment: 'cable_machine', primaryMuscles: ['biceps'],        secondaryMuscles: ['brachialis'],                   instructions: 'Low pulley, underhand grip. Curl to shoulders, elbows pinned.',                            videoUrl: 'https://www.youtube.com/watch?v=OMf8KFr5eAQ', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_a09f8e7d-6c5b-4a39-38271a-09f8e7d6c5b.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Cable Face Pull',       category: 'strength', equipment: 'cable_machine', primaryMuscles: ['rear_delts'],    secondaryMuscles: ['rhomboids','traps'],             instructions: 'High pulley with rope. Pull to face, hands finishing at ear level, elbows high.',           videoUrl: 'https://www.youtube.com/watch?v=K8tMjKcVFnE', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_9f8e7d6c-5b4a-3938-271a-09f8e7d6c5b4.webp', defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Cable Lateral Raise',   category: 'strength', equipment: 'cable_machine', primaryMuscles: ['side_delts'],    secondaryMuscles: [],                               instructions: 'Low side pulley. Raise arm to shoulder height with soft elbow, control the return.',        videoUrl: 'https://www.youtube.com/watch?v=6_T5e5Rv9Hc', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_8e7d6c5b-4a39-38271a-09f8e7d6c5b4a.webp', defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Cable Crunch',          category: 'strength', equipment: 'cable_machine', primaryMuscles: ['abs'],           secondaryMuscles: ['obliques'],                     instructions: 'Kneel facing high pulley, rope behind neck. Crunch elbows toward knees.',                  videoUrl: 'https://www.youtube.com/watch?v=i2wHYI0B0pE', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_7d6c5b4a-3938-271a-09f8e7d6c5b4a39.webp', defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Wood Chop',             category: 'strength', equipment: 'cable_machine', primaryMuscles: ['obliques','abs'], secondaryMuscles: ['shoulders','lats'],             instructions: 'High pulley to one side. Pull diagonally across body in chopping motion.',                  videoUrl: 'https://www.youtube.com/watch?v=7Vzy0LG3lZI', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_6c5b4a39-38271a-09f8e7d6c5b4a393.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  // MACHINE
  { name: 'Leg Press',             category: 'strength', equipment: 'machine', primaryMuscles: ['quads','glutes'],    secondaryMuscles: ['hamstrings'],   instructions: 'Feet shoulder-width. Lower until 90°, press through heels, do not lock out.',      videoUrl: 'https://www.youtube.com/watch?v=__m4YXgaTKA', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_5b4a3938-271a-09f8-e7d6-c5b4a3938271.webp', defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Leg Extension',         category: 'strength', equipment: 'machine', primaryMuscles: ['quads'],             secondaryMuscles: [],               instructions: 'Pad above ankles. Extend to near lockout, lower with control.',                    videoUrl: 'https://www.youtube.com/watch?v=L3Yd0TGqqBY', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_4a3938271-a09f-8e7d-6c5b-4a3938271a0.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Leg Curl',              category: 'strength', equipment: 'machine', primaryMuscles: ['hamstrings'],        secondaryMuscles: ['calves'],       instructions: 'Pad behind lower leg. Curl heels to glutes, squeeze, lower with control.',          videoUrl: 'https://www.youtube.com/watch?v=1qUbm0fYMd8', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_3938271a-09f8-e7d6-c5b4-a3938271a09f.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Chest Press Machine',   category: 'strength', equipment: 'machine', primaryMuscles: ['chest'],             secondaryMuscles: ['front_delts','triceps'], instructions: 'Handles at chest height. Press forward to near lockout, control return.',         videoUrl: 'https://www.youtube.com/watch?v=KP-eZwVb0bU', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_271a09f8-e7d6-c5b4-a393-8271a09f8e7d.webp', defaultSets: 3, defaultReps: 10, defaultDuration: null },
  // BODYWEIGHT
  { name: 'Pull-up',           category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['lats'],          secondaryMuscles: ['biceps','rhomboids','rear_delts'], instructions: 'Overhand grip, hang fully. Pull chest toward bar, lower fully.',              videoUrl: 'https://www.youtube.com/watch?v=eYUJzxEpnXo', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_1a09f8e7-d6c5-b4a3-9382-71a09f8e7d6c.webp', defaultSets: 3, defaultReps: 6, defaultDuration: null },
  { name: 'Chin-up',           category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['biceps','lats'], secondaryMuscles: ['rhomboids'],                      instructions: 'Underhand grip. Pull chin over bar, lower fully.',                           videoUrl: 'https://www.youtube.com/watch?v=_nF-4n4k38A', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_09f8e7d6-c5b4-a393-8271-a09f8e7d6c5b.webp', defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Push-up',           category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['chest'],         secondaryMuscles: ['triceps','front_delts','core'],   instructions: 'Hands slightly wider than shoulders. Lower chest to floor, press up.',        videoUrl: 'https://www.youtube.com/watch?v=IODxDxX7oi4', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_8e7d6c5b-4a39-3827-1a09-f8e7d6c5b4a3.webp', defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Diamond Push-up',   category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['triceps'],       secondaryMuscles: ['chest','front_delts'],            instructions: 'Hands close forming diamond shape under chest. Lower and press.',            videoUrl: 'https://www.youtube.com/watch?v=7hv0TY3dj_c', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_7d6c5b4a-3938-2718-1a09-f8e7d6c5b4a3.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Dip',               category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['triceps','chest'], secondaryMuscles: ['front_delts'],                 instructions: 'Support on parallel bars. Lower until shoulders at bar level, press up.',     videoUrl: 'https://www.youtube.com/watch?v=YKqS0KLwJ-w', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_6c5b4a39-3827-1a09-f8e7d-6c5b4a393827.webp', defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Plank',             category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['abs','core'],    secondaryMuscles: ['glutes','shoulders'],             instructions: 'Forearms on floor, body straight from head to heels. Breathe normally.',     videoUrl: 'https://www.youtube.com/watch?v=4lLLhTliBHY', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_5b4a39383-827-1a09-f8e7-d6c5b4a39382.webp', defaultSets: 3, defaultReps: null, defaultDuration: 60 },
  { name: 'Side Plank',        category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['obliques'],      secondaryMuscles: ['abs','glutes'],                  instructions: 'One forearm on floor, stack feet. Hips up, body straight. Hold.',            videoUrl: 'https://www.youtube.com/watch?v=S_5gUgqaLZQ', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_4a39383827-1a09-f8e7-d6c5-b4a3938382.webp', defaultSets: 3, defaultReps: null, defaultDuration: 45 },
  { name: 'Hanging Leg Raise', category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['abs','hip_flexors'], secondaryMuscles: ['obliques'],                 instructions: 'Hang from bar. Raise legs to 90°, lower with control.',                     videoUrl: 'https://www.youtube.com/watch?v=84rnpAVeA9A', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_39383827-1a09-f8e7-d6c5-b4a393827.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Inverted Row',      category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['rhomboids','lats'], secondaryMuscles: ['biceps','rear_delts'],         instructions: 'Under bar at waist height, body straight. Pull chest to bar.',              videoUrl: 'https://www.youtube.com/watch?v=OYrzaJJNcFk', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_3827-1a09-f8e7-d6c5-b4a3938-27.webp', defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Burpee',            category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['full_body'],     secondaryMuscles: [],                                instructions: 'Squat down, kick feet back, push-up, jump feet in, jump up overhead.',      videoUrl: 'https://www.youtube.com/watch?v=JZQA0ZyKv5s', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_2-1a09-f8e7-d6c5-b4a39-382.webp', defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Jump Squat',        category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['quads','glutes'], secondaryMuscles: ['calves'],                       instructions: 'Squat to parallel, explode up, land softly with bent knees.',               videoUrl: 'https://www.youtube.com/watch?v=FSSDLDhbaX8', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_1-a09-f8e7-d6c5-b4a3-9382.webp', defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Mountain Climber',  category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['core','hip_flexors'], secondaryMuscles: ['chest','shoulders'],        instructions: 'Push-up position. Drive knees toward chest alternately.',                   videoUrl: 'https://www.youtube.com/watch?v=nmwgirgXLYM', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_a09-f8e7-d6c5-b4a-39382.webp', defaultSets: 3, defaultReps: 20, defaultDuration: null },
  { name: 'Box Jump',          category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['quads','glutes'], secondaryMuscles: ['hamstrings','calves'],           instructions: 'Swing arms, jump onto box landing with soft knees. Step back down.',        videoUrl: 'https://www.youtube.com/watch?v=Q-gQjKANYJc', mediaUrl: 'https://cdn.prod.website-cdn.com/IMG_09-f8e7-d6c5-b4-a39382.webp', defaultSets: 3, defaultReps: 8, defaultDuration: null },
  // MMA / COMBAT
  { name: 'Heavy Bag — Boxing Combos',  category: 'mma',         equipment: 'bag',      primaryMuscles: ['shoulders','chest','core'],  secondaryMuscles: ['triceps','legs'],        instructions: 'Work 1-2, 1-2-3-2, body combos. Rotate hips. 3-min rounds.',               videoUrl: 'https://www.youtube.com/watch?v=m3bqH2ckSNE', mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 180 },
  { name: 'Heavy Bag — Kick Work',      category: 'mma',         equipment: 'bag',      primaryMuscles: ['quads','glutes','hip_flexors'], secondaryMuscles: ['calves','core'],    instructions: 'Low kicks, body kicks, head kicks. Step in, pivot hip over for power.',      videoUrl: 'https://www.youtube.com/watch?v=qKu4BQnRKWo', mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 180 },
  { name: 'Heavy Bag — Knees & Elbows', category: 'mma',         equipment: 'bag',      primaryMuscles: ['core','hip_flexors'],        secondaryMuscles: ['shoulders'],            instructions: 'Clinch position. Drive knees into bag. Step in for elbows at angle.',       videoUrl: 'https://www.youtube.com/watch?v=g5n5qYL3PoY', mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 180 },
  { name: 'Heavy Bag — MMA Combos',     category: 'mma',         equipment: 'bag',      primaryMuscles: ['full_body'],                 secondaryMuscles: [],                       instructions: 'Mix punches, kicks, knees, elbows. Level changes. Simulate fight pace.',    videoUrl: 'https://www.youtube.com/watch?v=5RBhQvQT1QA', mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 300 },
  { name: 'Speed Bag',                   category: 'mma',         equipment: 'bag',      primaryMuscles: ['shoulders','forearms'],      secondaryMuscles: ['triceps'],              instructions: 'Eye level, elbows up. Alternating fists in rhythm. Start slow, build speed.', videoUrl: 'https://www.youtube.com/watch?v=1BQ1aHq2KJw', mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 180 },
  { name: 'Shadow Boxing',              category: 'mma',         equipment: 'none',     primaryMuscles: ['shoulders','core'],          secondaryMuscles: ['legs'],                 instructions: 'Visualize opponent. Work footwork, angles, level changes. 3-min rounds.',   videoUrl: 'https://www.youtube.com/watch?v=O5l_fU8S_QY', mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 180 },
  { name: 'Shadow Boxing — Muay Thai',  category: 'muay_thai',   equipment: 'none',     primaryMuscles: ['full_body'],                 secondaryMuscles: [],                       instructions: 'Incorporate teeps, roundhouse kicks, knees, elbows. Work stance and timing.', videoUrl: 'https://www.youtube.com/watch?v=cCCt0P-fPnE', mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 180 },
  { name: 'Pad Work — Boxing',          category: 'mma',         equipment: 'pads',     primaryMuscles: ['full_body'],                 secondaryMuscles: [],                       instructions: 'Follow coach calls. Stay sharp, reset after each combo. Work defense.',      videoUrl: 'https://www.youtube.com/watch?v=eFVCGCQriwE', mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 300 },
  { name: 'Pad Work — Muay Thai',       category: 'muay_thai',   equipment: 'pads',     primaryMuscles: ['full_body'],                 secondaryMuscles: [],                       instructions: 'Full Muay Thai combos with holder. All eight weapons.',                     videoUrl: 'https://www.youtube.com/watch?v=r_fTbz9O0sU', mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 300 },
  { name: 'Sparring',                   category: 'mma',         equipment: 'none',     primaryMuscles: ['full_body'],                 secondaryMuscles: [],                       instructions: 'Technical sparring. Apply techniques from training. Respect partners.',     videoUrl: 'https://www.youtube.com/watch?v=qH5t1cSvYqQ', mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 300 },
  { name: 'Clinch Work',                category: 'muay_thai',   equipment: 'none',     primaryMuscles: ['shoulders','traps','core'],  secondaryMuscles: ['neck','legs'],           instructions: 'Inside Muay Thai clinch: neck wrestling, drive knees, create angles.',      videoUrl: 'https://www.youtube.com/watch?v=5ycb0QWpXzc', mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 120 },
  { name: 'Takedown Drilling',          category: 'mma',         equipment: 'none',     primaryMuscles: ['hips','quads','core'],       secondaryMuscles: ['lower_back'],           instructions: 'Shots, double/single legs, hip tosses. Drill with partner, high reps.',    videoUrl: 'https://www.youtube.com/watch?v=xr39VnCkE-E', mediaUrl: null, defaultSets: null, defaultReps: 20, defaultDuration: null },
  { name: 'Sprawl Drill',               category: 'mma',         equipment: 'none',     primaryMuscles: ['hip_flexors','core'],        secondaryMuscles: ['glutes','lower_back'],  instructions: 'Partner shoots, sprawl hips to mat, drive weight down, return to feet.',   videoUrl: 'https://www.youtube.com/watch?v=OfD3tBuTqPE', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Neck Bridge',                category: 'mma',         equipment: 'bodyweight', primaryMuscles: ['neck'],                    secondaryMuscles: ['traps','upper_back'],   instructions: 'On back, push onto crown of head. Rock gently. Progress to full bridge.',  videoUrl: 'https://www.youtube.com/watch?v=nkPp2D_-QFs', mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 30 },
  // BJJ
  { name: 'BJJ Drilling',         category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','full_body'], secondaryMuscles: [],         instructions: 'Repetitive technique drilling with partner or solo.',                         videoUrl: 'https://www.youtube.com/watch?v=jfPXP3L4awE', mediaUrl: null, defaultSets: null, defaultReps: null, defaultDuration: 600 },
  { name: 'BJJ Live Rolling',     category: 'bjj', equipment: 'none', primaryMuscles: ['full_body'],               secondaryMuscles: [],         instructions: 'Full resistance grappling rounds. 5–8 min rounds with varying partners.',    videoUrl: 'https://www.youtube.com/watch?v=UvdHMaAkl4E', mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 300 },
  { name: 'Hip Escape (Shrimp)',  category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips'],             secondaryMuscles: ['glutes'], instructions: 'On back, bridge and shrimp hips sideways to create space. Drill length of mat.', videoUrl: 'https://www.youtube.com/watch?v=YYnHdXGxSfo', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Guard Retention Drill',category: 'bjj', equipment: 'none', primaryMuscles: ['core','hip_flexors'],      secondaryMuscles: ['legs'],   instructions: 'Maintain guard while partner tries to pass. Train sensitivity and reaction.', videoUrl: 'https://www.youtube.com/watch?v=3eNJ_y-15Dw', mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 300 },
  // CARDIO / CONDITIONING
  { name: 'Assault Bike — Steady State', category: 'cardio',       equipment: 'cardio_machine', primaryMuscles: ['full_body'], secondaryMuscles: [], instructions: 'Maintain consistent RPM. Arms and legs together. Good for aerobic base.',    videoUrl: 'https://www.youtube.com/watch?v=0zNQW4vhXLk', mediaUrl: null, defaultSets: 1, defaultReps: null, defaultDuration: 1800 },
  { name: 'Assault Bike — Intervals',    category: 'conditioning', equipment: 'cardio_machine', primaryMuscles: ['full_body'], secondaryMuscles: [], instructions: 'All-out sprint, then rest. E.g. 10s on / 50s off × 10, or Tabata 20/10.',  videoUrl: 'https://www.youtube.com/watch?v=ZKXnq9vXf1w', mediaUrl: null, defaultSets: 10, defaultReps: null, defaultDuration: null },
  { name: 'Treadmill Run',               category: 'cardio',       equipment: 'cardio_machine', primaryMuscles: ['quads','calves','hamstrings'], secondaryMuscles: ['glutes','core'], instructions: 'Steady pace. Land midfoot. Use for base building or tempo.',             videoUrl: 'https://www.youtube.com/watch?v=E5sJZ2xKEqA', mediaUrl: null, defaultSets: 1, defaultReps: null, defaultDuration: 1200 },
  { name: 'Treadmill Sprint Intervals',  category: 'conditioning', equipment: 'cardio_machine', primaryMuscles: ['quads','calves'], secondaryMuscles: ['glutes','hamstrings'], instructions: 'High speed 20–30s, step off or walk for recovery. Repeat.',              videoUrl: 'https://www.youtube.com/watch?v=FRAQdQqiFa0', mediaUrl: null, defaultSets: 8, defaultReps: null, defaultDuration: null },
  { name: 'Rowing Machine — Steady',     category: 'cardio',       equipment: 'cardio_machine', primaryMuscles: ['full_body'], secondaryMuscles: [],          instructions: 'Drive legs, swing back, pull with arms. Maintain consistent pace.',                  videoUrl: 'https://www.youtube.com/watch?v=A-kyKjXRH8c', mediaUrl: null, defaultSets: 1, defaultReps: null, defaultDuration: 1200 },
  { name: 'Rowing Machine — Intervals',  category: 'conditioning', equipment: 'cardio_machine', primaryMuscles: ['full_body'], secondaryMuscles: [],          instructions: '30s hard, 30s easy. Repeat for 15–20 min.',                                           videoUrl: 'https://www.youtube.com/watch?v=JSpZ6u2sXIw', mediaUrl: null, defaultSets: 10, defaultReps: null, defaultDuration: null },
  // BASKETBALL / COURT
  { name: 'Suicide Sprints',       category: 'conditioning', equipment: 'none', primaryMuscles: ['quads','calves'],  secondaryMuscles: ['core'],      instructions: 'Sprint to free throw line and back, half court and back, full court and back.', videoUrl: 'https://www.youtube.com/watch?v=Ln4jVATUMc0', mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: null },
  { name: 'Basketball — Pickup Game', category: 'cardio',    equipment: 'none', primaryMuscles: ['full_body'],       secondaryMuscles: [],            instructions: 'Full game play. Great aerobic/anaerobic interval mix.',                        videoUrl: null, mediaUrl: null, defaultSets: 1, defaultReps: null, defaultDuration: 1800 },
  // RECOVERY / STRETCHING
  { name: 'World\'s Greatest Stretch', category: 'recovery', equipment: 'none', primaryMuscles: ['hips','hamstrings','thoracic_spine'], secondaryMuscles: ['glutes','core'], instructions: 'Lunge forward, elbow to instep, rotate chest open, then switch sides.', videoUrl: 'https://www.youtube.com/watch?v=G5bHHP7qw2c', mediaUrl: null, defaultSets: 2, defaultReps: 6, defaultDuration: null },
  { name: 'Couch Stretch',              category: 'recovery', equipment: 'none', primaryMuscles: ['quads','hip_flexors'], secondaryMuscles: ['glutes'], instructions: 'Rear shin vertical against wall/bench. Tuck pelvis and squeeze glute to open hip flexor.', videoUrl: 'https://www.youtube.com/watch?v=hP6J-_K_KNI', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 90 },
  { name: '90/90 Hip Switch',           category: 'recovery', equipment: 'none', primaryMuscles: ['hips','glutes'], secondaryMuscles: ['core'], instructions: 'Sit in 90/90, rotate knees side to side without using hands if possible.', videoUrl: 'https://www.youtube.com/watch?v=WStahG1OG50', mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Pigeon Stretch',             category: 'recovery', equipment: 'none', primaryMuscles: ['glutes','hips'], secondaryMuscles: ['lower_back'], instructions: 'Front shin across body, extend rear leg, fold forward slowly and breathe.', videoUrl: 'https://www.youtube.com/watch?v=R7k1xLZc6w0', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Hamstring Floss',            category: 'recovery', equipment: 'none', primaryMuscles: ['hamstrings'], secondaryMuscles: ['calves'], instructions: 'From half-kneel, rock hips back while extending front knee and pulling toes up.', videoUrl: 'https://www.youtube.com/watch?v=NhQx2pQHF-k', mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Thoracic Open Book',         category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine'], secondaryMuscles: ['shoulders'], instructions: 'Lie side-on with knees bent, open top arm across body and rotate upper back.', videoUrl: 'https://www.youtube.com/watch?v=aPdDlsL1V2s', mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Bretzel Stretch',            category: 'recovery', equipment: 'none', primaryMuscles: ['quads','hip_flexors','thoracic_spine'], secondaryMuscles: ['glutes'], instructions: 'Side-lying mobility drill for quad/hip plus thoracic rotation.', videoUrl: 'https://www.youtube.com/watch?v=pIdVSfnVE-w', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Ankle Dorsiflexion Wall Drill', category: 'recovery', equipment: 'none', primaryMuscles: ['calves','ankles'], secondaryMuscles: [], instructions: 'Drive knee toward wall over toes while heel stays down; control both directions.', videoUrl: 'https://www.youtube.com/watch?v=zCVzVFAGOFo', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },

  // ── HIP MOBILITY ─────────────────────────────────────────────────────────────
  { name: 'Hip Circle (Standing)',        category: 'recovery', equipment: 'none', primaryMuscles: ['hips','glutes'],                  secondaryMuscles: ['core'],              instructions: 'Stand on one leg, draw large circles with raised knee. Forward and backward. 10 each direction each side.', videoUrl: 'https://www.youtube.com/watch?v=iAB8nJWABKo', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Hip 90/90 Active Rotation',   category: 'recovery', equipment: 'none', primaryMuscles: ['hips','glutes','adductors'],       secondaryMuscles: ['lower_back'],        instructions: 'Sit in 90/90. Actively drive front knee up, hold 2 sec at end range, then lower. Work internal and external rotation.', videoUrl: 'https://www.youtube.com/watch?v=rZ5GOFPfGtA', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Hip Flexor CARS',             category: 'recovery', equipment: 'none', primaryMuscles: ['hip_flexors','hips'],              secondaryMuscles: ['core'],              instructions: 'Controlled articular rotation of the hip. Draw the biggest circle possible with your knee. Slow and deliberate.', videoUrl: 'https://www.youtube.com/watch?v=e3j0Z8hKvYc', mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Deep Squat Hold',             category: 'recovery', equipment: 'none', primaryMuscles: ['hips','ankles','adductors'],       secondaryMuscles: ['lower_back','calves'], instructions: 'Feet shoulder width, toes out. Hold deep squat position with heels flat. Use hands to push knees out if needed.', videoUrl: 'https://www.youtube.com/watch?v=xBSBOEiHQFQ', mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 60 },
  { name: 'Frog Stretch',                category: 'recovery', equipment: 'none', primaryMuscles: ['adductors','hips'],                secondaryMuscles: ['glutes'],            instructions: 'Hands and knees, spread knees wide, feet flared. Rock hips back toward heels. Rock gently in and out.', videoUrl: 'https://www.youtube.com/watch?v=pKGgWJe68bc', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Butterfly Stretch',           category: 'recovery', equipment: 'none', primaryMuscles: ['adductors','hips'],                secondaryMuscles: ['lower_back'],        instructions: 'Sit with soles together, knees out. Hold feet, lean forward keeping back flat. Breathe and relax groin.', videoUrl: 'https://www.youtube.com/watch?v=bkgqH3MH3-U', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Butterfly Leg Flaps',         category: 'recovery', equipment: 'none', primaryMuscles: ['adductors','hips'],                secondaryMuscles: [],                    instructions: 'Soles together. Actively drive knees down, then relax. Use active reps to open the adductors dynamically.', videoUrl: 'https://www.youtube.com/watch?v=PJxV1_MzEi0', mediaUrl: null, defaultSets: 2, defaultReps: 20, defaultDuration: null },
  { name: 'Lizard Stretch',              category: 'recovery', equipment: 'none', primaryMuscles: ['hip_flexors','adductors','hips'],  secondaryMuscles: ['glutes','hamstrings'], instructions: 'Deep lunge, both hands inside front foot. Sink hips low. Can drop rear knee. Reach elbows to floor for deeper stretch.', videoUrl: 'https://www.youtube.com/watch?v=xsj4GwRhJhI', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Half-Kneeling Hip Flexor Stretch', category: 'recovery', equipment: 'none', primaryMuscles: ['hip_flexors','quads'],         secondaryMuscles: ['glutes'],            instructions: 'Kneeling on rear leg. Posteriorly tilt pelvis (squeeze glute), lean forward. Hold, then add overhead reach.', videoUrl: 'https://www.youtube.com/watch?v=EVuEMQTdRXc', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Standing Hip Flexor PAILs/RAILs', category: 'recovery', equipment: 'none', primaryMuscles: ['hip_flexors'],                 secondaryMuscles: ['glutes','core'],     instructions: 'Hold hip flexor stretch, then isometrically pull rear leg forward for 10 sec (PAILs), then try to push it back for 10 sec (RAILs). Increases end-range control.', videoUrl: 'https://www.youtube.com/watch?v=ZjXSgb5N5lQ', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Supine Piriformis Stretch',   category: 'recovery', equipment: 'none', primaryMuscles: ['glutes','piriformis'],             secondaryMuscles: ['hips'],              instructions: 'On back, cross ankle over opposite knee (figure 4). Draw both legs toward chest until glute stretch.', videoUrl: 'https://www.youtube.com/watch?v=IrHO5NVdGjA', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Standing Figure-4 Stretch',   category: 'recovery', equipment: 'none', primaryMuscles: ['glutes','piriformis'],             secondaryMuscles: ['hips'],              instructions: 'Stand, cross ankle over standing knee. Sit back as if on chair. Great for glute/piriformis before drilling.', videoUrl: 'https://www.youtube.com/watch?v=pstqt2WdEDE', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Deep Hip External Rotation PAILs', category: 'recovery', equipment: 'none', primaryMuscles: ['hips','glutes'],              secondaryMuscles: ['adductors'],         instructions: 'In 90/90 front leg, isometrically pull leg into floor (PAILs), then actively lift knee (RAILs). 5-sec contractions, then progress range.', videoUrl: 'https://www.youtube.com/watch?v=Y9TW6Q7qxIk', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Supine Hip Internal Rotation', category: 'recovery', equipment: 'none', primaryMuscles: ['hips','adductors'],               secondaryMuscles: ['glutes'],            instructions: 'On back with both knees up, let one knee fall in toward the other. Important for guard recovery and hip mobility in BJJ.', videoUrl: 'https://www.youtube.com/watch?v=wBM_q3YFN6o', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Cossack Squat',               category: 'recovery', equipment: 'none', primaryMuscles: ['adductors','hips','quads'],        secondaryMuscles: ['glutes','hamstrings'], instructions: 'Feet wide, shift weight to one side into deep lateral lunge. Other leg extended with toes up. Alternate sides.', videoUrl: 'https://www.youtube.com/watch?v=DhYYDrJ0bvk', mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Jefferson Curl',              category: 'recovery', equipment: 'none', primaryMuscles: ['hamstrings','lower_back'],         secondaryMuscles: ['glutes'],            instructions: 'Standing, chin to chest. Roll down vertebra by vertebra until hands reach shins or floor. Control the return. Decompress spine and load hamstrings through full range.', videoUrl: 'https://www.youtube.com/watch?v=c8JxDJN0BIE', mediaUrl: null, defaultSets: 2, defaultReps: 6, defaultDuration: null },

  // ── SHOULDER MOBILITY ────────────────────────────────────────────────────────
  { name: 'Shoulder CARS',               category: 'recovery', equipment: 'none', primaryMuscles: ['shoulders','rotator_cuff'],        secondaryMuscles: ['chest','lats','traps'], instructions: 'Controlled Articular Rotation. Draw the biggest circle with your arm. Keep everything else still. One direction then reverse. Essential daily shoulder maintenance.', videoUrl: 'https://www.youtube.com/watch?v=nkPp2D_-QFs', mediaUrl: null, defaultSets: 2, defaultReps: 3, defaultDuration: null },
  { name: 'Shoulder Dislocates',         category: 'recovery', equipment: 'none', primaryMuscles: ['shoulders','rotator_cuff'],        secondaryMuscles: ['chest','lats'],      instructions: 'Use PVC pipe or band, wide grip. Swing arms overhead and behind in one arc. Progressively narrow grip as mobility improves.', videoUrl: 'https://www.youtube.com/watch?v=8lDC4Ri9zAQ', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Wall Slide',                  category: 'recovery', equipment: 'none', primaryMuscles: ['rotator_cuff','serratus','traps'], secondaryMuscles: ['shoulders'],         instructions: 'Stand against wall, arms bent 90°. Slide arms up overhead while keeping elbows and wrists in contact with wall.', videoUrl: 'https://www.youtube.com/watch?v=F7dP2Mfn-4c', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Sleeper Stretch',             category: 'recovery', equipment: 'none', primaryMuscles: ['posterior_shoulder','rotator_cuff'], secondaryMuscles: [],                 instructions: 'Lie on stretched arm with shoulder at 90°. Use other hand to press wrist toward bed. Targets internal rotation — critical for BJJ guard players.', videoUrl: 'https://www.youtube.com/watch?v=4GDFOP5QC5U', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Cross-Body Shoulder Stretch', category: 'recovery', equipment: 'none', primaryMuscles: ['posterior_shoulder','rear_delts'], secondaryMuscles: ['rotator_cuff'],      instructions: 'Bring one arm across chest, use other arm to pull gently. Hold. Good for posterior capsule tightness.', videoUrl: 'https://www.youtube.com/watch?v=w0LJqZaAJbY', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Thread the Needle',           category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine','shoulders'],      secondaryMuscles: ['lats'],              instructions: 'On hands and knees, thread one arm under the other and rotate upper back. Hold. Great for thoracic rotation paired with shoulder opening.', videoUrl: 'https://www.youtube.com/watch?v=EyoIHJpNIsQ', mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Band Pull-Apart',             category: 'recovery', equipment: 'none', primaryMuscles: ['rear_delts','rhomboids'],          secondaryMuscles: ['rotator_cuff'],      instructions: 'Hold band at shoulder height with straight arms. Pull apart to full extension, squeeze shoulder blades. Daily shoulder health and posture.', videoUrl: 'https://www.youtube.com/watch?v=keSXm52AHRs', mediaUrl: null, defaultSets: 3, defaultReps: 20, defaultDuration: null },
  { name: 'Doorway Chest Stretch',       category: 'recovery', equipment: 'none', primaryMuscles: ['chest','front_delts'],             secondaryMuscles: ['biceps'],            instructions: 'Forearm on doorframe at 90°. Turn body away to stretch chest and shoulder. Hold 30 sec each side.', videoUrl: 'https://www.youtube.com/watch?v=yvZzNqkQ_iI', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Overhead Banded Shoulder Stretch', category: 'recovery', equipment: 'none', primaryMuscles: ['lats','shoulders'],          secondaryMuscles: ['chest'],             instructions: 'Attach band to high anchor. Face it and hold, walk back until arms overhead. Hinge hips back and let head drop between arms.', videoUrl: 'https://www.youtube.com/watch?v=WEDyvCDEnbo', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Shoulder Elevation Shrug Rolls', category: 'recovery', equipment: 'none', primaryMuscles: ['traps','shoulders'],           secondaryMuscles: [],                    instructions: 'Slow shoulder rolls forward and backward. Exaggerate range at top and bottom. Releases upper trap tension common in BJJ players from gripping.', videoUrl: 'https://www.youtube.com/watch?v=eFRJMjXZ9V0', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Lat Stretch on Pull-up Bar',  category: 'recovery', equipment: 'bodyweight', primaryMuscles: ['lats'],                     secondaryMuscles: ['shoulders'],         instructions: 'Hang and actively shift hips side to side, pulling each lat into stretch. Can also single arm hang rotating torso away.', videoUrl: 'https://www.youtube.com/watch?v=jk8WBNL1P74', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Prone Shoulder ER Stretch',   category: 'recovery', equipment: 'none', primaryMuscles: ['rotator_cuff','rear_delts'],       secondaryMuscles: [],                    instructions: 'Face down, arm at 90° bent at elbow. Gently press back of hand toward floor. Targets external rotation of shoulder — frequent deficiency in grapplers.', videoUrl: 'https://www.youtube.com/watch?v=IjhFEe5WVGE', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Supine Shoulder Windmill',    category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine','shoulders'],      secondaryMuscles: ['chest','lats'],      instructions: 'Lie on side, knees bent 90°. Sweep top arm in full arc overhead and behind. Follow hand with eyes. Integrates shoulder with thoracic rotation.', videoUrl: 'https://www.youtube.com/watch?v=aPdDlsL1V2s', mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },

  // ── BJJ-SPECIFIC MOBILITY & WARMUP DRILLS ────────────────────────────────────
  { name: 'Granby Roll',                 category: 'bjj', equipment: 'none', primaryMuscles: ['core','neck','shoulders'],    secondaryMuscles: ['hips'],              instructions: 'From seated, roll diagonally off one shoulder to come out on the other side. Key defensive movement for guard recovery and scrambles. Drill each side.', videoUrl: 'https://www.youtube.com/watch?v=FyHDi3QLU88', mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Inversion Drill',             category: 'bjj', equipment: 'none', primaryMuscles: ['core','neck','hips'],         secondaryMuscles: ['shoulders'],         instructions: 'From guard sit-up position, invert neck and post with shoulders, kick legs overhead. Fundamental for De la Riva, X-guard, and leg entanglements.', videoUrl: 'https://www.youtube.com/watch?v=NWTF2G8UJYU', mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Technical Stand-up',          category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','glutes'],       secondaryMuscles: ['quads','shoulders'],  instructions: 'From sitting, post one hand behind, cross legs, rise to base. Hip movement for getting to feet from bottom position.', videoUrl: 'https://www.youtube.com/watch?v=mEKOTRJfqrc', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Guard Get-up',                category: 'bjj', equipment: 'none', primaryMuscles: ['core','hip_flexors','hips'],  secondaryMuscles: ['glutes'],            instructions: 'From guard on back, hip escape, sit-up to base, technical stand. Chain movements continuously.', videoUrl: 'https://www.youtube.com/watch?v=K7SvuFhYEIs', mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Bridge and Roll',             category: 'bjj', equipment: 'none', primaryMuscles: ['glutes','core','hips'],       secondaryMuscles: ['hamstrings'],        instructions: 'On back, drive heels into floor and bridge explosively. Post on top of head and shoulder, roll to escape bottom. Fundamental mount escape movement.', videoUrl: 'https://www.youtube.com/watch?v=CyLHbOb-Ehk', mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Front Roll',                  category: 'bjj', equipment: 'none', primaryMuscles: ['core','neck','shoulders'],    secondaryMuscles: ['hips'],              instructions: 'Tuck chin, roll over shoulder, come up to base. Breakfall skill for takedown defense. Keep chin tucked throughout.', videoUrl: 'https://www.youtube.com/watch?v=D2fqrPV9bx0', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Back Roll',                   category: 'bjj', equipment: 'none', primaryMuscles: ['core','neck'],                secondaryMuscles: ['shoulders'],         instructions: 'Sit, tuck chin, roll backward over one shoulder. Come up on that side. Alternate sides.', videoUrl: 'https://www.youtube.com/watch?v=0w6mzE53iBg', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Seated Hip Internal/External Rotation', category: 'bjj', equipment: 'none', primaryMuscles: ['hips','glutes','adductors'], secondaryMuscles: [], instructions: 'Seated, one leg extended. Rotate extended knee inward (internal), then outward (external) as far as possible. Drills hip rotation range for guard play and sweeps.', videoUrl: 'https://www.youtube.com/watch?v=wBM_q3YFN6o', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Guard Hip Shift',             category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','obliques'],     secondaryMuscles: ['glutes'],            instructions: 'On back in guard position. Rapidly shift hips from side to side. Drill hip recovery timing. Drive off feet, keep core engaged.', videoUrl: 'https://www.youtube.com/watch?v=YYnHdXGxSfo', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Defensive Hip Escape Solo',   category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips'],               secondaryMuscles: ['glutes','shoulders'], instructions: 'On back, alternate shrimping each direction down the mat. Full extension and recovery. Solo drill without partner. Critical for escapes from all bottom positions.', videoUrl: 'https://www.youtube.com/watch?v=YYnHdXGxSfo', mediaUrl: null, defaultSets: 4, defaultReps: 20, defaultDuration: null },
  { name: 'Seated Spine Rotation',       category: 'bjj', equipment: 'none', primaryMuscles: ['thoracic_spine','obliques'], secondaryMuscles: ['core','shoulders'],   instructions: 'Seated cross-legged, hands behind head. Rotate slowly as far as possible each direction. Essential for scrambles, switch-base escapes, and turtle defence.', videoUrl: 'https://www.youtube.com/watch?v=LKCv3eLJpkA', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'BJJ Hip Mobility Flow',       category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core'],               secondaryMuscles: ['glutes','adductors'], instructions: 'Chain: 90/90 → butterfly → seated figure-4 → pigeon → back to 90/90 on other side. Flow without stopping. Full lower body mobility sequence.', videoUrl: 'https://www.youtube.com/watch?v=mZ6mCBxgXl4', mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Neck Circles',               category: 'bjj', equipment: 'none', primaryMuscles: ['neck'],                       secondaryMuscles: ['traps'],              instructions: 'Slow controlled circles in each direction. Essential pre-rolling neck prep. Never rush — stop if pain (distinct from discomfort).', videoUrl: 'https://www.youtube.com/watch?v=xwWmHN1Qhqk', mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Neck Isometric Holds',        category: 'bjj', equipment: 'none', primaryMuscles: ['neck'],                       secondaryMuscles: ['traps'],              instructions: 'Press hand against forehead, side of head, back of head. Push isometrically in each direction for 10 sec. Builds neck strength for scrambles and turtle.', videoUrl: 'https://www.youtube.com/watch?v=iyAynN4g0qE', mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 10 },
  { name: 'Wrestler\'s Bridge',          category: 'bjj', equipment: 'bodyweight', primaryMuscles: ['neck','glutes','lower_back'],  secondaryMuscles: ['traps','shoulders'], instructions: 'On head and heels, arch up into full bridge. Rock forward and back. Builds neck and back strength critical for surviving bottom positions.', videoUrl: 'https://www.youtube.com/watch?v=kHiU72IFZ5k', mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 30 },
  { name: 'Groin Hip Adductor Slide',    category: 'bjj', equipment: 'none', primaryMuscles: ['adductors','hips'],           secondaryMuscles: ['glutes'],            instructions: 'On all fours, slide one knee out wide along floor, lower hips toward it. Rock into end range. Targets adductor for guard guard retention and closed guard flexibility.', videoUrl: 'https://www.youtube.com/watch?v=PJxV1_MzEi0', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Hip Flexor / Psoas Release',  category: 'recovery', equipment: 'none', primaryMuscles: ['hip_flexors'],            secondaryMuscles: ['quads'],             instructions: 'Low lunge, front knee over ankle. Tuck pelvis, squeeze glute. Can add lateral reach to further lengthen psoas. Important for grapplers who spend time in seated guard.', videoUrl: 'https://www.youtube.com/watch?v=EVuEMQTdRXc', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Standing Forward Fold',       category: 'recovery', equipment: 'none', primaryMuscles: ['hamstrings','lower_back'], secondaryMuscles: ['calves'],             instructions: 'Feet hip-width. Hinge at hips and hang. Relax neck. Bend knees slightly if hamstrings are tight. Good for post-training decompression.', videoUrl: 'https://www.youtube.com/watch?v=v-AiCaOtqvU', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Supine Spinal Twist',         category: 'recovery', equipment: 'none', primaryMuscles: ['lower_back','thoracic_spine'], secondaryMuscles: ['hips','glutes'],  instructions: 'On back, pull one knee across body with opposite hand. Keep shoulder on floor. Breathe deeply into the rotation.', videoUrl: 'https://www.youtube.com/watch?v=0EhGNBV4-e8', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Child\'s Pose',               category: 'recovery', equipment: 'none', primaryMuscles: ['lower_back','lats'],       secondaryMuscles: ['hips','shoulders'],  instructions: 'Kneel, sit back to heels, reach arms forward on floor. Breathe slowly. Can walk hands to each side to target lats.', videoUrl: 'https://www.youtube.com/watch?v=O94tpTSh2dQ', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Foam Roll Thoracic Spine',    category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine'],           secondaryMuscles: ['lats','shoulders'],  instructions: 'Foam roller across upper back. Support head, extend over roller one segment at a time. Do not roll lumbar spine.', videoUrl: 'https://www.youtube.com/watch?v=DkN30GF0LLc', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Foam Roll Hip Flexors',       category: 'recovery', equipment: 'none', primaryMuscles: ['hip_flexors'],              secondaryMuscles: ['quads'],             instructions: 'Face down, roller below hip on quad/psoas area. Shift weight and roll slowly. Stop and breathe into tender spots.', videoUrl: 'https://www.youtube.com/watch?v=dJnVRD5rXU4', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Foam Roll Adductors',         category: 'recovery', equipment: 'none', primaryMuscles: ['adductors'],                secondaryMuscles: ['hips'],              instructions: 'Face down, inner thigh on roller. Bend knee and roll from groin to just above knee. Stop on tight spots. Critical after heavy guard work in BJJ.', videoUrl: 'https://www.youtube.com/watch?v=P1MRCJc7ofc', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Foam Roll Lats',              category: 'recovery', equipment: 'none', primaryMuscles: ['lats'],                     secondaryMuscles: ['shoulders'],         instructions: 'Side-lying, arm overhead. Roll from armpit to lower lat. Helps unblock shoulder flexion and decompress after overhead pulling.', videoUrl: 'https://www.youtube.com/watch?v=eSxDJZ4y2aI', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'Cat-Cow',                     category: 'recovery', equipment: 'none', primaryMuscles: ['lower_back','thoracic_spine'], secondaryMuscles: ['core','neck'],     instructions: 'On hands and knees. Arch spine fully (cow), then round fully (cat). Slow and controlled. Good spinal warm-up before any session.', videoUrl: 'https://www.youtube.com/watch?v=kqnua4rHVVA', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Quadruped Hip CARs',          category: 'recovery', equipment: 'none', primaryMuscles: ['hips','glutes'],            secondaryMuscles: ['core'],              instructions: 'On hands and knees, one knee up. Draw the biggest circle possible without moving spine. Controlled articular rotation of the hip. Fundamental joint maintenance.', videoUrl: 'https://www.youtube.com/watch?v=e3j0Z8hKvYc', mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Thoracic Extension over Roller', category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine'],        secondaryMuscles: ['lats','chest'],      instructions: 'Sit in front of foam roller, place mid-back on it, hands behind head. Extend backward over roller. Move up one segment at a time from T5 to T12.', videoUrl: 'https://www.youtube.com/watch?v=DkN30GF0LLc', mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Supine Knee-to-Chest',        category: 'recovery', equipment: 'none', primaryMuscles: ['lower_back','glutes','hips'], secondaryMuscles: [],                  instructions: 'On back, draw both knees to chest, hug tight, rock gently side to side. Simple lower back decompression after hard training.', videoUrl: 'https://www.youtube.com/watch?v=UGe10MxHaF0', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Doorway Wrist Stretch',       category: 'recovery', equipment: 'none', primaryMuscles: ['forearms','wrists'],        secondaryMuscles: [],                    instructions: 'Place palm on wall with fingers pointing down. Gently straighten elbow to stretch forearm flexors. Essential for BJJ athletes due to gripping volume.', videoUrl: 'https://www.youtube.com/watch?v=RBzNUm3jWRc', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  // ── Nick's home/park equipment ─────────────────────────────────────────────
  { name: 'Wide Push-up',              category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['chest','front_delts'],    secondaryMuscles: ['triceps','serratus'],     instructions: 'Hands 1.5–2x shoulder width. Lower chest to floor leading with elbows flared. Full range. Targets outer chest.', videoUrl: 'https://www.youtube.com/watch?v=IODxDxX7oi4', mediaUrl: null, defaultSets: 4, defaultReps: 12, defaultDuration: null },
  { name: 'Pike Push-up',              category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['front_delts','side_delts'], secondaryMuscles: ['triceps'],               instructions: 'Hips high, body in inverted V. Bend elbows to lower head toward floor. Press back up. Shoulder press pattern without weight.', videoUrl: 'https://www.youtube.com/watch?v=ytKP7b3bVDg', mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Push-up Board Wide',        category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['chest'],                   secondaryMuscles: ['front_delts','triceps'],  instructions: 'Use push-up board at widest position. Greater chest stretch at bottom. Full range.', videoUrl: 'https://www.youtube.com/watch?v=IODxDxX7oi4', mediaUrl: null, defaultSets: 4, defaultReps: 12, defaultDuration: null },
  { name: 'Push-up Board Narrow',      category: 'strength',     equipment: 'bodyweight', primaryMuscles: ['triceps'],                 secondaryMuscles: ['chest','front_delts'],    instructions: 'Use push-up board at narrow position. Elbows close to body. Maximizes tricep involvement.', videoUrl: 'https://www.youtube.com/watch?v=7hv0TY3dj_c', mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Ab Roller Rollout',         category: 'strength',     equipment: 'none',       primaryMuscles: ['abs','core'],              secondaryMuscles: ['lats','hip_flexors'],     instructions: 'Kneel, roller under shoulders. Roll forward until body nearly parallel with ground. Pull back using abs — do NOT use hip flexors. One of the best core exercises.', videoUrl: 'https://www.youtube.com/watch?v=wBpqXSBqSHo', mediaUrl: null, defaultSets: 4, defaultReps: 8, defaultDuration: null },
  { name: 'Ab Roller Knee Tuck',       category: 'strength',     equipment: 'none',       primaryMuscles: ['abs','core'],              secondaryMuscles: ['hip_flexors'],           instructions: 'Full extension then pull knees to chest using core. Combines rollout with crunch.', videoUrl: 'https://www.youtube.com/watch?v=wBpqXSBqSHo', mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Resistance Band Row',       category: 'strength',     equipment: 'none',       primaryMuscles: ['lats','rhomboids'],        secondaryMuscles: ['biceps','rear_delts'],    instructions: 'Anchor band at mid-height. Row handles to waist, squeeze shoulder blades. Pause 1s. Control the return.', videoUrl: 'https://www.youtube.com/watch?v=mRAq9GnTlME', mediaUrl: null, defaultSets: 4, defaultReps: 15, defaultDuration: null },
  { name: 'Resistance Band Bicep Curl', category: 'strength',    equipment: 'none',       primaryMuscles: ['biceps'],                  secondaryMuscles: ['forearms'],              instructions: 'Stand on band. Curl both handles toward shoulders. Fully extend and supinate at top.', videoUrl: 'https://www.youtube.com/watch?v=4EZUQM0GGIY', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Resistance Band Tricep Extension', category: 'strength', equipment: 'none',   primaryMuscles: ['triceps'],                 secondaryMuscles: [],                        instructions: 'Anchor band high. Face away, extend forearms forward and down. Squeeze triceps at full extension.', videoUrl: 'https://www.youtube.com/watch?v=vB5OHsJ3EME', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Resistance Band Lateral Raise', category: 'strength', equipment: 'none',      primaryMuscles: ['side_delts'],              secondaryMuscles: ['front_delts','traps'],   instructions: 'Stand on band. Raise arms to shoulder height in a T shape. Slow controlled negative.', videoUrl: 'https://www.youtube.com/watch?v=DQnlKlHELM4', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Resistance Band Face Pull',  category: 'strength',    equipment: 'none',       primaryMuscles: ['rear_delts','rotator_cuff'], secondaryMuscles: ['rhomboids','traps'],   instructions: 'Anchor at eye level. Pull handles to face, elbows flared high, external rotate at end. Shoulder health essential.', videoUrl: 'https://www.youtube.com/watch?v=V8dZ3zbl3aE', mediaUrl: null, defaultSets: 3, defaultReps: 20, defaultDuration: null },
  { name: 'Bodyweight Squat',           category: 'strength',    equipment: 'bodyweight', primaryMuscles: ['quads','glutes'],          secondaryMuscles: ['hamstrings','core'],      instructions: 'Feet shoulder width, toes slightly out. Sit hips back and down. Drive knees out. Full depth. Drive through whole foot to stand.', videoUrl: 'https://www.youtube.com/watch?v=gsNoPYwWXeM', mediaUrl: null, defaultSets: 4, defaultReps: 20, defaultDuration: null },
  { name: 'Bodyweight Bulgarian Split Squat', category: 'strength', equipment: 'bodyweight', primaryMuscles: ['quads','glutes'],     secondaryMuscles: ['hamstrings','balance'],   instructions: 'Rear foot elevated on chair/bench. Front foot forward. Squat down until rear knee nears floor. Harder than it looks — builds serious legs.', videoUrl: 'https://www.youtube.com/watch?v=nZJzaVdpTGI', mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Reverse Lunge',              category: 'strength',    equipment: 'bodyweight', primaryMuscles: ['quads','glutes'],          secondaryMuscles: ['hamstrings','balance'],   instructions: 'Step backward, lower rear knee to hover. Front knee tracks over foot. Push through front heel to return. Less impact than forward lunge.', videoUrl: 'https://www.youtube.com/watch?v=xrjENewgFoQ', mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Jump Rope',                  category: 'conditioning', equipment: 'none',      primaryMuscles: ['calves','cardio'],         secondaryMuscles: ['shoulders','core'],       instructions: 'Light bounce on balls of feet. Arms stay tucked. Start 2 min steady, progress to intervals. Weighted rope adds upper body demand.', videoUrl: 'https://www.youtube.com/watch?v=FJmRQ5iTXKE', mediaUrl: null, defaultSets: 1, defaultReps: null, defaultDuration: 180 },
  { name: 'Weighted Jump Rope',         category: 'conditioning', equipment: 'none',      primaryMuscles: ['calves','shoulders','cardio'], secondaryMuscles: ['forearms','core'],   instructions: 'Same as jump rope but heavier rope increases shoulder and grip demand. Do 45s on / 15s rest intervals.', videoUrl: 'https://www.youtube.com/watch?v=FJmRQ5iTXKE', mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 45 },
  { name: 'Hollow Body Hold',           category: 'strength',    equipment: 'bodyweight', primaryMuscles: ['abs','core'],              secondaryMuscles: ['hip_flexors'],           instructions: 'Lie on back, press lower back into floor. Raise legs and shoulders slightly. Arms overhead. Hold the tension. The foundation of a strong midsection.', videoUrl: 'https://www.youtube.com/watch?v=2wEgSHBgrQI', mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 30 },
  { name: 'Hollow Body Rock',           category: 'strength',    equipment: 'bodyweight', primaryMuscles: ['abs','core'],              secondaryMuscles: ['hip_flexors'],           instructions: 'From hollow hold, rock back and forth maintaining the shape. No breaking at hips.', videoUrl: 'https://www.youtube.com/watch?v=2wEgSHBgrQI', mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'V-Up',                       category: 'strength',    equipment: 'bodyweight', primaryMuscles: ['abs','hip_flexors'],       secondaryMuscles: ['core'],                  instructions: 'Lie flat, legs and arms extended. Simultaneously raise legs and torso, reach hands toward feet. Lower with control.', videoUrl: 'https://www.youtube.com/watch?v=iP2fjvG0g3w', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Lying Leg Raise',            category: 'strength',    equipment: 'bodyweight', primaryMuscles: ['abs','hip_flexors'],       secondaryMuscles: ['core'],                  instructions: 'Lie flat, legs straight. Raise to 90° keeping lower back pressed to floor. Lower slowly — do NOT let lower back arch at the bottom.', videoUrl: 'https://www.youtube.com/watch?v=Wp4BlxcFTkE', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Dead Bug',                   category: 'strength',    equipment: 'bodyweight', primaryMuscles: ['abs','core'],              secondaryMuscles: ['hip_flexors'],           instructions: 'On back, arms up, knees 90°. Extend opposite arm and leg while pressing lower back to floor. The key is not letting your back arch — builds real anti-extension core strength.', videoUrl: 'https://www.youtube.com/watch?v=4XLEnwUr1d8', mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Calf Raise (bodyweight)',    category: 'strength',    equipment: 'bodyweight', primaryMuscles: ['calves'],                  secondaryMuscles: [],                        instructions: 'Stand on edge of step or flat. Rise on balls of feet, full extension. Lower slowly past neutral for full stretch. Can load with a backpack.', videoUrl: 'https://www.youtube.com/watch?v=gwLzBJYoWlI', mediaUrl: null, defaultSets: 4, defaultReps: 25, defaultDuration: null },

  // ── GYM EXERCISES NOT YET IN LIBRARY ─────────────────────────────────────────
  { name: 'EZ-Bar Curl',               category: 'strength', equipment: 'barbell', primaryMuscles: ['biceps'],         secondaryMuscles: ['brachialis','forearms'],  instructions: 'EZ-bar reduces wrist strain vs straight bar. Full extension at bottom, curl to chin. Keep elbows pinned.', videoUrl: 'https://www.youtube.com/watch?v=zG2p4k2IdAo', mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Calf Raise (machine)',       category: 'strength', equipment: 'machine', primaryMuscles: ['calves'],         secondaryMuscles: [],                        instructions: 'Full range of motion — lower heel below pad level for the stretch. Pause at top for 1s. Better range than bodyweight version.', videoUrl: 'https://www.youtube.com/watch?v=gwLzBJYoWlI', mediaUrl: null, defaultSets: 4, defaultReps: 20, defaultDuration: null },
  { name: 'Overhead Tricep Extension', category: 'strength', equipment: 'cable_machine', primaryMuscles: ['triceps'],  secondaryMuscles: [],                        instructions: 'Cable or single dumbbell. Keep elbows close to head. Full stretch behind head, extend to lockout. Long head of tricep gets stretched here.', videoUrl: 'https://www.youtube.com/watch?v=2yVyK1K-OOo', mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Pec Deck',                  category: 'strength', equipment: 'machine', primaryMuscles: ['chest'],          secondaryMuscles: ['front_delts'],           instructions: 'Machine chest fly. Slight bend in elbows, squeeze pecs together at peak contraction. Control the eccentric — feel the stretch at full open.', videoUrl: 'https://www.youtube.com/watch?v=bnHyMiGMmvg', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Incline Dumbbell Press',    category: 'strength', equipment: 'dumbbell', primaryMuscles: ['upper_chest','front_delts'], secondaryMuscles: ['triceps'], instructions: 'Bench at 30–45°. Press dumbbells from chest up and slightly together. Full stretch at bottom.', videoUrl: 'https://www.youtube.com/watch?v=8iPEnn-ltC8', mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Dumbbell Overhead Press',   category: 'strength', equipment: 'dumbbell', primaryMuscles: ['front_delts','side_delts'], secondaryMuscles: ['triceps'], instructions: 'Seated or standing. Press dumbbells from shoulder height to lockout overhead. Control the descent.', videoUrl: 'https://www.youtube.com/watch?v=qEwKn7FlQ9Q', mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Single-Arm Dumbbell Row',   category: 'strength', equipment: 'dumbbell', primaryMuscles: ['lats','rhomboids'], secondaryMuscles: ['biceps','rear_delts'], instructions: 'Support on bench. Row dumbbell to ribcage keeping elbow close. Full stretch at bottom. 12 per side.', videoUrl: 'https://www.youtube.com/watch?v=K0zFKw3MIeE', mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },
  { name: 'Cable Wood Chop (High)',     category: 'strength', equipment: 'cable_machine', primaryMuscles: ['obliques','core'], secondaryMuscles: ['shoulders','lats'], instructions: 'High pulley to one side. Pull diagonally across body in chopping motion. 12 per side.', videoUrl: 'https://www.youtube.com/watch?v=7Vzy0LG3lZI', mediaUrl: null, defaultSets: 3, defaultReps: 12, defaultDuration: null },

  // ── MUAY THAI — STRIKES ──────────────────────────────────────────────────────
  { name: 'Jab Drill',                      category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','chest'],           secondaryMuscles: ['triceps','core'],          instructions: 'From stance, extend lead hand straight. Rotate shoulder into it, snap back fast. Keep rear hand protecting chin. Drill in front of mirror for form, then on bag.', videoUrl: 'https://www.youtube.com/watch?v=CknYN_pO_qQ', mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 60 },
  { name: 'Cross Drill',                    category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','chest'],           secondaryMuscles: ['core','hips','triceps'],   instructions: 'Rotate rear hip and shoulder, drive rear hand straight. Full hip rotation is power — the hand just delivers it. Pivot on rear foot.', videoUrl: 'https://www.youtube.com/watch?v=CknYN_pO_qQ', mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 60 },
  { name: 'Hook Drill',                     category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','chest','core'],    secondaryMuscles: ['obliques','biceps'],       instructions: 'Short arc punch. Elbow at 90°, pivot on lead foot, rotate hips. Keep elbow level with fist. Power from hip rotation not arm swing.', videoUrl: 'https://www.youtube.com/watch?v=Rc7G6sXt6k4', mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 60 },
  { name: 'Uppercut Drill',                 category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','triceps'],         secondaryMuscles: ['legs','core'],             instructions: 'Drop slightly, drive up from legs through hip then shoulder. Fist palm-in, elbow stays inside body. Lead or rear. Good for inside range.', videoUrl: 'https://www.youtube.com/watch?v=t0_RKDGZ2R8', mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 60 },
  { name: 'Teep (Front Push Kick)',          category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hip_flexors','quads'],         secondaryMuscles: ['calves','core'],           instructions: 'Lift knee high, extend leg and push through the ball of foot. Snaps hips forward on release. Range tool and defense. Aim for midsection. Re-chamber before landing.', videoUrl: 'https://www.youtube.com/watch?v=t3CGXchXWbM', mediaUrl: null, defaultSets: 3, defaultReps: 20, defaultDuration: null },
  { name: 'Rear Teep',                      category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hip_flexors','quads','glutes'], secondaryMuscles: ['core','calves'],          instructions: 'Rear leg teep — more power than lead. Drive hips forward aggressively. Great for stopping forward pressure. Pivot stance foot on delivery.', videoUrl: 'https://www.youtube.com/watch?v=t3CGXchXWbM', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Roundhouse Kick — Low',          category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hips','quads','glutes'],       secondaryMuscles: ['calves','core'],           instructions: 'Pivot on plant foot, swing hip over. Cut through target with shin, not foot. Target outer thigh. Step in at 45° for power. Low kicks win fights.', videoUrl: 'https://www.youtube.com/watch?v=H_LL5ZNXPKE', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Roundhouse Kick — Body',         category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hips','core','glutes'],        secondaryMuscles: ['obliques','calves'],       instructions: 'Same mechanics as low kick but aim for liver or floating ribs. Slightly more hip rotation needed. Opponent will not check this — body kicks score well.', videoUrl: 'https://www.youtube.com/watch?v=H_LL5ZNXPKE', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Roundhouse Kick — Head',         category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hips','adductors','glutes'],   secondaryMuscles: ['core','calves'],           instructions: 'Full hip rotation and hip flexor flexibility required. Taller chamber, drive hip over. Keep hands up. Often set up by feinting low first.', videoUrl: 'https://www.youtube.com/watch?v=H_LL5ZNXPKE', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Switch Kick',                    category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hips','quads'],               secondaryMuscles: ['core','calves'],           instructions: 'Quick switch of feet to kick with lead leg at power of rear. Step, switch, kick in one fluid motion. Creates angles and disguises the kick.', videoUrl: 'https://www.youtube.com/watch?v=gNYmCKGxpNE', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Spinning Back Kick',             category: 'muay_thai', equipment: 'none',  primaryMuscles: ['glutes','hamstrings','core'],  secondaryMuscles: ['quads','calves'],          instructions: 'Turn 180° looking over shoulder, thrust heel straight back. One of the most powerful kicks. Spot target before extending. Can wind opponent instantly.', videoUrl: 'https://www.youtube.com/watch?v=9mZ-rnNZ5go', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Knee Strike — Long Range',       category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hip_flexors','quads','core'],  secondaryMuscles: ['glutes','calves'],         instructions: 'Skip step in, pull down on invisible head, drive knee upward. Hips forward at impact. Target solar plexus or floating ribs.', videoUrl: 'https://www.youtube.com/watch?v=qp3RXoSTHlo', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Clinch Knee — Diagonal',         category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hip_flexors','obliques','core'], secondaryMuscles: ['glutes','adductors'],    instructions: 'From clinch, step slightly to outside, diagonal knee to body. Avoids opponent\'s blocking elbow. Alternate sides for consistent threat.', videoUrl: 'https://www.youtube.com/watch?v=qp3RXoSTHlo', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Jumping Knee (Kao Loi)',         category: 'muay_thai', equipment: 'none',  primaryMuscles: ['hip_flexors','quads','core'],  secondaryMuscles: ['calves','glutes'],         instructions: 'Leap off rear foot, drive lead knee upward. Advanced technique — requires explosive power and setup. Usually off clinch break or guard drop.', videoUrl: 'https://www.youtube.com/watch?v=QxePaYmomfA', mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
  { name: 'Horizontal Elbow (Sok Tad)',     category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','core'],           secondaryMuscles: ['triceps','chest'],         instructions: 'Swing elbow across at throat/temple height. Full hip rotation. Short range. Most common cutting elbow.', videoUrl: 'https://www.youtube.com/watch?v=CQWBVJm-Bsg', mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Diagonal Elbow (Sok Chieng)',    category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','chest','core'],   secondaryMuscles: ['triceps','obliques'],      instructions: 'Downward diagonal elbow from high to low. Targets bridge of nose or temple. Often follows a caught kick or during clinch exit.', videoUrl: 'https://www.youtube.com/watch?v=CQWBVJm-Bsg', mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Upward Elbow (Sok Ngad)',        category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','core'],           secondaryMuscles: ['legs','obliques'],         instructions: 'Drive elbow upward into chin as opponent ducks. Push off rear leg. Anticipation tool — set up with body punch then uppercut elbow.', videoUrl: 'https://www.youtube.com/watch?v=CQWBVJm-Bsg', mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Spinning Back Elbow',            category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','core','obliques'], secondaryMuscles: ['hips'],                   instructions: '180° spin, drive rear elbow behind you into opponent\'s face. Spot before striking. High risk but devastating when landed. Often off parry.', videoUrl: 'https://www.youtube.com/watch?v=xg7u43eH66c', mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },

  // ── MUAY THAI — CLINCH & DEFENSE ─────────────────────────────────────────────
  { name: 'Double Collar Tie (Plum)',       category: 'muay_thai', equipment: 'none',  primaryMuscles: ['shoulders','traps','forearms'], secondaryMuscles: ['core','neck'],           instructions: 'Both hands behind opponent\'s head, elbows pointing in. Control the head, pull down into knees. Prevent opponent from framing out.', videoUrl: 'https://www.youtube.com/watch?v=5ycb0QWpXzc', mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 120 },
  { name: 'Inside Clinch Sweep (Dteh Chiang)', category: 'muay_thai', equipment: 'none', primaryMuscles: ['hips','legs','core'],        secondaryMuscles: ['shoulders','traps'],       instructions: 'From clinch, hook opponent\'s lead leg with your lead, pull head down and sweep. Torque upper body opposite direction of sweep.', videoUrl: 'https://www.youtube.com/watch?v=Cz7w0-CDQDY', mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Muay Thai Footwork — Triangle',  category: 'muay_thai', equipment: 'none',  primaryMuscles: ['calves','quads'],             secondaryMuscles: ['core','hips'],             instructions: 'Step to outside of opponent at 45°, then triangle back to center. Creates angles for body kicks and avoids counter. Drill both directions.', videoUrl: 'https://www.youtube.com/watch?v=uxz8vlBNJqc', mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 60 },
  { name: 'Muay Thai Footwork — Pivot',     category: 'muay_thai', equipment: 'none',  primaryMuscles: ['calves','hips'],              secondaryMuscles: ['core'],                    instructions: 'Plant lead foot, pivot 90° out of line. Creates outside angle and off-angles for attacks. Practice both directions.', videoUrl: 'https://www.youtube.com/watch?v=uxz8vlBNJqc', mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 60 },
  { name: 'Parry and Counter Drill',        category: 'muay_thai', equipment: 'pads',  primaryMuscles: ['shoulders','core'],           secondaryMuscles: ['forearms','hips'],         instructions: 'With partner: parry jab outside, return cross. Parry cross, return hook. Trains timing and counter instinct. Critical for Muay Thai IQ.', videoUrl: 'https://www.youtube.com/watch?v=qjcwGt3UpUE', mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 180 },
  { name: 'Slip and Counter',              category: 'muay_thai', equipment: 'none',  primaryMuscles: ['core','obliques'],            secondaryMuscles: ['legs','shoulders'],        instructions: 'Slip incoming jab/cross outside by moving head offline. Drive rear hand cross immediately. Timing drill — sets up powerful counters.', videoUrl: 'https://www.youtube.com/watch?v=Bd3IhD9QGpA', mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 120 },
  { name: 'Kick Check Practice',           category: 'muay_thai', equipment: 'none',  primaryMuscles: ['calves','shins','core'],      secondaryMuscles: ['quads','hips'],            instructions: 'Lift lead shin to meet incoming kick. Check with the hard part of shin. Condition shins first. Keep hands up while checking.', videoUrl: 'https://www.youtube.com/watch?v=jvqCNjCcLDk', mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 120 },
  { name: 'Combination: 1-2-Low Kick',      category: 'muay_thai', equipment: 'bag',   primaryMuscles: ['full_body'],                  secondaryMuscles: [],                          instructions: 'Jab → cross → rear roundhouse to thigh. Most fundamental Muay Thai combo. Drive hips on kick after transferring weight from cross.', videoUrl: 'https://www.youtube.com/watch?v=OG9YLNpqiRw', mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 60 },
  { name: 'Combination: Teep-Cross-Hook',   category: 'muay_thai', equipment: 'bag',   primaryMuscles: ['full_body'],                  secondaryMuscles: [],                          instructions: 'Lead teep to create distance/space, step in with cross, hook. Range management combo — keep opponent off their rhythm.', videoUrl: 'https://www.youtube.com/watch?v=OG9YLNpqiRw', mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 60 },
  { name: 'Combination: Elbow-Knee-Clinch', category: 'muay_thai', equipment: 'bag',   primaryMuscles: ['full_body'],                  secondaryMuscles: [],                          instructions: 'Enter with horizontal elbow, pull into clinch, drive diagonal knee. Transition from striking to clinch is key Muay Thai skill.', videoUrl: 'https://www.youtube.com/watch?v=OG9YLNpqiRw', mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 60 },
  { name: 'Shin Conditioning on Bag',       category: 'muay_thai', equipment: 'bag',   primaryMuscles: ['calves','shins'],             secondaryMuscles: [],                          instructions: 'Tap lead shin against bag progressively. Not full power — the goal is micro-trauma for bone density increase. 3 min rounds, gradually increase over weeks.', videoUrl: 'https://www.youtube.com/watch?v=QyMBGJP3mJQ', mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 180 },

  // ── BJJ — SUBMISSIONS ────────────────────────────────────────────────────────
  { name: 'Armbar from Guard',              category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','hip_flexors'],   secondaryMuscles: ['shoulders','legs'],        instructions: 'From closed guard, hip escape to one side, swing leg over head. Control wrist to chest, squeeze knees, bridge hips up. Control the thumb side. Patient extension.', videoUrl: 'https://www.youtube.com/watch?v=9X2T_Uo8cUQ', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Triangle Choke Setup',           category: 'bjj', equipment: 'none', primaryMuscles: ['hips','adductors','core'],     secondaryMuscles: ['legs','core'],             instructions: 'From guard, push opponent\'s arm across, throw leg over shoulder. Lock figure-4 with legs. Adjust angle 90° for finish. Pull head down.', videoUrl: 'https://www.youtube.com/watch?v=N5mGijJMjEg', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Rear Naked Choke Finish',        category: 'bjj', equipment: 'none', primaryMuscles: ['biceps','forearms','shoulders'], secondaryMuscles: ['core'],                 instructions: 'Choking arm under chin, hand behind opponent\'s head. Squeeze elbow together and flex bicep. Turn your head to finish side. Tight seatbelt with legs.', videoUrl: 'https://www.youtube.com/watch?v=VtGGDUxgoBU', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Guillotine Choke',               category: 'bjj', equipment: 'none', primaryMuscles: ['biceps','forearms','core'],    secondaryMuscles: ['shoulders','legs'],        instructions: 'Arm under chin, cup hand or Marcelo grip. Pull upward and squeeze. Guard pull finishes it. High elbow makes it tighter. Danger position: if they stack you, go arm-in.', videoUrl: 'https://www.youtube.com/watch?v=dZfZJWPj_ck', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Kimura from Half Guard',         category: 'bjj', equipment: 'none', primaryMuscles: ['core','shoulders'],           secondaryMuscles: ['hips','arms'],             instructions: 'From bottom half guard, underhook opposite arm, grab wrist with near hand, figure-4 grip. Hip escape to create space. Rotate toward the lock.', videoUrl: 'https://www.youtube.com/watch?v=EPGP0UPrJhY', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Americana from Mount',           category: 'bjj', equipment: 'none', primaryMuscles: ['core','shoulders'],           secondaryMuscles: ['chest','arms'],            instructions: 'Pin opponent\'s wrist to mat, figure-4 grip. Slide their elbow toward hip while pinning wrist. Low angle finish — shoulder lock. Keep your weight forward.', videoUrl: 'https://www.youtube.com/watch?v=Ao5X_g2bxRA', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Omoplata',                       category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core','adductors'],    secondaryMuscles: ['shoulders','legs'],        instructions: 'From guard, swing leg over opponent\'s arm, lock with hip. Sit up, base hand behind you, rotate forward to finish shoulder lock. Roll them if they try to roll out.', videoUrl: 'https://www.youtube.com/watch?v=1UO8hBH0mW4', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Bow and Arrow Choke',            category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','lats'],         secondaryMuscles: ['legs','shoulders'],        instructions: 'From back control, grip collar deep, straighten choking arm while pulling with collar hand. Foot hooks on hip and knee. Extend body backward like drawing a bow.', videoUrl: 'https://www.youtube.com/watch?v=tY79NF5xbUI', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'D\'Arce Choke',                  category: 'bjj', equipment: 'none', primaryMuscles: ['biceps','forearms','shoulders'], secondaryMuscles: ['core','chest'],         instructions: 'Arm slips under nearside armpit, lock across opponent\'s neck. Hands in guillotine position. Tripod to finish. Usually available from scrambles and takedowns.', videoUrl: 'https://www.youtube.com/watch?v=rqlVCdOOgLg', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Heel Hook (Outside)',            category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips'],                secondaryMuscles: ['legs','arms'],             instructions: 'Control opponent\'s leg between your legs (saddle/ashi). Hook heel with near elbow crook. Windshield wiper hips to finish. Extreme care — tap early.', videoUrl: 'https://www.youtube.com/watch?v=GRRbGLx08BI', mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Straight Ankle Lock',            category: 'bjj', equipment: 'none', primaryMuscles: ['core','forearms'],            secondaryMuscles: ['hips','arms'],             instructions: 'Achilles lock: arm under Achilles, grip hands, squeeze knees together, lean back and pull foot toward armpit while pushing hip. Basic submission from leg entanglement.', videoUrl: 'https://www.youtube.com/watch?v=7sLEJFE-oY4', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Cross Collar Choke from Mount',  category: 'bjj', equipment: 'none', primaryMuscles: ['forearms','biceps'],          secondaryMuscles: ['shoulders','core'],        instructions: 'From mount, thread first hand deep into collar thumb-in, second hand over-the-top. Elbows squeeze in and down. Posture up slightly to break their arms free.', videoUrl: 'https://www.youtube.com/watch?v=y7LrUJBPDaU', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Clock Choke from Turtle',        category: 'bjj', equipment: 'none', primaryMuscles: ['core','shoulders'],           secondaryMuscles: ['hips','legs'],             instructions: 'One arm deep into collar from behind turtle. Walk hips like a clock hand (hence the name) to crank the choke from a weird angle. Works when other attacks are stuffed.', videoUrl: 'https://www.youtube.com/watch?v=s-lnLaBRvJA', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },

  // ── BJJ — SWEEPS ─────────────────────────────────────────────────────────────
  { name: 'Scissor Sweep',                  category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','adductors'],    secondaryMuscles: ['legs','shoulders'],        instructions: 'From closed guard, open guard, shin across belly, other leg hooks behind knee. Scissor legs while pulling sleeve and pushing collar. Sit up into top position.', videoUrl: 'https://www.youtube.com/watch?v=T9Z83tXobhM', mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Hip Bump Sweep',                 category: 'bjj', equipment: 'none', primaryMuscles: ['hips','glutes','core'],       secondaryMuscles: ['legs','arms'],             instructions: 'From closed guard, sit up to post hand, explode hips forward into opponent as you post. Pull sleeve, use your body as a lever. Often sets up kimura or guillotine.', videoUrl: 'https://www.youtube.com/watch?v=qCXO65nJWzY', mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Hook Sweep (Butterfly)',         category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core','adductors'],    secondaryMuscles: ['legs','shoulders'],        instructions: 'From butterfly guard, underhook one arm, pull opponent off-balance over that shoulder. Elevate with butterfly hook, sweep. Keep close as you elevate.', videoUrl: 'https://www.youtube.com/watch?v=UYLwEd2lRqA', mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Tripod Sweep',                   category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core','legs'],         secondaryMuscles: ['shoulders','arms'],        instructions: 'One foot on hip, other hooks behind knee. Pull ankle with hands as you push hip with foot. Opponent tips over. Follow into standing pass position.', videoUrl: 'https://www.youtube.com/watch?v=m6Lr8vywFTk', mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'De La Riva Sweep',               category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core','adductors'],    secondaryMuscles: ['legs','shoulders'],        instructions: 'DLR hook on outside of opponent\'s lead leg. Grip sleeve and ankle. Kick and extend to off-balance. Multiple sweep options — sit-up, back take, berimbolo.', videoUrl: 'https://www.youtube.com/watch?v=4kVbKK2MCSU', mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'X-Guard Sweep',                  category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core','legs'],         secondaryMuscles: ['adductors','arms'],        instructions: 'Both hooks under opponent\'s legs in X pattern. Angle to one side, extend legs to elevate, guide them to mat. Technical position requiring good hips.', videoUrl: 'https://www.youtube.com/watch?v=a6fAA0F2oXE', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },

  // ── BJJ — PASSES ─────────────────────────────────────────────────────────────
  { name: 'Knee Slice Pass',                category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core','quads'],        secondaryMuscles: ['shoulders','legs'],        instructions: 'Grab far collar and near ankle. Slice knee across opponent\'s inner thigh pressing guard flat. Drive forward with hips while keeping pressure. Settle to side control.', videoUrl: 'https://www.youtube.com/watch?v=rHGFY2tRYS4', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Torreando Pass',                 category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core','shoulders'],    secondaryMuscles: ['legs','arms'],             instructions: 'Grab both pants at knees. Push legs to one side and jump around the other direction. Speed and commitment. Often used when opponent tries to recover guard.', videoUrl: 'https://www.youtube.com/watch?v=IFXkTjAa1Pc', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Double Under Pass',              category: 'bjj', equipment: 'none', primaryMuscles: ['lower_back','hips','core'],   secondaryMuscles: ['shoulders','legs'],        instructions: 'Stack both legs up, arms under both of opponent\'s legs, grab collar. Walk opponent up on their shoulders, drive into them. Heavy pressure — hard to recover from.', videoUrl: 'https://www.youtube.com/watch?v=EiXvVt_0dn0', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Leg Drag Pass',                  category: 'bjj', equipment: 'none', primaryMuscles: ['hips','core','shoulders'],    secondaryMuscles: ['legs','arms'],             instructions: 'Grab one leg, drag it across your body while stepping around. Pull leg to your hip, flatten their hip. Follow with side control or back take.', videoUrl: 'https://www.youtube.com/watch?v=Y4lTKGnWuH0', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },

  // ── BJJ — ESCAPES & BACK DEFENSE ─────────────────────────────────────────────
  { name: 'Mount Escape — Elbow-Knee',      category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','glutes'],       secondaryMuscles: ['legs','arms'],             instructions: 'From bottom mount: trap arm with elbow, bring knee across to make space, hip escape to guard. Bridge first to create elbow room. Most reliable mount escape.', videoUrl: 'https://www.youtube.com/watch?v=SjB3RM0hGVM', mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Side Control Escape — Knee-to-Elbow', category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips'],           secondaryMuscles: ['legs','shoulders'],        instructions: 'Frame on chin and hip. Hip escape to create knee-to-elbow space. Insert knee then build guard. Need to time movement with opponent\'s weight shift.', videoUrl: 'https://www.youtube.com/watch?v=YXimXN5h2Ro', mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Back Defense — Hand Fighting',   category: 'bjj', equipment: 'none', primaryMuscles: ['forearms','shoulders','core'], secondaryMuscles: ['hips','legs'],           instructions: 'From back control: clear choking hand by two-on-one, chin down. Turn into guard. Rotate toward seatbelt side. Most escapes fail from not protecting the neck first.', videoUrl: 'https://www.youtube.com/watch?v=iVCcgKYpvvY', mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Turtle Position Defense',        category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','shoulders'],    secondaryMuscles: ['neck','glutes'],           instructions: 'On all fours in tight ball. Elbows in, chin protected. Post and stand or single-leg to escape. Often better to go belly down than give up back directly.', videoUrl: 'https://www.youtube.com/watch?v=8k8GjLV7MmM', mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Back Take from Turtle',          category: 'bjj', equipment: 'none', primaryMuscles: ['core','hips','shoulders'],    secondaryMuscles: ['legs','arms'],             instructions: 'From opponent\'s turtle: get seatbelt grip, roll to side, insert hooks. Key: take the near side first when rolling. Follow them and stay on top of the back take.', videoUrl: 'https://www.youtube.com/watch?v=b8LnKBHEGBw', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },

  // ── MMA-SPECIFIC CONDITIONING & STRENGTH ─────────────────────────────────────
  { name: 'Turkish Get-Up',                 category: 'strength', equipment: 'kettlebell', primaryMuscles: ['full_body','core','shoulders'], secondaryMuscles: ['hips','quads','glutes'], instructions: 'From lying, extend KB overhead, stand up in stages keeping arm locked. Reverse the movement. Builds unilateral shoulder stability and body integration. Slow and controlled.', videoUrl: 'https://www.youtube.com/watch?v=jFK4iBj0k4s', mediaUrl: null, defaultSets: 3, defaultReps: 3, defaultDuration: null },
  { name: 'Kettlebell Swing',               category: 'conditioning', equipment: 'kettlebell', primaryMuscles: ['hamstrings','glutes','lower_back'], secondaryMuscles: ['core','shoulders','forearms'], instructions: 'Hip hinge, drive hips forward explosively. Bell floats to shoulder height from hip power not arms. Russian swing stops at chest. Posterior chain power for throws and takedowns.', videoUrl: 'https://www.youtube.com/watch?v=YSxHifyI6s8', mediaUrl: null, defaultSets: 4, defaultReps: 15, defaultDuration: null },
  { name: 'Medicine Ball Slam',             category: 'conditioning', equipment: 'none', primaryMuscles: ['full_body','core','lats'],     secondaryMuscles: ['shoulders','hips','quads'], instructions: 'Raise ball overhead, slam it into floor with maximum force. Absorb and pick up immediately. Builds rotational and vertical power important for striking.', videoUrl: 'https://www.youtube.com/watch?v=S5HhUoJAJ6A', mediaUrl: null, defaultSets: 4, defaultReps: 10, defaultDuration: null },
  { name: 'Rotational Medicine Ball Throw', category: 'conditioning', equipment: 'none', primaryMuscles: ['core','obliques','hips'],     secondaryMuscles: ['shoulders','chest','legs'], instructions: 'Stand sideways to wall. Load hip, rotate and throw ball against wall. Trains the same rotation pattern as hooks and roundhouse kicks. Both sides.', videoUrl: 'https://www.youtube.com/watch?v=PbXFfOQKe6g', mediaUrl: null, defaultSets: 4, defaultReps: 10, defaultDuration: null },
  { name: 'Plyometric Push-up',             category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['chest','triceps','front_delts'], secondaryMuscles: ['core'],             instructions: 'Explosive push that lifts hands off floor. Clap at top if able. Land softly, absorb immediately. Builds upper body striking power.', videoUrl: 'https://www.youtube.com/watch?v=0pkjOk0EiAk', mediaUrl: null, defaultSets: 3, defaultReps: 8, defaultDuration: null },
  { name: 'Explosive Pull-up',              category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['lats','biceps'],           secondaryMuscles: ['core','rhomboids'],        instructions: 'Pull explosively, trying to get chest or belly button to bar. Control descent. Builds pulling power for clinch work and throws.', videoUrl: 'https://www.youtube.com/watch?v=eYUJzxEpnXo', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Band Resisted Sprawl',           category: 'mma', equipment: 'none', primaryMuscles: ['hips','glutes','core','hip_flexors'], secondaryMuscles: ['lower_back','quads'], instructions: 'Band around hips attached to wall. Shoot to knees, then sprawl back hard against band resistance. Drills sprawl timing and explosiveness for takedown defense.', videoUrl: 'https://www.youtube.com/watch?v=OfD3tBuTqPE', mediaUrl: null, defaultSets: 4, defaultReps: 10, defaultDuration: null },
  { name: 'Battle Ropes',                   category: 'conditioning', equipment: 'none', primaryMuscles: ['shoulders','core','forearms'], secondaryMuscles: ['legs','back'],          instructions: '30–45s alternating waves, slams, or circles. Keep core tight, knees soft. Anaerobic conditioning similar to fight pace. Great finisher.', videoUrl: 'https://www.youtube.com/watch?v=Hg6RxNlNnN8', mediaUrl: null, defaultSets: 5, defaultReps: null, defaultDuration: 30 },
  { name: 'Jump Rope — Double Unders',      category: 'conditioning', equipment: 'none', primaryMuscles: ['calves','shoulders','core'], secondaryMuscles: ['forearms','quads'],       instructions: 'Jump higher, spin rope twice per jump. Requires timing and wrist speed. Builds explosive calf pop and timing rhythm. Progress from singles first.', videoUrl: 'https://www.youtube.com/watch?v=82ALkO4JrFg', mediaUrl: null, defaultSets: 5, defaultReps: 20, defaultDuration: null },
  { name: 'Wall Walks',                     category: 'conditioning', equipment: 'bodyweight', primaryMuscles: ['shoulders','core','upper_back'], secondaryMuscles: ['triceps','glutes'],  instructions: 'From plank, walk feet up wall while walking hands to wall. Get as vertical as possible. Walk back down. Builds shoulder stability and anti-compression strength.', videoUrl: 'https://www.youtube.com/watch?v=Hg6RxNlNnN8', mediaUrl: null, defaultSets: 3, defaultReps: 5, defaultDuration: null },
  { name: 'Sandbag Carry',                  category: 'conditioning', equipment: 'none', primaryMuscles: ['traps','core','quads'],       secondaryMuscles: ['glutes','forearms'],       instructions: 'Bear hug sandbag to chest or carry on shoulder. Walk for distance or time. Mimics clinch carrying and takedown resistance. Full-body grip strength.', videoUrl: 'https://www.youtube.com/watch?v=XVYQvTZG9OE', mediaUrl: null, defaultSets: 3, defaultReps: null, defaultDuration: 60 },

  // ── JOINT RECOVERY — WRISTS & ELBOWS ────────────────────────────────────────
  { name: 'Wrist CARS',                     category: 'recovery', equipment: 'none', primaryMuscles: ['wrists','forearms'],          secondaryMuscles: [],                          instructions: 'Controlled Articular Rotation of the wrist. Draw the biggest circle possible in each direction. Essential daily maintenance for BJJ athletes from heavy grip load.', videoUrl: 'https://www.youtube.com/watch?v=7l7vaqqTK0Y', mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Wrist Flexor Stretch',           category: 'recovery', equipment: 'none', primaryMuscles: ['forearms','wrists'],          secondaryMuscles: [],                          instructions: 'Extend arm, palm up, pull fingers back gently with other hand. Hold 30s. Repeat on palm-down side. Essential after heavy gi gripping.', videoUrl: 'https://www.youtube.com/watch?v=BniKXcMG6RY', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Pronation/Supination Circles',   category: 'recovery', equipment: 'none', primaryMuscles: ['forearms','wrists'],          secondaryMuscles: ['biceps','elbow'],          instructions: 'Elbow bent 90°. Rotate forearm fully palm up, then palm down. Control throughout. Lubricates the radioulnar joint — common injury in BJJ from guard play.', videoUrl: 'https://www.youtube.com/watch?v=7l7vaqqTK0Y', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Elbow Flexion/Extension',        category: 'recovery', equipment: 'none', primaryMuscles: ['elbow','biceps','triceps'],   secondaryMuscles: [],                          instructions: 'Slowly flex elbow to full range, then slowly extend. Do not hyperextend. Lubricates elbow joint. Important post-armbar or any session where arms were stressed.', videoUrl: 'https://www.youtube.com/watch?v=RBzNUm3jWRc', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Finger Extension Stretch',       category: 'recovery', equipment: 'none', primaryMuscles: ['forearms','fingers'],         secondaryMuscles: [],                          instructions: 'Spread fingers wide, hold 5s, make fist, hold 5s. Alternate. Finger extensors are ignored — strengthening them balances heavy BJJ grip work.', videoUrl: 'https://www.youtube.com/watch?v=RBzNUm3jWRc', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },

  // ── JOINT RECOVERY — KNEES & ANKLES ─────────────────────────────────────────
  { name: 'Knee CARS',                      category: 'recovery', equipment: 'none', primaryMuscles: ['knees','quads','hamstrings'], secondaryMuscles: ['hips'],                  instructions: 'Stand on one leg, raise opposite knee and draw controlled circles engaging knee flexion and extension. Maintain balance. Daily joint maintenance — especially important after heavy drilling.', videoUrl: 'https://www.youtube.com/watch?v=e3j0Z8hKvYc', mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Terminal Knee Extension (TKE)',   category: 'recovery', equipment: 'none', primaryMuscles: ['quads','knees'],              secondaryMuscles: ['calves'],                  instructions: 'Band behind knee, slight bend, extend fully squeezing quad. Important for VMO activation and patellar tracking — treats and prevents knee pain from squatting/kicking.', videoUrl: 'https://www.youtube.com/watch?v=PzuKJZq0bHY', mediaUrl: null, defaultSets: 3, defaultReps: 15, defaultDuration: null },
  { name: 'Ankle CARS',                     category: 'recovery', equipment: 'none', primaryMuscles: ['ankles','calves'],            secondaryMuscles: [],                          instructions: 'Seated, leg extended. Draw the biggest circle possible with your foot. Slow, deliberate. Both directions. Massive ankle mobility for kicks, pivots, and guard.', videoUrl: 'https://www.youtube.com/watch?v=zCVzVFAGOFo', mediaUrl: null, defaultSets: 2, defaultReps: 5, defaultDuration: null },
  { name: 'Banded Ankle Dorsiflexion',      category: 'recovery', equipment: 'none', primaryMuscles: ['ankles','calves','shins'],    secondaryMuscles: [],                          instructions: 'Band around ankle, drive knee forward over toes while heel stays flat. Key ankle mobility for low kicks, checking kicks, and squatting depth.', videoUrl: 'https://www.youtube.com/watch?v=zCVzVFAGOFo', mediaUrl: null, defaultSets: 2, defaultReps: 10, defaultDuration: null },
  { name: 'Calf Foam Roll',                 category: 'recovery', equipment: 'none', primaryMuscles: ['calves'],                     secondaryMuscles: ['achilles'],                instructions: 'Roll from ankle to behind knee. Cross one leg over for added pressure. Stop on tight spots for 5 breath cycles. Important after high kick volume.', videoUrl: 'https://www.youtube.com/watch?v=P1MRCJc7ofc', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },
  { name: 'ITB Foam Roll',                  category: 'recovery', equipment: 'none', primaryMuscles: ['it_band','quads'],            secondaryMuscles: ['glutes'],                  instructions: 'Side-lying on roller on outer thigh. Roll from hip to just above knee. Tight outer quad from kicking and BJJ stance. Stop on hot spots.', videoUrl: 'https://www.youtube.com/watch?v=P1MRCJc7ofc', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 60 },

  // ── NECK & SPINE RECOVERY ────────────────────────────────────────────────────
  { name: 'Cervical Spine CARS',            category: 'recovery', equipment: 'none', primaryMuscles: ['neck'],                       secondaryMuscles: ['traps','upper_back'],      instructions: 'Slow head circles maximizing range at each point: flex chin to chest, rotate to side, extend backward, other side. Never rush. Fundamental neck joint maintenance for BJJ athletes.', videoUrl: 'https://www.youtube.com/watch?v=xwWmHN1Qhqk', mediaUrl: null, defaultSets: 2, defaultReps: 3, defaultDuration: null },
  { name: 'Upper Trap Stretch',             category: 'recovery', equipment: 'none', primaryMuscles: ['traps','neck'],               secondaryMuscles: [],                          instructions: 'Pull head to side with hand, tilt ear toward shoulder. Other hand behind back or pressing down. Hold 30–45s each side. Releases common tension from BJJ clinch.', videoUrl: 'https://www.youtube.com/watch?v=Ct3U_FgxnSQ', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Levator Scapulae Stretch',       category: 'recovery', equipment: 'none', primaryMuscles: ['neck','upper_back'],          secondaryMuscles: ['traps'],                   instructions: 'Turn head 45° toward armpit, then tilt down. Hand on back of head for gentle pressure. Targets muscle connecting neck to shoulder blade — often tight in grapplers.', videoUrl: 'https://www.youtube.com/watch?v=Ct3U_FgxnSQ', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 45 },
  { name: 'Chin Tuck',                      category: 'recovery', equipment: 'none', primaryMuscles: ['neck','upper_back'],          secondaryMuscles: [],                          instructions: 'Gently pull chin straight back (not down). Hold 5s, repeat 10x. Corrects forward head posture — common from grappling and device use. Use it throughout the day.', videoUrl: 'https://www.youtube.com/watch?v=W0RGrH5Zq8A', mediaUrl: null, defaultSets: 3, defaultReps: 10, defaultDuration: null },
  { name: 'Lumbar Decompression Hang',      category: 'recovery', equipment: 'bodyweight', primaryMuscles: ['lower_back','lats'],      secondaryMuscles: ['shoulders'],              instructions: 'Dead hang from pull-up bar, feet slightly off floor. Relax everything below shoulders. Breathe slowly. Decompresses lumbar spine after heavy training. Even 30s helps.', videoUrl: 'https://www.youtube.com/watch?v=jk8WBNL1P74', mediaUrl: null, defaultSets: 2, defaultReps: null, defaultDuration: 30 },
  { name: 'Scorpion Stretch',               category: 'recovery', equipment: 'none', primaryMuscles: ['thoracic_spine','hip_flexors','chest'], secondaryMuscles: ['shoulders','hips'], instructions: 'Lie face down, swing one leg over to opposite side reaching for the ground. Arms out flat. Rotational stretch for thoracic spine and hip flexors simultaneously.', videoUrl: 'https://www.youtube.com/watch?v=Q5JBAD3Yz-k', mediaUrl: null, defaultSets: 2, defaultReps: 8, defaultDuration: null },
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

    // Saved workout template (reusable workout card)
    const WorkoutTemplate = sequelize.define('WorkoutTemplate', {
        name:        { type: DataTypes.STRING, allowNull: false },
        type:        { type: DataTypes.STRING, allowNull: false, defaultValue: 'strength' },
        description: { type: DataTypes.TEXT,   allowNull: true },
        // JSON array of { exerciseId, exerciseName, defaultSets, defaultReps, defaultDuration, notes }
        exercises:   { type: DataTypes.TEXT,   allowNull: false, defaultValue: '[]' },
        isCustom:    { type: DataTypes.BOOLEAN, defaultValue: true },
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

    // Exercise plan builder (mobility / warmup / cooldown / circuit)
    const ExercisePlan = sequelize.define('ExercisePlan', {
        name:        { type: DataTypes.STRING, allowNull: false },
        type:        { type: DataTypes.STRING, allowNull: false, defaultValue: 'mobility' },
        description: { type: DataTypes.TEXT,   allowNull: true },
        // JSON array of { exerciseId, name, sets, reps, duration, side, notes }
        items:       { type: DataTypes.TEXT,   allowNull: false, defaultValue: '[]' },
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
        WorkoutTemplate,
        ExercisePlan,
        PersonalRecord,
        seedData,
        sequelize,
    };
};

module.exports = getDatabase;
