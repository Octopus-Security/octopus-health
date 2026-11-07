'use strict';

/**
 * The hip and full-body mobility additions: real exercises behind every routine item,
 * a deliberate pose for every new name, and a named swap when the gear is missing.
 *
 * Run: node --test test/more-mobility.test.js
 */

require('./helpers/data-dir');
const { test } = require('node:test');
const assert = require('node:assert');

const { SEED_EXERCISES } = require('../database');
const { ROUTINES, fitRoutines } = require('../api/mobility');
const E = require('../api/equipment');
const PM = require('../public/pose-map.js');

const NEW_ROUTINES = ['hips-20', 'kick-range', 'guard-hips'];
const lib = new Set(SEED_EXERCISES.map(e => e.name));
const routine = id => ROUTINES.find(r => r.id === id);

test('the three new routines use real library exercises, by name and by demo', () => {
  for (const id of NEW_ROUTINES) {
    const r = routine(id);
    assert.ok(r, id);
    assert.ok(r.items.length >= 12, id);
    for (const i of r.items) {
      assert.ok(lib.has(i.name), `${id}: "${i.name}" is not in the library`);
      assert.ok(lib.has(i.demo), `${id}: demo "${i.demo}" is not in the library`);
    }
  }
});

test('kicking and leg-raise drills do not fall through to a strike pose', () => {
  const want = {
    'Kick Chamber Hold': 'kick-check', 'Walking Knee Hug': 'hip-circle', 'Fire Hydrant': 'quadruped-hip-cars',
    'Front-to-Back Leg Swing': 'hip-circle', 'Lateral Leg Swing': 'hip-circle', 'Reverse Tabletop': 'crab-walk',
    'Banded Hip Mobilization': 'kneeling-hip-flexor', 'Prone Y-T-W Raise': 'cobra',
  };
  for (const [n, k] of Object.entries(want)) assert.strictEqual(PM.keyFor(n), k, n);
});

test('gear-dependent drills swap to a bodyweight option, and stay when the gear is there', () => {
  const fit = (name, owned) => E.fitExercises([{ exerciseName: name }], owned);
  const kept = r => r.exercises.map(x => x.exerciseName || x.name);
  assert.deepStrictEqual(kept(fit('Banded Hip Mobilization', [])), ['Half-Kneeling Hip Flexor Stretch']);
  assert.deepStrictEqual(kept(fit('Band Shoulder External Rotation', [])), ['Side-Lying Shoulder External Rotation']);
  assert.deepStrictEqual(kept(fit('Elbows-on-Bench Thoracic Extension', [])), ['Thoracic Open Book']);
  assert.deepStrictEqual(kept(fit('Banded Hip Mobilization', ['resistance-bands'])), ['Banded Hip Mobilization']);
  assert.deepStrictEqual(kept(fit('Elbows-on-Bench Thoracic Extension', ['chair'])), ['Elbows-on-Bench Thoracic Extension']);
});

test('the hip routine replaces the band drill, labelled, for someone with no band', () => {
  const [r] = fitRoutines([routine('hips-20')], new Set());
  const names = r.items.map(i => i.name);
  assert.ok(!names.includes('Banded Hip Mobilization'));
  assert.ok(names.includes('Half-Kneeling Hip Flexor Stretch'));
  assert.strictEqual(r.items.length, routine('hips-20').items.length, 'nothing dropped');
});
