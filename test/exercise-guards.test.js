// Guards that check EVERY exercise and animation on every change (docs/EXERCISE-AUDIT.md).
// Each guard is a ratchet: known offenders are listed in test/helpers/exercise-ratchet.js with a reason
// and the audit finding, the suite passes today, and it fails on a new offender or on a listed entry that
// has been fixed but not removed. The lists only shrink.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ratchet } = require('./helpers/ratchet');
const { BANNED } = require('./helpers/banned');
const K = require('./helpers/exercise-ratchet');
const INV = require('../scripts/exercise-inventory.cjs');
const M = require('../lib/muscles.js');
const PW = require('../api/workout-parse.js');

const rows = INV.inventory();

test('the committed pose table is current (run: node scripts/pose-table.mjs)', async () => {
  const { buildTable, TABLE_PATH } = await import('../scripts/pose-table.mjs');
  assert.ok(fs.existsSync(TABLE_PATH), 'docs/exercise-pose-table.md is missing');
  assert.equal(fs.readFileSync(TABLE_PATH, 'utf8'), buildTable(), 'docs/exercise-pose-table.md is stale: run node scripts/pose-table.mjs and commit the diff');
});

test('the inventory covers the whole library and every mobility item', () => {
  assert.equal(rows.filter(r => r.source === 'library').length, INV.db.SEED_EXERCISES.length);
  assert.ok(rows.filter(r => r.source === 'mobility').length > 100);
  for (const r of rows) if (r.pose) assert.ok(fs.existsSync(path.join(INV.poseDir(), r.pose + '.json')), `${r.id}: pose ${r.pose} has no file`);
});

test('a non-martial exercise on the category fallback must be on the allowlist', () => {
  ratchet('category fallback', rows.filter(r => r.how.includes('fallback')).map(r => `${r.source}:${r.id}`), K.FALLBACK);
});

// Rules from the audit: the implement the figure carries must match the exercise's equipment.
const HOLD_EQ = { dumbbell: ['dumbbell'], dumbbellL: ['dumbbell'], barbell: ['barbell'], kettlebell: ['kettlebell'], kettlebellL: ['kettlebell'], ball: ['ball', 'sandbag'] };
test('the implement a figure holds matches the exercise equipment', () => {
  const bad = [];
  for (const r of rows.filter(x => x.source === 'library' && x.pose)) {
    const p = INV.loadPose(r.pose);
    const holds = new Set([p.hold, ...p.frames.map(f => f.hold)].filter(h => typeof h === 'string'));
    const eq = (r.equipment || '').toLowerCase();
    for (const h of holds) if (!(HOLD_EQ[h] || []).some(x => eq.includes(x))) bad.push(`mismatch:${r.name}`);
    if (!holds.size && /^(dumbbell|barbell|kettlebell)$/.test(eq)) bad.push(`missing:${r.name}`);
  }
  ratchet('implement vs equipment', bad, K.IMPLEMENT);
});

test('every quick-log alias resolves to a name in the REAL seed library', () => {
  const lib = INV.db.SEED_EXERCISES.map(e => ({ name: e.name }));
  const dead = Object.entries(PW.EXERCISE_ALIASES).filter(([, target]) => !PW.matchExercise(target, lib)).map(([k]) => k);
  ratchet('quick-log aliases', dead, K.ALIAS);
});

test('no banned claim word in any exercise name, cue, routine, template or description', () => {
  const bad = INV.copy().filter(c => BANNED.test(c.text)).map(c => `${c.source}|${c.id}`);
  ratchet('banned claims', bad, K.CLAIMS);
});

test('every muscle tag the library and mobility items use maps to something on the Body Map', () => {
  const tags = new Set();
  for (const e of INV.db.SEED_EXERCISES) for (const t of [...(e.primaryMuscles || []), ...(e.secondaryMuscles || [])]) tags.add(t);
  for (const r of INV.mob.ROUTINES) for (const it of r.items) for (const t of [...it.muscles, ...it.joints]) tags.add(t);
  const bad = [...tags].filter(t => { const r = M.resolve(t); return !r.known || (!r.muscles.length && !r.joints.length); });
  ratchet('muscle tags', bad, K.MUSCLE_TAGS);
});
