'use strict';

/**
 * sessions-library.js - what the owner can pick from when building a session, and the
 * ASSIST that narrows it for one person. No LLM and no learned anything: it is the catalogue
 * the app already has (exercise library, mobility routines, mma snapshot), health's own equipment
 * catalogue (api/equipment.js) and the joint/muscle mappings of the Body Map (lib/muscles.js).
 *
 * The assist only SUGGESTS. It returns lists; nothing is ever added to a session by it.
 */

const M = require('../lib/muscles');
const E = require('./equipment');
const PM = require('../public/pose-map');
const { poseKeyOrNull } = require('./sessions-store');

let MMA = { moves: [] };
try { MMA = require('../lib/mma-moves.json'); } catch { /* snapshot not generated: no mma moves, nothing else breaks */ }

const csv = (v) => (Array.isArray(v) ? v : []);

/** Exercise rows (ExerciseDefinition-like, from the owner's own library) -> library entries. */
function fromExercises(rows) {
  return csv(rows).map(e => {
    const n = M.normalize(e.primaryMuscles), s = M.normalize(e.secondaryMuscles);
    return {
      type: 'exercise', ref: 'exercise:' + (e.id != null ? e.id : e.name), name: e.name, category: e.category,
      poseKey: poseKeyOrNull(PM.keyFor(e.name, e.category)),
      cues: [], instructions: e.instructions || '',
      dose: e.defaultSets && e.defaultReps ? `${e.defaultSets} x ${e.defaultReps}` : (e.defaultSets && e.defaultDuration ? `${e.defaultSets} x ${e.defaultDuration} s` : ''),
      primary: n.muscles, secondary: s.muscles, joints: [...new Set([...n.joints, ...s.joints])],
      requires: E.requirementsFor({ name: e.name }, e.equipment).requires,
      stretch: M.isStretch(e),
    };
  });
}

/** Mobility routine items (api/mobility.js) -> library entries. */
function fromRoutines(routines) {
  const out = [], seen = new Set();
  for (const r of csv(routines)) for (const it of r.items) {
    if (seen.has(it.name)) continue; // the same drill appears in several routines; offer it once
    seen.add(it.name);
    out.push({
      type: 'routine', ref: `routine:${r.id}/${it.id}`, name: it.name, category: 'recovery',
      poseKey: poseKeyOrNull(PM.keyFor(it.demo || it.name, 'recovery')),
      cues: it.cue ? [it.cue] : [], instructions: '', dose: it.rx || '',
      primary: M.normalize(it.muscles).muscles, secondary: [], joints: csv(it.joints),
      requires: csv(it.requires), stretch: true, group: r.name,
    });
  }
  return out;
}

/** mma snapshot (scripts/snapshot-mma.mjs) -> library entries. They carry no muscle data. */
function fromMma(catalogue) {
  return csv((catalogue || MMA).moves).map(m => ({
    type: 'mma', ref: 'mma:' + m.id, name: m.title, category: m.discipline,
    poseKey: poseKeyOrNull(m.poseKey),
    cues: csv(m.keyPoints).slice(0, 5), instructions: csv(m.steps).map((s, i) => `${i + 1}. ${s}`).join('\n'),
    dose: '', primary: [], secondary: [], joints: [], requires: [], stretch: false, group: `${m.discipline} (${m.level})`,
  }));
}

/**
 * Narrow the library for one person from the private tailoring block.
 *   focus     muscle/joint ids the owner wants worked   -> ranked "suggested" with the reason
 *   limits    joint ids (injuries)                      -> items loading them go to "check"
 *   equipment catalogue ids the person has              -> items needing missing gear go to "unavailable"
 * Empty equipment means "not stated", so nothing is filtered by gear.
 */
function suggest(library, tailoring) {
  const t = tailoring || {};
  const focus = csv(t.focus), limits = csv(t.limits).filter(M.isJoint);
  const have = E.expand(csv(t.equipment));
  const gearKnown = csv(t.equipment).length > 0;
  const focusMuscles = new Set(), focusJoints = new Set();
  for (const f of focus) {
    if (M.isMuscle(f)) focusMuscles.add(f);
    if (M.isJoint(f)) { focusJoints.add(f); for (const m of M.musclesForJoint(f)) focusMuscles.add(m); }
  }
  const label = id => (M.isJoint(id) ? M.JOINTS[id].name : M.isMuscle(id) ? M.MUSCLES[id].name : id).toLowerCase();

  const suggested = [], check = [], unavailable = [];
  for (const it of csv(library)) {
    const miss = gearKnown ? E.unmet(it.requires, have) : [];
    if (miss.length) { unavailable.push({ ref: it.ref, name: it.name, why: 'needs ' + miss.join(', ') }); continue; }

    // joints this item loads: named joints, plus every joint its PRIMARY muscles cross
    const loaded = new Set(it.joints);
    for (const m of it.primary) for (const j of M.jointsForMuscle(m)) loaded.add(j);
    const hurt = limits.filter(j => loaded.has(j));

    let score = 0;
    const why = [];
    for (const m of it.primary) if (focusMuscles.has(m)) { score += 2; why.push(label(m)); }
    for (const m of it.secondary) if (focusMuscles.has(m)) { score += 1; why.push(label(m) + ' (secondary)'); }
    for (const j of it.joints) if (focusJoints.has(j)) { score += 2; why.push(label(j)); }

    if (hurt.length) {
      if (score > 0 || !focus.length) check.push({ ref: it.ref, name: it.name, why: 'loads the ' + hurt.map(label).join(', ') + (it.stretch ? ' (mobility work: check it suits the limit)' : '') });
      continue;
    }
    if (!focus.length || score > 0) {
      suggested.push({ ref: it.ref, name: it.name, score, why: [...new Set(why)].join(', ') });
    }
  }
  suggested.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return { suggested: suggested.slice(0, 60), check: check.slice(0, 60), unavailable: unavailable.length, unavailableSample: unavailable.slice(0, 20),
    note: 'Suggestions only: nothing is added for you. This is not medical advice.' };
}

module.exports = { fromExercises, fromRoutines, fromMma, suggest };
