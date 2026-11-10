'use strict';
/*
 * One place that walks every exercise-like item the app shows and resolves the
 * figure each one gets. Used by scripts/pose-table.mjs (the committed table) and
 * by test/exercise-guards.test.js, so the table and the guards cannot disagree.
 *
 * Pure reads: it requires the seed data and the pose map and writes nothing.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const db = require(path.join(ROOT, 'database'));
const PM = require(path.join(ROOT, 'public', 'pose-map.js'));
const mob = require(path.join(ROOT, 'api', 'mobility.js'));
const tree = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/calisthenics/skill-tree.json'), 'utf8'));

// Same split views/library.ejs poseForExercise() makes: a martial technique with no pose of its own
// shows "No diagram yet" instead of the category fallback.
const MARTIAL = ['mma', 'bjj', 'muay_thai'];

function poseDir() { return path.join(ROOT, 'public', 'poses'); }
function loadPose(key) { return JSON.parse(fs.readFileSync(path.join(poseDir(), key + '.json'), 'utf8')); }

function resolve(name, category) {
  const martial = MARTIAL.indexOf(category) >= 0;
  const matched = PM.match(name);
  if (matched) return { pose: matched, how: 'rule' };
  const nullRule = PM.RULES.some(r => r[1] === null && r[0].test(name));
  if (martial) return { pose: '', how: 'none (martial: no figure)' };
  return { pose: PM.keyFor(name, category), how: nullRule ? 'null rule -> category fallback' : 'category fallback' };
}

/** Library exercises, mobility items (and their alternates). Sorted for a stable table. */
function inventory() {
  const rows = [];
  for (const e of db.SEED_EXERCISES) {
    rows.push(Object.assign({ source: 'library', id: e.name, name: e.name, category: e.category, equipment: e.equipment || '' }, resolve(e.name, e.category)));
  }
  for (const r of mob.ROUTINES) {
    for (const it of r.items) {
      rows.push(Object.assign({ source: 'mobility', id: it.id, name: it.name, category: 'recovery', equipment: '', routine: r.id, demo: it.demo }, resolve(it.demo, 'recovery')));
      if (it.alt) rows.push(Object.assign({ source: 'mobility', id: it.id + '/alt', name: it.alt.name, category: 'recovery', equipment: '', routine: r.id, demo: it.alt.demo }, resolve(it.alt.demo, 'recovery')));
    }
  }
  return rows;
}

/** Every piece of user-visible copy, tagged with where it lives. */
function copy() {
  const out = [];
  const add = (source, id, text) => { if (text) out.push({ source, id, text: String(text) }); };
  for (const e of db.SEED_EXERCISES) { add('library:name', e.name, e.name); add('library:cue', e.name, e.instructions); }
  for (const r of mob.ROUTINES) {
    add('routine:name', r.id, r.name); add('routine:blurb', r.id, r.blurb);
    for (const it of r.items) {
      add('mobility:name', it.id, it.name); add('mobility:cue', it.id, it.cue); add('mobility:rx', it.id, it.rx); add('mobility:tool', it.id, it.tool);
      if (it.alt) { add('mobility:alt-name', it.id, it.alt.name); add('mobility:alt-cue', it.id, it.alt.cue); }
    }
  }
  for (const t of db.SEED_WORKOUT_TEMPLATES) {
    add('template:name', t.slug, t.name); add('template:desc', t.slug, t.description); add('template:warmup', t.slug, t.warmup); add('template:cooldown', t.slug, t.cooldown);
    for (const x of t.exercises) add('template:note', t.slug + ':' + x.exerciseName, x.notes);
  }
  for (const p of db.SEED_EXERCISE_PLANS) {
    add('plan:name', p.name, p.name); add('plan:desc', p.name, p.description);
    for (const x of p.items) add('plan:note', p.name + ':' + x.name, x.notes);
  }
  for (const s of tree.skills) { add('skill:name', s.id, s.name); add('skill:how', s.id, s.how); }
  return out;
}

module.exports = { inventory, copy, resolve, loadPose, poseDir, MARTIAL, db, PM, mob, tree };
