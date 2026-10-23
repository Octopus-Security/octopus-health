'use strict';

/**
 * muscles.js - the one vocabulary for "which muscle / joint is this".
 *
 * ExerciseDefinition.primaryMuscles / secondaryMuscles are free text stored as
 * JSON, and the free text drifted: the seed catalogue alone uses 'hips',
 * 'shoulders', 'legs', 'arms', 'core', 'knees', 'upper_chest', 'posterior_shoulder'
 * and 46 other spellings, and the library form lets a user type anything.
 * Nothing is rewritten. Stored data stays exactly as it is, and every read
 * goes through normalize(), so a muscle can be renamed or merged here without a
 * migration.
 *
 * Three ideas, kept apart on purpose:
 *   MUSCLES - the ids a person can click. Each has a display name, a region and
 *             a view. `drawn` says whether the body-map figure has a shape for it;
 *             deep muscles (rotator cuff, hip flexors, ...) have none and are
 *             offered as buttons instead of invented anatomy.
 *   JOINTS  - nine joints, each mapped to the muscles that cross it, so a joint
 *             click returns the work that moves it.
 *   ALIASES - free-text spelling -> muscle ids and/or joint ids. A word can mean
 *             both ('neck', 'achilles'), or only a joint ('knees', 'ankles').
 *
 * Merges that are decisions, not facts (the figure has no separate shape):
 *   upper_chest, lower_chest -> chest      rhomboids, upper_back, back -> traps
 *   brachialis -> biceps                   shins -> calves
 *   abductors -> glutes                    core -> abs + obliques
 */

// ── Muscles ──────────────────────────────────────────────────────────────────
// view: 'front' | 'back' | 'both' - where the shape lives. drawn:false = no shape.
const MUSCLES = {
  neck:        { name: 'Neck',                   region: 'neck',      view: 'front', drawn: true  },
  traps:       { name: 'Trapezius / mid-back',   region: 'back',      view: 'back',  drawn: true  },
  front_delts: { name: 'Front deltoid',          region: 'shoulders', view: 'front', drawn: true  },
  side_delts:  { name: 'Side deltoid',           region: 'shoulders', view: 'front', drawn: false },
  rear_delts:  { name: 'Rear deltoid',           region: 'shoulders', view: 'back',  drawn: true  },
  rotator_cuff:{ name: 'Rotator cuff',           region: 'shoulders', view: 'back',  drawn: false },
  chest:       { name: 'Chest',                  region: 'chest',     view: 'front', drawn: true  },
  serratus:    { name: 'Serratus anterior',      region: 'chest',     view: 'front', drawn: false },
  biceps:      { name: 'Biceps',                 region: 'arms',      view: 'front', drawn: true  },
  triceps:     { name: 'Triceps',                region: 'arms',      view: 'both',  drawn: true  },
  forearms:    { name: 'Forearms',               region: 'arms',      view: 'both',  drawn: true  },
  lats:        { name: 'Lats',                   region: 'back',      view: 'back',  drawn: true  },
  lower_back:  { name: 'Lower back',             region: 'back',      view: 'back',  drawn: true  },
  abs:         { name: 'Abs',                    region: 'core',      view: 'front', drawn: true  },
  obliques:    { name: 'Obliques',               region: 'core',      view: 'front', drawn: true  },
  hip_flexors: { name: 'Hip flexors',            region: 'hips',      view: 'front', drawn: false },
  glutes:      { name: 'Glutes',                 region: 'hips',      view: 'back',  drawn: true  },
  piriformis:  { name: 'Piriformis',             region: 'hips',      view: 'back',  drawn: false },
  adductors:   { name: 'Adductors (inner thigh)', region: 'legs',     view: 'both',  drawn: true  },
  quads:       { name: 'Quadriceps',             region: 'legs',      view: 'front', drawn: true  },
  it_band:     { name: 'IT band',                region: 'legs',      view: 'front', drawn: false },
  hamstrings:  { name: 'Hamstrings',             region: 'legs',      view: 'back',  drawn: true  },
  calves:      { name: 'Calves / shins',         region: 'legs',      view: 'both',  drawn: true  },
};

// ── Joints ───────────────────────────────────────────────────────────────────
// `muscles` = the muscles that cross the joint (what moves or restricts it).
const JOINTS = {
  neck:           { name: 'Neck',           muscles: ['neck', 'traps'] },
  shoulder:       { name: 'Shoulder',       muscles: ['front_delts', 'side_delts', 'rear_delts', 'rotator_cuff', 'chest', 'lats', 'traps'] },
  elbow:          { name: 'Elbow',          muscles: ['biceps', 'triceps', 'forearms'] },
  wrist:          { name: 'Wrist',          muscles: ['forearms'] },
  thoracic_spine: { name: 'Thoracic spine (upper back)', muscles: ['traps', 'lats', 'lower_back', 'serratus'] },
  lumbar_spine:   { name: 'Lumbar spine (lower back)',   muscles: ['lower_back', 'abs', 'obliques', 'hip_flexors'] },
  hip:            { name: 'Hip',            muscles: ['hip_flexors', 'glutes', 'piriformis', 'adductors', 'hamstrings', 'quads', 'it_band'] },
  knee:           { name: 'Knee',           muscles: ['quads', 'hamstrings', 'calves', 'it_band'] },
  ankle:          { name: 'Ankle',          muscles: ['calves'] },
};

// ── Aliases ──────────────────────────────────────────────────────────────────
// Keys are already in canonical-string form (see key()). Value: { m: [...muscle ids], j: [...joint ids] }.
const A = (m = [], j = []) => ({ m, j });
const ALIASES = {
  // every muscle id is its own alias (added below), then the spellings:
  quadriceps: A(['quads']), quad: A(['quads']), thighs: A(['quads', 'hamstrings']),
  hamstring: A(['hamstrings']), hams: A(['hamstrings']),
  glute: A(['glutes']), gluteal: A(['glutes']), gluteus: A(['glutes']), glutes_medius: A(['glutes']),
  abductors: A(['glutes']), abductor: A(['glutes']), hip_abductors: A(['glutes']),
  calf: A(['calves']), shins: A(['calves']), shin: A(['calves']), soleus: A(['calves']),
  gastrocnemius: A(['calves']), tibialis: A(['calves']),
  achilles: A(['calves'], ['ankle']),
  adductor: A(['adductors']), groin: A(['adductors']), inner_thigh: A(['adductors']),
  hip_flexor: A(['hip_flexors']), psoas: A(['hip_flexors']), iliopsoas: A(['hip_flexors']),
  pecs: A(['chest']), pectorals: A(['chest']), pec: A(['chest']),
  upper_chest: A(['chest']), lower_chest: A(['chest']), mid_chest: A(['chest']),
  front_delt: A(['front_delts']), anterior_deltoid: A(['front_delts']),
  side_delt: A(['side_delts']), lateral_delts: A(['side_delts']), lateral_deltoid: A(['side_delts']),
  rear_delt: A(['rear_delts']), posterior_deltoid: A(['rear_delts']), back_delts: A(['rear_delts']),
  delts: A(['front_delts', 'side_delts', 'rear_delts']), deltoids: A(['front_delts', 'side_delts', 'rear_delts']),
  shoulders: A(['front_delts', 'side_delts', 'rear_delts'], ['shoulder']),
  shoulder: A(['front_delts', 'side_delts', 'rear_delts'], ['shoulder']),
  posterior_shoulder: A(['rear_delts', 'rotator_cuff'], ['shoulder']),
  rotator_cuffs: A(['rotator_cuff']), rotators: A(['rotator_cuff']),
  trapezius: A(['traps']), trap: A(['traps']), upper_traps: A(['traps']), upper_trap: A(['traps']),
  rhomboids: A(['traps']), upper_back: A(['traps']), mid_back: A(['traps']), back: A(['traps', 'lats', 'lower_back']),
  lat: A(['lats']), latissimus: A(['lats']),
  lumbar: A(['lower_back']), erectors: A(['lower_back']), spinal_erectors: A(['lower_back']), low_back: A(['lower_back']),
  lower_back_muscles: A(['lower_back']), ql: A(['lower_back']),
  ab: A(['abs']), abdominals: A(['abs']), rectus_abdominis: A(['abs']),
  oblique: A(['obliques']),
  core: A(['abs', 'obliques']),
  bicep: A(['biceps']), brachialis: A(['biceps']),
  tricep: A(['triceps']),
  forearm: A(['forearms']), grip: A(['forearms']), fingers: A(['forearms'], ['wrist']),
  arms: A(['biceps', 'triceps', 'forearms']), arm: A(['biceps', 'triceps', 'forearms']),
  legs: A(['quads', 'hamstrings', 'calves']), leg: A(['quads', 'hamstrings', 'calves']),
  serratus_anterior: A(['serratus']),
  iliotibial_band: A(['it_band']), itb: A(['it_band']),
  piriformis_muscle: A(['piriformis']),
  neck: A(['neck'], ['neck']), cervical_spine: A([], ['neck']), cervical: A([], ['neck']),

  // joint-only spellings
  shoulder_joint: A([], ['shoulder']),
  elbow: A([], ['elbow']), elbows: A([], ['elbow']),
  wrist: A([], ['wrist']), wrists: A([], ['wrist']),
  thoracic_spine: A([], ['thoracic_spine']), thoracic: A([], ['thoracic_spine']), t_spine: A([], ['thoracic_spine']),
  lumbar_spine: A([], ['lumbar_spine']),
  hip: A([], ['hip']), hips: A([], ['hip']),
  knee: A([], ['knee']), knees: A([], ['knee']),
  ankle: A([], ['ankle']), ankles: A([], ['ankle']),

  // not a body region: nothing to click, never an error
  full_body: A(), balance: A(), cardio: A(), conditioning: A(),
};
for (const id of Object.keys(MUSCLES)) {
  const prev = ALIASES[id] || A();
  ALIASES[id] = { m: [...new Set([id, ...prev.m])], j: prev.j };
}
// a joint id as a bare word means that joint, unless a richer alias is already set
for (const id of Object.keys(JOINTS)) {
  if (!ALIASES[id]) ALIASES[id] = A([], [id]);
}

/** "Upper-Chest ", "upper chest" -> 'upper_chest'. */
function key(s) {
  return String(s == null ? '' : s).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function lookup(k) {
  if (ALIASES[k]) return ALIASES[k];
  // plurals the table does not list: 'glute' / 'glutes', 'delt' / 'delts'
  if (k.endsWith('s') && ALIASES[k.slice(0, -1)]) return ALIASES[k.slice(0, -1)];
  if (ALIASES[k + 's']) return ALIASES[k + 's'];
  return null;
}

/** One free-text name -> { muscles, joints, known }. Unknown text is reported, never guessed. */
function resolve(name) {
  const k = key(name);
  if (!k) return { muscles: [], joints: [], known: true };
  const hit = lookup(k);
  if (!hit) return { muscles: [], joints: [], known: false };
  return { muscles: [...hit.m], joints: [...hit.j], known: true };
}

function toList(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { const p = JSON.parse(v || '[]'); return Array.isArray(p) ? p : []; }
    catch { return v.split(',').map(s => s.trim()).filter(Boolean); }
  }
  return [];
}

/**
 * A stored list (array, or the JSON text from the database) -> canonical ids,
 * de-duplicated, in first-seen order. `unknown` lists the strings that matched
 * nothing, so a custom exercise typed as "wibble" is visible rather than lost.
 */
function normalize(list) {
  const muscles = [], joints = [], unknown = [];
  for (const raw of toList(list)) {
    const r = resolve(raw);
    for (const m of r.muscles) if (!muscles.includes(m)) muscles.push(m);
    for (const j of r.joints) if (!joints.includes(j)) joints.push(j);
    if (!r.known) unknown.push(raw);
  }
  return { muscles, joints, unknown };
}

const isMuscle = id => Object.prototype.hasOwnProperty.call(MUSCLES, id);
const isJoint  = id => Object.prototype.hasOwnProperty.call(JOINTS, id);

/** Muscles that cross a joint (empty for an unknown joint). */
function musclesForJoint(jointId) {
  return isJoint(jointId) ? [...JOINTS[jointId].muscles] : [];
}

/** Joints a muscle crosses. */
function jointsForMuscle(muscleId) {
  return Object.keys(JOINTS).filter(j => JOINTS[j].muscles.includes(muscleId));
}

const isStretch = e => e && e.category === 'recovery';

/** Attach canonical muscles/joints to a database row (or seed entry), without touching it. */
function annotate(e) {
  const p = normalize(e.primaryMuscles), s = normalize(e.secondaryMuscles);
  return { primary: p, secondary: s };
}

function brief(e, extra = {}) {
  return {
    id: e.id, name: e.name, category: e.category, equipment: e.equipment,
    isCustom: !!e.isCustom,
    defaultSets: e.defaultSets || null, defaultReps: e.defaultReps || null, defaultDuration: e.defaultDuration || null,
    ...extra,
  };
}

/**
 * Sort a list of exercises into what to show when a muscle or joint is clicked.
 *   stretches - recovery-category with the target as a PRIMARY
 *   primary   - everything else with the target as a primary
 *   secondary - everything else where it is only secondary
 * For a joint the target is "the joint itself, or any muscle crossing it"; joints
 * named directly on a stretch ('ankles', 'thoracic_spine') rank first.
 * `rows` are ExerciseDefinition-like: { id, name, category, equipment,
 * primaryMuscles, secondaryMuscles, isCustom, ... } with JSON-or-array lists.
 */
function exercisesFor(kind, id, rows) {
  const out = { stretches: [], primary: [], secondary: [] };
  let crossing = null;
  if (kind === 'muscle') {
    if (!isMuscle(id)) return null;
  } else if (kind === 'joint') {
    if (!isJoint(id)) return null;
    crossing = new Set(JOINTS[id].muscles);
  } else return null;

  const hits = (norm) => {
    if (kind === 'muscle') return { direct: false, n: norm.muscles.includes(id) ? 1 : 0 };
    const direct = norm.joints.includes(id);
    const n = norm.muscles.filter(m => crossing.has(m)).length;
    return { direct, n: n + (direct ? 1 : 0) };
  };

  for (const e of rows) {
    const { primary, secondary } = annotate(e);
    const hp = hits(primary), hs = hits(secondary);
    if (hp.n > 0) {
      (isStretch(e) ? out.stretches : out.primary).push({ e, rank: (hp.direct ? 1000 : 0) + hp.n });
    } else if (hs.n > 0 && !isStretch(e)) {
      out.secondary.push({ e, rank: hs.n });
    }
  }
  const byRank = (a, b) => (b.rank - a.rank) || a.e.name.localeCompare(b.e.name);
  for (const k of ['stretches', 'primary', 'secondary']) {
    out[k] = out[k].sort(byRank).map(x => brief(x.e));
  }
  return out;
}

/** What the client needs to draw the labels and chips: no exercise data. */
function publicVocabulary() {
  return {
    muscles: Object.entries(MUSCLES).map(([id, m]) => ({ id, ...m })),
    joints: Object.entries(JOINTS).map(([id, j]) => ({ id, name: j.name, muscles: [...j.muscles] })),
  };
}

module.exports = {
  MUSCLES, JOINTS, ALIASES,
  key, resolve, normalize, isMuscle, isJoint,
  musclesForJoint, jointsForMuscle, exercisesFor, publicVocabulary, isStretch,
};
