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
const GEAR_NAME = /sandbag|bench|\bdip\b|decline sit|resistance band|\bband(ed)?\b|medicine ball|stability ball|swiss ball|box jump|depth jump|step-up|\(step\)/i;
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
    'Box Jump': 'plyo-box', 'Depth Jump': 'plyo-box', 'Calf Raise (Step)': 'chair|step', 'Stair Run': 'step',
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
  assert.strictEqual(lacks('Box Jump', ['plyo-box']).exercises[0].exerciseName, 'Box Jump');
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
  assert.deepStrictEqual(fit.substitutions.map(s => s.from), ['Medicine Ball Crunch', 'Stability Ball Push-up', 'Box Jump', 'Depth Jump'], 'ball and box work is swapped for a no-gear move');
  assert.deepStrictEqual(fit.omitted, []);
});

test('a chair, a step or a bench never satisfies a jump or landing exercise; only a plyo box does', () => {
  const JUMPS = ['Box Jump', 'Depth Jump', 'Lateral Box Jump', 'Box Shuffle', 'Lateral Box Hop'];
  for (const n of JUMPS) {
    assert.deepStrictEqual(need(n), ['plyo-box'], n);
    for (const owned of [['chair'], ['step'], ['weight-bench'], ['chair', 'step', 'weight-bench', 'power-tower']]) {
      const f = E.fitExercises([{ exerciseName: n }], owned);
      assert.ok(!f.exercises.some(x => x.exerciseName === n), `${n} offered to ${owned}`);
    }
    assert.strictEqual(E.fitExercises([{ exerciseName: n }], ['plyo-box']).exercises[0].exerciseName, n);
  }
  assert.deepStrictEqual(E.fitExercises([{ exerciseName: 'Box Jump' }], ['chair']).substitutions, [{ from: 'Box Jump', to: 'Jump Squat' }]);
  // step-ups and step calf raises may still use a chair
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Step-Up' }], ['chair']).exercises[0].exerciseName, 'Step-Up');
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Calf Raise (Step)' }], ['chair']).exercises[0].exerciseName, 'Calf Raise (Step)');
});

test('nothing provides the plyo box, the old chair id still works, and no gym is granted a box', () => {
  assert.ok(E.IDS.includes('plyo-box') && E.IDS.includes('chair'));
  for (const it of E.ITEMS) assert.ok(!(it.provides || []).includes('plyo-box'), `${it.id} must not provide plyo-box`);
  for (const id of E.IDS) assert.ok(!E.expand([id]).has('plyo-box') || id === 'plyo-box', `${id} implies a plyo box`);
  assert.strictEqual(E.toId('plyo box'), 'plyo-box');
  assert.strictEqual(E.toId('jump box'), 'plyo-box');
  assert.strictEqual(E.toId('chair'), 'chair');
  assert.notStrictEqual(E.toId('box'), 'plyo-box', 'a bare "box" is ambiguous and must not grant a jump box');
  for (const g of E.CATALOGUE.gyms) assert.ok(!E.expand(g.equipment.map(e => e.id)).has('plyo-box'), `${g.slug} seeded with a plyo box`);
});

test('bench and sandbag exercises need their item', () => {
  for (const n of ['Bench Dip (Feet Elevated)', 'Decline Sit-up', 'Back Extension (Bench)', 'Decline Dumbbell Press', 'Barbell Hip Thrust', 'Preacher Curl', 'EZ-Bar Skull Crusher', 'Incline Dumbbell Curl', 'Dumbbell Pullovers']) {
    assert.ok(need(n).some(r => /weight-bench/.test(r)), `${n} needs a bench: ${JSON.stringify(need(n))}`);
  }
  assert.deepStrictEqual(need('Sandbag Carry'), ['sandbag']);
  assert.deepStrictEqual(E.fitExercises([{ exerciseName: 'Sandbag Carry' }], home()).omitted.map(o => o.name), ['Sandbag Carry']);
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Sandbag Carry' }], ['sandbag']).exercises.length, 1);
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Decline Sit-up' }], ['mat']).substitutions[0].to, 'Sit-up');
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Decline Sit-up' }], ['weight-bench']).exercises[0].exerciseName, 'Decline Sit-up');
});

test('the elevated Jefferson curl needs a box, step or bench, never a chair alone, and falls back to the floor version', () => {
  const n = 'Jefferson Curl (Elevated)';
  assert.deepStrictEqual(need(n), ['plyo-box|step|weight-bench']);
  for (const owned of [['chair'], ['mat'], ['dumbbell'], ['chair', 'dumbbell']]) {
    const f = E.fitExercises([{ exerciseName: n }], owned);
    assert.deepStrictEqual(f.substitutions, [{ from: n, to: 'Jefferson Curl' }], JSON.stringify(owned));
    assert.ok(!f.exercises.some(x => x.exerciseName === n));
  }
  for (const owned of [['plyo-box'], ['step'], ['weight-bench']]) {
    assert.strictEqual(E.fitExercises([{ exerciseName: n }], owned).exercises[0].exerciseName, n, JSON.stringify(owned));
  }
  // the floor version stays available to everyone
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Jefferson Curl' }], ['chair']).exercises[0].exerciseName, 'Jefferson Curl');
});
