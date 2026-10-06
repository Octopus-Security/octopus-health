'use strict';

/**
 * The test catalogue and the self-comparison maths (api/fitness-tests.js).
 * Pure. The point of trend() is that it never invents a comparison: "up since
 * last week" about a result from yesterday would be made up, so it answers null.
 * Run: node --test test/fitness-tests.test.js
 */

const { test } = require('node:test');
const assert   = require('node:assert');
const F = require('../api/fitness-tests');

test('every item has instructions, a unit and a direction; ids are unique', () => {
  const ids = new Set();
  for (const i of F.ITEMS) {
    assert.ok(!ids.has(i.id)); ids.add(i.id);
    assert.ok(i.how && i.how.length > 40, i.id);
    assert.ok(['higher', 'lower'].includes(i.better), i.id);
    assert.ok(F.BATTERIES[i.battery], i.id);
  }
  for (const needed of ['max_pushups_handles', 'max_pullups', 'max_rows', 'max_dips', 'plank_hold', 'wall_sit', 'squats_60s', 'hollow_hold',
    'curl_ups', 'pushups_cadence', 'trunk_lift', 'sit_and_reach', 'treadmill_stage', 'cooper_12min_m']) assert.ok(F.getItem(needed), needed);
});

test('no age/sex norm tables are shipped', () => {
  const text = JSON.stringify(F.ITEMS).toLowerCase();
  for (const w of ['percentile', 'excellent', 'healthy fitness zone', 'needs improvement', 'age group']) assert.ok(!text.includes(w), w);
  assert.ok(!F.ITEMS.some(i => 'norm' in i || 'norms' in i || 'ranges' in i));
});

test('trend: best, latest, previous, and dated references', () => {
  const t = F.trend([
    { value: 10, date: '2026-09-06' }, { value: 12, date: '2026-09-20' }, { value: 11, date: '2026-09-27' }, { value: 15, date: '2026-10-04' },
  ]);
  assert.deepStrictEqual([t.count, t.latest.value, t.best.value, t.best.isLatest], [4, 15, 15, true]);
  assert.strictEqual(t.vsPrevious.delta, 4);
  assert.deepStrictEqual(t.vsLastWeek.reference, { value: 11, date: '2026-09-27' });  // 7 days before
  assert.strictEqual(t.vsLastWeek.delta, 4);
  assert.deepStrictEqual(t.vs4Weeks.reference, { value: 10, date: '2026-09-06' });   // exactly 28 days before the latest counts; 09-20 is only 14
});

test('trend: references are the newest result AT LEAST that old, and null when there is none', () => {
  const t = F.trend([{ value: 10, date: '2026-10-03' }, { value: 12, date: '2026-10-04' }]);
  assert.ok(t.vsPrevious);
  assert.strictEqual(t.vsLastWeek, null, 'a result from yesterday is not "last week"');
  assert.strictEqual(t.vs4Weeks, null);
  assert.strictEqual(F.trend([]).latest, null);
  const one = F.trend([{ value: 5, date: '2026-10-04' }]);
  assert.strictEqual(one.vsPrevious, null);
});

test('trend: lower-is-better (a time) counts a drop as improvement and picks the smallest as best', () => {
  const t = F.trend([{ value: 600, date: '2026-09-01' }, { value: 570, date: '2026-09-29' }, { value: 580, date: '2026-10-06' }], 'lower');
  assert.strictEqual(t.best.value, 570);
  assert.strictEqual(t.vsLastWeek.improved, false);  // 580 now vs 570 a week ago: slower, so worse
  assert.strictEqual(t.vs4Weeks.improved, true);     // 580 vs 600 four weeks ago: faster
});

test('formatting and parsing times', () => {
  assert.strictEqual(F.formatValue(F.getItem('run_1_5mi_s'), 605), '10:05');
  assert.strictEqual(F.formatValue(F.getItem('plank_hold'), 62), '62 s');
  assert.strictEqual(F.formatValue(F.getItem('max_pullups'), 7), '7');
  assert.strictEqual(F.parseTime('10:05'), 605);
  assert.strictEqual(F.parseTime('605'), 605);
  assert.strictEqual(F.parseTime('abc'), null);
});

test('finding an item from words', () => {
  assert.strictEqual(F.findItem('plank').id, 'plank_hold');
  assert.strictEqual(F.findItem('Max pull-ups').id, 'max_pullups');
  assert.strictEqual(F.findItem('nonsense'), null);
});
