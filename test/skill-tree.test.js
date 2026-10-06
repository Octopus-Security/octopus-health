'use strict';

/**
 * The skill tree is data, and its failure modes are quiet: a typo in a
 * prerequisite id makes a skill permanently locked, a stale ladder reference
 * links to a rung that no longer exists, a cycle makes two skills unlock each
 * other never. None of those throw at runtime, so they are asserted here.
 *
 * Pure: reads content/ and calls api/skill-tree.js. No database.
 * Run: node --test test/skill-tree.test.js
 */

const { test } = require('node:test');
const assert   = require('node:assert');
const T = require('../api/skill-tree');

const tree = T.loadTree();
const have = (...e) => new Set(['none', ...e]);
const attempt = (skillId, result = 'succeeded', date = '2026-10-01') => ({ skillId, date, result });
const stFor = ids => T.statusMap(tree, ids.map(id => attempt(id)));
// A deterministic rng: cycles through the given values.
const rngOf = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('the tree is sound: unique ids, known prerequisites, real ladder rungs, no cycles', () => {
  assert.deepStrictEqual(tree.validate(), []);
  assert.ok(tree.skills.length >= 60);
});

test('validation catches the quiet failures it exists for', () => {
  const mk = skills => ({ skills });
  const base = { name: 'x', line: 'push', how: 'h', equipment: [], criterion: { sets: 3, reps: 5 }, ref: null };
  assert.match(T.validate(mk([{ ...base, id: 'a', requires: ['nope'] }])).join(), /unknown prerequisite nope/);
  assert.match(T.validate(mk([{ ...base, id: 'a', requires: ['b'] }, { ...base, id: 'b', requires: ['a'] }])).join(), /cycle/);
  assert.match(T.validate(mk([{ ...base, id: 'a', requires: [], ref: { file: 'pull-ups.md', rung: 99 } }])).join(), /no rung 99/);
  assert.match(T.validate(mk([{ ...base, id: 'a', requires: [], equipment: ['jetpack'] }])).join(), /unknown equipment/);
});

test('the owner\'s chain: wall plank -> wall handstand hold -> pike -> elevated pike -> negative -> full', () => {
  const need = id => tree.byId.get(id).requires;
  assert.ok(need('wall-handstand-hold').includes('wall-plank'));
  assert.ok(need('hspu-negative').includes('wall-handstand-hold'));
  assert.ok(need('hspu-negative').includes('elevated-pike-pushup'));
  assert.deepStrictEqual(need('elevated-pike-pushup'), ['pike-pushup']);
  assert.deepStrictEqual(need('hspu-partial'), ['hspu-negative']);
  assert.ok(need('hspu').includes('hspu-partial'));
  assert.ok(need('freestanding-handstand').includes('handstand-heel-pulls'));
  const route = T.ancestorsInOrder(tree, 'hspu');
  assert.ok(route.indexOf('wall-plank') < route.indexOf('wall-handstand-hold'));
  assert.strictEqual(route[route.length - 1], 'hspu');
});

test('the handles line exists and says so: deficit, pseudo-planche, L-sit, tuck planche, handle dip, deficit HSPU', () => {
  const eq = id => tree.byId.get(id).equipment.join();
  assert.match(eq('deficit-pushup'), /handles/);
  assert.match(eq('pseudo-planche-pushup'), /handles/);
  assert.match(eq('tuck-lsit'), /handles/);
  assert.match(eq('lsit'), /handles/);
  assert.match(eq('planche-lean'), /handles/);
  assert.match(eq('tuck-planche'), /handles/);
  assert.match(eq('handle-dip'), /handles/);
  assert.match(eq('deficit-hspu-handles'), /handles/);
  assert.match(tree.byId.get('handle-dip').caveat, /tall enough/i);
});

test('every skill with a ladder rung links to it instead of copying it', () => {
  for (const s of tree.skills.filter(x => x.ref)) {
    const rungs = T.ladderRungs(s.ref.file);
    assert.ok(rungs.has(s.ref.rung), `${s.id} -> ${s.ref.file} #${s.ref.rung}`);
    assert.ok(s.how.length < 300, `${s.id}: how-to should be short; the ladder holds the full text`);
  }
});

test('roots are unlocked; achieving a prerequisite unlocks the next; deleting the attempt re-locks it', () => {
  let st = stFor([]);
  assert.strictEqual(st.get('wrist-prep').status, 'unlocked');
  assert.strictEqual(st.get('wall-plank').status, 'locked');
  st = stFor(['plank']);
  assert.strictEqual(st.get('wall-plank').status, 'locked', 'plank alone does not unlock wall-plank (wrist prep does)');
  st = stFor(['wrist-prep']);
  assert.strictEqual(st.get('wall-plank').status, 'unlocked');
  // "not yet" never achieves anything
  st = T.statusMap(tree, [attempt('wrist-prep', 'not_yet')]);
  assert.strictEqual(st.get('wrist-prep').status, 'unlocked');
  assert.strictEqual(st.get('wall-plank').status, 'locked');
});

test('a skill with several prerequisites needs all of them', () => {
  assert.strictEqual(stFor(['wall-plank', 'wrist-prep']).get('wall-handstand-hold').status, 'locked');
  const st = stFor(['wrist-prep', 'wall-plank', 'handstand-bail', 'shoulder-overhead-reach']);
  assert.strictEqual(st.get('wall-handstand-hold').status, 'unlocked');
});

test('equipment: handles+dip bars alternatives, and the unset default', () => {
  const s = tree.byId.get('support-hold');
  assert.deepStrictEqual(T.missingEquipment(s, have()), ['handles or dip-bars']);
  assert.deepStrictEqual(T.missingEquipment(s, have('handles')), []);
  assert.deepStrictEqual(T.missingEquipment(s, have('dip-bars')), []);
  assert.deepStrictEqual([...T.effectiveEquipment(null)].sort(), ['chair', 'none', 'wall']);
  assert.deepStrictEqual([...T.effectiveEquipment(['bar'])].sort(), ['bar', 'none']);
});

test('equipment words are normalised, unknown ones refused by name', () => {
  assert.deepStrictEqual(T.normalizeEquipment('push-up handles, a pull-up bar and parallettes').sort(), ['bar', 'handles']);
  assert.deepStrictEqual(T.normalizeEquipment(['Dip Station']), ['dip-bars']);
  assert.throws(() => T.normalizeEquipment(['trampoline']), /Unknown equipment: trampoline/);
});

test('finding a skill by words: aliases, lines, ambiguity', () => {
  assert.strictEqual(T.findSkill(tree, 'handstand push-up').skill.id, 'hspu');
  assert.strictEqual(T.findSkill(tree, 'HSPU').skill.id, 'hspu');
  assert.strictEqual(T.findSkill(tree, 'tuck l-sit on handles').skill.id, 'tuck-lsit');
  assert.strictEqual(T.findSkill(tree, 'pistol').skill.id, 'pistol-squat');
  assert.strictEqual(T.findSkill(tree, 'planche').line, 'planche');
  assert.strictEqual(T.findSkill(tree, 'zzzz nothing'), null);
});

test('progression shows the route and the user\'s position on it', () => {
  const st = stFor(['wrist-prep', 'wall-plank', 'handstand-bail', 'shoulder-overhead-reach', 'wall-handstand-hold', 'incline-pushup', 'pushup', 'pike-pushup']);
  const p = T.progressionTo(tree, st, have('wall', 'chair'), 'hspu');
  assert.strictEqual(p.target.id, 'hspu');
  assert.strictEqual(p.position.id, 'elevated-pike-pushup', 'first unlocked, unachieved step on the route');
  assert.strictEqual(p.route.find(s => s.id === 'wall-plank').status, 'achieved');
  assert.strictEqual(p.done, false);
});

test('random "new skill": only unlocked or one step ahead; equipment preferred; fallback is labelled', () => {
  const st = stFor(['pushup', 'incline-pushup']);
  for (let i = 0; i < 40; i++) {
    const r = T.randomNew(tree, st, have('wall', 'chair'), Math.random);
    const s = tree.byId.get(r.skill.id);
    assert.notStrictEqual(st.get(s.id).status, 'achieved');
    assert.deepStrictEqual(r.skill.missingEquipment, [], 'prefers what the equipment allows');
    const missing = s.requires.filter(x => !st.get(x).achievedAt);
    assert.ok(missing.every(x => st.get(x).status === 'unlocked'), `${s.id} is more than one step ahead`);
  }
  // With nothing but a floor, everything unlocked here needs equipment or is fine; a user who
  // has finished every equipment-free skill is told what to get rather than getting nothing.
  const freeIds = tree.skills.filter(s => T.missingEquipment(s, have()).length === 0).map(s => s.id);
  const stAll = stFor(freeIds);
  const r = T.randomNew(tree, stAll, have(), Math.random);
  assert.ok(r, 'something is offered');
  assert.strictEqual(r.equipmentFallback, true);
  assert.ok(r.skill.missingEquipment.length > 0);
});

test('random "today": strictly unlocked, near the user\'s level, never an achieved or locked skill', () => {
  const st = stFor(['incline-pushup', 'pushup', 'squat', 'plank']);
  const level = T.levelOf(tree, st);
  for (let i = 0; i < 60; i++) {
    const r = T.randomToday(tree, st, have('wall', 'chair', 'handles'), Math.random);
    assert.strictEqual(st.get(r.skill.id).status, 'unlocked');
    assert.ok(tree.depth.get(r.skill.id) <= level + 1);
  }
});

test('weighting: with a fixed rng the frontier is favoured over the shallow', () => {
  const items = [{ n: 'a', w: 1 }, { n: 'b', w: 3 }];
  assert.strictEqual(T.pickWeighted(items, x => x.w, () => 0.0).n, 'a');
  assert.strictEqual(T.pickWeighted(items, x => x.w, () => 0.3).n, 'b');
  assert.strictEqual(T.pickWeighted([], x => x.w, () => 0.3), null);
});

test('summary buckets: achieved, in progress (tried, not yet), available, locked', () => {
  const att = [attempt('wrist-prep'), attempt('wall-plank', 'not_yet')];
  const st = T.statusMap(tree, att);
  const sum = T.summary(tree, st, have('wall', 'chair'));
  assert.deepStrictEqual(sum.achieved.map(s => s.id), ['wrist-prep']);
  assert.deepStrictEqual(sum.inProgress.map(s => s.id), ['wall-plank']);
  assert.ok(sum.available.length > 0);
  assert.strictEqual(sum.achieved.length + sum.inProgress.length + sum.available.length + sum.lockedCount, sum.total);
});
