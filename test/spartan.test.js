'use strict';

/**
 * Spartan Dumbbell 300 (kit:spartan-dumbbell-300): every station resolves to a seeded exercise with
 * muscles (so it counts toward volume and the body map), needs only dumbbells, and the plan can
 * never become a weekday's plan. Source: Onnit "Dumbbell 300 Workout" (nine stations, for time).
 *
 * Run: node --test test/spartan.test.js
 */
require('./helpers/data-dir');
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../api/equipment');
const { BANNED } = require('./helpers/banned');

let db = null;
try { require('sequelize'); require('sqlite3'); db = require('../database'); } catch { /* read the source */ }
const src = fs.readFileSync(path.join(__dirname, '..', 'database.js'), 'utf8');
const grab = n => eval(src.match(new RegExp('const ' + n + ' = (\\[[\\s\\S]*?\\n\\]);'))[1]); // eslint-disable-line no-eval
const EX = db ? db.SEED_EXERCISES : grab('SEED_EXERCISES');
const TPL = db ? db.SEED_WORKOUT_TEMPLATES : grab('SEED_WORKOUT_TEMPLATES');
const t = TPL.find(x => x.slug === 'kit:spartan-dumbbell-300');
const byName = new Map(EX.map(e => [e.name, e]));
const NEW = ['Dumbbell Front Squat (Racked)', 'Alternating Dumbbell Floor Press', 'Dumbbell Renegade Row', 'Dumbbell Jumping Lunge',
  'Dumbbell Staggered Row', 'Dumbbell Goblet Jump Squat', 'Dumbbell Swing'];

test('the plan exists, is a non-weekday kit plan, and lists the nine stations in order', () => {
  assert.ok(t);
  assert.match(t.slug, /^kit:/);
  assert.strictEqual(t.exercises.length, 9);
  assert.deepStrictEqual(t.exercises.map(e => e.reps), [40, 50, 30, 40, 25, 25, 30, 40, 50]);
  assert.ok(t.exercises.every(e => e.sets === 1 && e.repMode === 'fixed'));
  assert.strictEqual(E.kitItemForSlug ? E.kitItemForSlug(t.slug) : null, null, 'no buy link invented');
});

test('every station is a seeded exercise with muscles and dumbbell gear', () => {
  for (const s of t.exercises) {
    const e = byName.get(s.exerciseName);
    assert.ok(e, `${s.exerciseName} is seeded`);
    assert.ok(e.primaryMuscles.length > 0, s.exerciseName);
    assert.strictEqual(e.equipment, 'dumbbell', s.exerciseName);
    assert.deepStrictEqual(E.requirementsFor({ name: e.name }, e.equipment).requires, ['dumbbell'], s.exerciseName);
  }
});

test('new exercises are unique, carry a starting point, and have no invented media', () => {
  for (const n of NEW) {
    assert.strictEqual(EX.filter(e => e.name === n).length, 1, n);
    const e = byName.get(n);
    assert.strictEqual(e.videoUrl, null, n);
    assert.match(e.instructions, /starting point/i, n);
  }
});

test('copy has no banned claim, URL or invented statistic', () => {
  const text = [t.name, t.description, t.warmup, t.cooldown, ...t.exercises.map(e => e.notes), ...NEW.map(n => byName.get(n).instructions)].join(' ');
  assert.doesNotMatch(text, BANNED);
  assert.doesNotMatch(text, /https?:\/\//i);
});
