'use strict';

/**
 * Exercises that need a band, a ball or a box must say so, or they are suggested to people who
 * do not own one. The seed's legacy `equipment` field cannot say it (there is no band/ball/box
 * token and refreshSeedContent never rewrites equipment on existing rows), so the catalogue's
 * exerciseRules are the authority: they are read at runtime for every user.
 *
 * Run: node --test test/equipment-gear.test.js
 */

require('./helpers/data-dir');
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../api/equipment');

const seed = () => {
  try { return require('../database').SEED_EXERCISES; } catch { /* sequelize not installed here */ }
  const src = fs.readFileSync(path.join(__dirname, '..', 'database.js'), 'utf8');
  return eval(src.match(/const SEED_EXERCISES = (\[[\s\S]*?\n\]);/)[1]); // eslint-disable-line no-eval
};
const EX = seed();
const GEAR_NAME = /resistance band|\bband(ed)?\b|medicine ball|stability ball|swiss ball|box jump|depth jump|step-up|\(step\)/i;
const home = () => E.CATALOGUE.gyms.find(g => g.slug === 'home').equipment.map(e => e.id);
const need = n => E.requirementsFor({ name: n }, (EX.find(e => e.name === n) || {}).equipment).requires;

test('every band, ball, box and step exercise in the library declares what it needs', () => {
  const bare = EX.filter(e => GEAR_NAME.test(e.name) && !/\bIT Band\b/i.test(e.name))
    .filter(e => { const r = E.requirementsFor({ name: e.name }, e.equipment); return !r.requires.length && !r.optional.length; })
    .map(e => e.name);
  assert.deepStrictEqual(bare, []);
});

test('each kind of gear maps to the right catalogue item', () => {
  const want = {
    'Resistance Band Push-up': 'resistance-bands', 'Resistance Band Lat Pulldown': 'resistance-bands', 'Resistance Band Crunch': 'resistance-bands',
    'Resistance Band Leg Curl': 'resistance-bands', 'Resistance Band Side-Lying Hip Abduction': 'resistance-bands', 'Resistance Band Shoulder Adduction': 'resistance-bands',
    'Band Shoulder Internal Rotation': 'resistance-bands', 'Band Resisted Sprawl': 'resistance-bands',
    'Stability Ball Push-up': 'ball', 'Medicine Ball Push-up': 'ball', 'Medicine Ball Crunch': 'ball', 'Medicine Ball Sit-up': 'ball', 'Medicine Ball Slam': 'ball', 'Rotational Medicine Ball Throw': 'ball',
    'Box Jump': 'chair|step', 'Depth Jump': 'chair|step', 'Calf Raise (Step)': 'chair|step', 'Stair Run': 'step',
  };
  for (const [n, id] of Object.entries(want)) assert.ok(need(n).includes(id), `${n} should need ${id}, needs ${JSON.stringify(need(n))}`);
  assert.deepStrictEqual(need('Dumbbell Step-Up'), ['dumbbell', 'chair|step|weight-bench']);
  assert.deepStrictEqual(need('Barbell Step-Up'), ['barbell', 'chair|step|weight-bench']);
});

test('a gym without the item loses the exercise (or swaps it); a gym with the item keeps it', () => {
  const lacks = (name, owned) => E.fitExercises([{ exerciseName: name }], owned);
  for (const n of ['Resistance Band Push-up', 'Stability Ball Push-up', 'Medicine Ball Slam', 'Box Jump', 'Step-Up']) {
    const f = lacks(n, ['mat', 'jump-rope']);
    assert.ok(!f.exercises.some(x => x.exerciseName === n), `${n} must not be offered to a gym with no gear`);
    assert.ok(f.omitted.length + f.substitutions.length === 1, n);
  }
  assert.deepStrictEqual(lacks('Medicine Ball Slam', ['mat']).omitted.map(o => o.name), ['Medicine Ball Slam']);
  assert.deepStrictEqual(lacks('Box Jump', ['mat']).substitutions, [{ from: 'Box Jump', to: 'Jump Squat' }]);
  assert.deepStrictEqual(lacks('Stability Ball Push-up', ['mat']).substitutions, [{ from: 'Stability Ball Push-up', to: 'Push-up' }]);
  assert.strictEqual(lacks('Medicine Ball Slam', ['ball']).exercises.length, 1);
  assert.strictEqual(lacks('Medicine Ball Slam', ['ball']).omitted.length, 0);
  assert.strictEqual(lacks('Box Jump', ['chair']).exercises.length, 1);
  assert.strictEqual(lacks('Box Jump', ['step']).exercises.length, 1);
  assert.strictEqual(lacks('Resistance Band Push-up', ['resistance-bands']).exercises.length, 1);
  assert.deepStrictEqual(lacks('Dumbbell Step-Up', ['dumbbell']).substitutions, [{ from: 'Dumbbell Step-Up', to: 'Reverse Lunge' }], 'a dumbbell alone is not a box');
  assert.strictEqual(lacks('Dumbbell Step-Up', ['dumbbell', 'weight-bench']).exercises[0].exerciseName, 'Dumbbell Step-Up');
});

test('the Home gym (bands, no ball or box) keeps band work and drops ball and box work', () => {
  assert.ok(home().includes('resistance-bands'));
  const names = ['Resistance Band Row', 'Resistance Band Crunch', 'Band Shoulder Internal Rotation', 'Medicine Ball Crunch', 'Stability Ball Push-up', 'Box Jump', 'Depth Jump'];
  const fit = E.fitExercises(names.map(exerciseName => ({ exerciseName })), home());
  const kept = fit.exercises.filter(x => !x.substitutedFor).map(x => x.exerciseName);
  assert.deepStrictEqual(kept, ['Resistance Band Row', 'Resistance Band Crunch', 'Band Shoulder Internal Rotation']);
  assert.deepStrictEqual(fit.substitutions.map(s => s.from), ['Medicine Ball Crunch', 'Stability Ball Push-up', 'Box Jump', 'Depth Jump'].filter(n => n !== 'Depth Jump'), 'ball and box work is swapped for a no-gear move (Depth Jump has none left once Jump Squat is taken)');
  assert.deepStrictEqual(fit.omitted.map(o => o.name), ['Depth Jump']);
});
