'use strict';

/**
 * exercise-aliases.js — the static "people call it this" table, shared by the
 * quick-log parser (api/workout-parse.js) and the muscle resolver
 * (lib/exercise-resolve.js). One table, so a name that logs to an exercise also
 * counts toward its muscles.
 *
 * Keys run through normKey() (lowercase, letters and digits only, one trailing
 * "s" dropped). Values are CATALOGUE names, and an alias only ever resolves when
 * the library really holds that name, so an alias can never invent a link.
 * Deliberately no substring matching ("row" must not grab "Inverted Row"), and
 * no bare "Row" alias: which row it means is the owner's answer, not ours.
 */

function normKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');
}

const RAW_ALIASES = {
  bench: 'Barbell Bench Press', flatbench: 'Barbell Bench Press', bp: 'Barbell Bench Press',
  'bench press': 'Barbell Bench Press', 'flat bench press': 'Barbell Bench Press',
  ohp: 'Barbell Overhead Press',
  dl: 'Barbell Deadlift', deads: 'Barbell Deadlift',
  rdl: 'Romanian Deadlift (RDL)',
  bss: 'Dumbbell Bulgarian Split Squat',
  bike: 'Assault Bike — Steady State', cycling: 'Assault Bike — Steady State',
  pullup: 'Pull-up', chinup: 'Chin-up',
  // renamed in the seed (database.js SEED_RENAMES): the old name still resolves
  'lumbar decompression hang': 'Relaxed Dead Hang',

  // Added 2026-11-21 from the owner's real log (Body Map "Not in your library").
  'bicep curls': 'Dumbbell Bicep Curl',
  'back extensions': 'Back Extension (Bench)',
  'cable crunches': 'Cable Crunch',
  'wide chest press machine': 'Chest Press Machine',
  'dumbbell incline chest press': 'Incline Dumbbell Press',
  'chest fly sitting forward': 'Pec Deck',
  'chest fly sitting backwards': 'Reverse Pec Deck',
  'single arm tricep extensions': 'Single-Arm Cable Tricep Extension',
  'barbell clean': 'Barbell Clean',
  'hack squat': 'Hack Squat (Machine)',
  'single leg curl': 'Single-Leg Curl (Machine)',
  'iso leg press': 'Iso Leg Press',
  'iso shoulder press': 'Iso Shoulder Press',
  'iso chest press': 'Iso Chest Press',
  'iso row': 'Iso Row',
};

const EXERCISE_ALIASES = {};
for (const k of Object.keys(RAW_ALIASES)) EXERCISE_ALIASES[normKey(k)] = RAW_ALIASES[k];

module.exports = { normKey, RAW_ALIASES, EXERCISE_ALIASES };
