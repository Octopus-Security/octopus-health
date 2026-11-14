'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const tempo = require('../api/tempo');

function memDb() {
  const rows = new Map();
  return {
    rows,
    UserSetting: {
      async findByPk(k) { return rows.has(k) ? { key: k, value: rows.get(k) } : null; },
      async upsert({ key, value }) { rows.set(key, value); },
    },
  };
}

test('strict pull-up is 5-5-5-5, and one rep is four phases', () => {
  const steps = tempo.steps(tempo.BUILTIN);
  assert.equal(steps.length, 20);
  assert.deepEqual(steps.slice(0, 4).map(s => [s.label, s.seconds, s.speak, s.repStart]), [
    ['Up', 5, 'up', true],
    ['Top', 5, 'hold', false],
    ['Down', 5, 'down', false],
    ['Dead hang', 5, 'hang', false],
  ]);
  assert.equal(steps[4].rep, 2);
  assert.equal(steps[4].repStart, true);
  assert.equal(tempo.cycleSeconds(tempo.BUILTIN), 20);
  assert.equal(tempo.cue(steps[0]), 'rep 1. up');
  assert.equal(tempo.cue(steps[1]), 'hold');
});

test('times, reps and phase count are clamped, and a zero-second phase is skipped', () => {
  const n = tempo.normalize({
    name: '  slow   negative ',
    reps: 500,
    phases: [
      { label: 'Up', speak: 'up', seconds: 0 },
      { label: 'Down', speak: 'down', seconds: 8 },
      { label: 'x'.repeat(80), seconds: 999 },
    ],
  });
  assert.equal(n.name, 'slow negative');
  assert.equal(n.reps, 100);
  assert.equal(n.phases.length, 2);
  assert.equal(n.phases[0].seconds, 8);
  assert.equal(n.phases[1].seconds, 180);
  assert.equal(n.phases[1].label.length, 40);
  assert.equal(tempo.steps(n).length, 200);
});

test('an empty phase list falls back to the pull-up', () => {
  const n = tempo.normalize({ name: 'nope', phases: [{ seconds: 0 }] });
  assert.equal(n.phases.length, 4);
  assert.equal(n.phases[3].label, 'Dead hang');
});

test('save replaces by name, refuses the builtin, and reads back from the user db', async () => {
  const db = memDb();
  assert.deepEqual(await tempo.list(db), []);
  const saved = await tempo.save(db, [
    { name: 'Slow pull-up', reps: 3, phases: [{ label: 'Up', speak: 'up', seconds: 8 }, { label: 'Down', speak: 'down', seconds: 8 }] },
  ]);
  assert.equal(saved.length, 1);
  assert.match(saved[0].id, /^c[0-9a-f]+$/);
  const again = await tempo.save(db, [
    { id: saved[0].id, name: 'Slow pull-up', reps: 4, phases: saved[0].phases },
    { name: 'slow pull-up', reps: 2, phases: [{ label: 'Hang', speak: 'hang', seconds: 10 }] },
  ]);
  assert.equal(again.length, 1);
  assert.equal(again[0].reps, 2);
  assert.equal(again[0].id, saved[0].id);
  assert.deepEqual(await tempo.list(db), again);
  await assert.rejects(() => tempo.save(db, [{ id: 'strict-pull-up', name: 'Strict pull-up', phases: tempo.PULLUP_PHASES }]), /built-in/);
  await assert.rejects(() => tempo.save(db, { name: 'nope' }), /list/);
});
