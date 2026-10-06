'use strict';

/**
 * Weekly benchmarks, pure: which are due, that every generated week includes
 * them, and the reminder with a FAKE CLOCK (every `now` below is a literal).
 *
 * Reminder contract under test: one message on the reminder day at/after the
 * chosen time, then at most one nudge the next day, only for what is still
 * unlogged; never a third; nothing when switched off.
 *
 * Run: node --test test/benchmarks.test.js
 */

const { test } = require('node:test');
const assert   = require('node:assert');
const B = require('../api/benchmarks');
const W = require('../api/week-plan');
const T = require('../api/skill-tree');

const mkBench = (item, o = {}) => ({ id: item, item, name: item, short: item, unit: 'reps', enabled: true, everyWeeks: 1, dayOfWeek: null, position: 0, ...o });
const BENCH = [mkBench('pushups', { position: 0 }), mkBench('plank', { position: 1 }), mkBench('treadmill', { position: 2, everyWeeks: 4 })];
// 2026-10-03 is a Saturday. America/New_York is UTC-4 in October.
const ET = (isoLocal) => new Date(isoLocal + '-04:00');

test('parsing days and times', () => {
  assert.deepStrictEqual(['sat', 'Saturday', 6, '6', 'sun', 0].map(B.parseDay), [6, 6, 6, 6, 0, 0]);
  assert.strictEqual(B.parseDay('funday'), null);
  assert.deepStrictEqual(['9', '09:30', '6pm', '6:15 pm', '12am', '12pm'].map(B.parseTimeOfDay), ['09:00', '09:30', '18:00', '18:15', '00:00', '12:00']);
  assert.strictEqual(B.parseTimeOfDay('25:00'), null);
});

test('weeks run Monday to Sunday', () => {
  assert.strictEqual(B.weekStart('2026-10-03'), '2026-09-28'); // Saturday
  assert.strictEqual(B.weekStart('2026-10-04'), '2026-09-28'); // Sunday is the END of the week
  assert.strictEqual(B.weekStart('2026-10-05'), '2026-10-05'); // Monday
});

test('weekly benchmarks are always due; a 4-weekly one only every fourth week', () => {
  const wk = date => B.dueThisWeek(BENCH, { treadmill: '2026-09-05' }, date).map(b => b.item);
  assert.deepStrictEqual(wk('2026-09-12'), ['pushups', 'plank']);                  // 1 week after the treadmill
  assert.deepStrictEqual(wk('2026-09-26'), ['pushups', 'plank']);                  // 3 weeks
  assert.deepStrictEqual(wk('2026-10-03'), ['pushups', 'plank', 'treadmill']);     // 4 weeks
  assert.deepStrictEqual(B.dueThisWeek(BENCH, {}, '2026-10-03').map(b => b.item), ['pushups', 'plank', 'treadmill'], 'never done = due');
  // doing it this week keeps it in the week's list (shown done) rather than dropping it
  const done = B.dueThisWeek(BENCH, { treadmill: '2026-10-03' }, '2026-10-03').find(b => b.item === 'treadmill');
  assert.strictEqual(done.doneThisWeek, true);
});

test('disabled benchmarks are not due', () => {
  assert.deepStrictEqual(B.dueThisWeek([mkBench('x', { enabled: false })], {}, '2026-10-03'), []);
});

test('buildWeek puts each due benchmark on its day; a custom day wins over the default', () => {
  const bench = [mkBench('pushups'), mkBench('plank', { dayOfWeek: 3 })];
  const w = B.buildWeek({ date: '2026-10-03', benchmarks: bench, lastByItem: {}, benchmarkDay: 6, trainingBlocks: () => [] });
  assert.strictEqual(w.days.length, 7);
  assert.strictEqual(w.days[0].name, 'Monday');
  const byDay = Object.fromEntries(w.days.map(d => [d.name, d.benchmarks.map(b => b.item)]));
  assert.deepStrictEqual(byDay.Saturday, ['pushups']);
  assert.deepStrictEqual(byDay.Wednesday, ['plank']);
  assert.strictEqual(w.days.find(d => d.name === 'Saturday').kind, 'benchmarks');
  assert.strictEqual(w.days.find(d => d.name === 'Wednesday').kind, 'train', 'a training day that also carries a benchmark stays a training day');
});

test('the starter plan ALWAYS carries the benchmarks, whatever the equipment or focus', () => {
  const tree = T.loadTree();
  const st = T.statusMap(tree, []);
  for (const focus of B.FOCUSES) {
    for (const eq of [['handles'], []]) {
      const plan = W.buildPlan({ tree, st, have: new Set(['none', 'wall', 'chair', ...eq]), focus, benchmarks: BENCH, lastByItem: {}, date: '2026-10-03', benchmarkDay: 6 });
      const carried = plan.days.flatMap(d => d.benchmarks.map(b => b.item)).sort();
      assert.deepStrictEqual(carried, ['plank', 'pushups', 'treadmill'], `${focus}/${eq}`);
      assert.strictEqual(plan.days.filter(d => d.kind === 'train').length, 3);
    }
  }
});

test('starter plan for handles and no bar: no bar skill, handle work present, drawn from the tree', () => {
  const tree = T.loadTree();
  const st = T.statusMap(tree, ['incline-pushup', 'pushup', 'wrist-prep', 'support-hold', 'plank', 'hollow-hold'].map(id => ({ skillId: id, date: '2026-10-01', result: 'succeeded' })));
  const plan = W.buildPlan({ tree, st, have: new Set(['none', 'wall', 'chair', 'handles']), focus: 'balanced', benchmarks: [], lastByItem: {}, date: '2026-10-03', benchmarkDay: 6 });
  const blocks = plan.days.flatMap(d => d.blocks);
  assert.ok(blocks.length >= 6);
  assert.ok(blocks.every(b => !tree.byId.get(b.skillId).equipment.some(e => /\bbar\b/.test(e) && !/dip/.test(e))), 'nothing needs a pull-up bar');
  assert.ok(blocks.some(b => ['deficit-pushup', 'planche-lean', 'tuck-lsit', 'pike-pushup'].includes(b.skillId)), 'handles line is used');
  assert.ok(blocks.every(b => !b.ref || b.ref.startsWith('content/calisthenics/')));
  assert.ok(plan.routines.fullBody.endsWith('beginner-full-body-3x-week.md'));
});

test('focus adds its lines to every training day', () => {
  const tree = T.loadTree();
  const st = T.statusMap(tree, []);
  const lines = focus => new Set(W.buildPlan({ tree, st, have: new Set(['none', 'wall', 'chair', 'bar', 'handles']), focus, benchmarks: [], lastByItem: {}, date: '2026-10-03' }).days.filter(d => d.kind === 'train').flatMap(d => d.blocks.map(b => b.line)));
  assert.ok(!lines('balanced').has('pull'));
  assert.ok(lines('pull').has('pull'));
  assert.ok(lines('endurance').has('endurance'));
});

// ── reminder, with a fake clock ──────────────────────────────────────────────

const cfg = (o = {}) => ({ enabled: true, day: 6, time: '09:00', tz: 'America/New_York', lastSentDate: null, lastSentItems: [], nudgedFor: null, ...o });
const check = (config, now, last = {}) => B.reminderCheck({ config, benchmarks: BENCH, lastByItem: last, now });

test('reminder: nothing before the time, nothing on the wrong day', () => {
  assert.strictEqual(check(cfg(), ET('2026-10-03T08:59:00')).action, 'none');
  assert.strictEqual(check(cfg(), ET('2026-10-02T10:00:00')).action, 'none');   // Friday
});

test('reminder: sends once on the day at/after the time, listing what to log and how', () => {
  const r = check(cfg(), ET('2026-10-03T09:05:00'));
  assert.strictEqual(r.action, 'send');
  assert.deepStrictEqual(r.items, ['pushups', 'plank', 'treadmill']);
  assert.match(r.text, /log benchmark pushups/);
  assert.match(r.text, /reminders off/);
  // after the ack, the same day never sends again, however many ticks pass
  const c = B.reminderAck(cfg(), 'send', r.date, r.items);
  for (const t of ['2026-10-03T09:35:00', '2026-10-03T14:00:00', '2026-10-03T23:59:00']) assert.strictEqual(check(c, ET(t)).action, 'none', t);
});

test('reminder: ONE nudge next day if still unlogged, then nothing, ever', () => {
  const sent = B.reminderAck(cfg(), 'send', '2026-10-03', ['pushups', 'plank', 'treadmill']);
  assert.strictEqual(check(sent, ET('2026-10-04T08:00:00')).action, 'none', 'not before the time');
  const n = check(sent, ET('2026-10-04T09:10:00'));
  assert.strictEqual(n.action, 'nudge');
  assert.match(n.text, /one only/);
  const nudged = B.reminderAck(sent, 'nudge', n.date);
  for (const t of ['2026-10-04T09:40:00', '2026-10-04T18:00:00', '2026-10-05T09:10:00', '2026-10-09T09:10:00']) assert.strictEqual(check(nudged, ET(t)).action, 'none', t);
  // and next Saturday it starts again
  assert.strictEqual(check(nudged, ET('2026-10-10T09:10:00'), {}).action, 'send');
});

test('reminder: the nudge lists only what is still unlogged, and is skipped when all is logged', () => {
  const sent = B.reminderAck(cfg(), 'send', '2026-10-03', ['pushups', 'plank', 'treadmill']);
  const partial = check(sent, ET('2026-10-04T09:10:00'), { pushups: '2026-10-03' });
  assert.deepStrictEqual(partial.items, ['plank', 'treadmill']);
  const all = check(sent, ET('2026-10-04T09:10:00'), { pushups: '2026-10-03', plank: '2026-10-04', treadmill: '2026-10-04' });
  assert.strictEqual(all.action, 'none');
});

test('reminder: already logged everything this week -> nothing to send', () => {
  const last = { pushups: '2026-10-01', plank: '2026-10-01', treadmill: '2026-10-01' };
  assert.strictEqual(check(cfg(), ET('2026-10-03T09:05:00'), last).action, 'none');
});

test('reminder: opt-out, and a changed day/time/zone take effect', () => {
  assert.strictEqual(check(cfg({ enabled: false }), ET('2026-10-03T09:05:00')).action, 'none');
  assert.strictEqual(check(cfg({ day: 0, time: '18:30' }), ET('2026-10-04T18:29:00')).action, 'none');
  assert.strictEqual(check(cfg({ day: 0, time: '18:30' }), ET('2026-10-04T18:31:00')).action, 'send');
  // 09:05 New York is 14:05 in London (BST is UTC+1): 13:05 UTC. Same instant, two zones, two answers.
  const instant = new Date('2026-10-03T13:05:00Z');
  assert.strictEqual(check(cfg({ tz: 'America/New_York' }), instant).action, 'send');
  assert.strictEqual(check(cfg({ tz: 'Asia/Tokyo', day: 6, time: '09:00' }), instant).action, 'send');        // 22:05 Sat in Tokyo
  assert.strictEqual(check(cfg({ tz: 'Pacific/Auckland', day: 6, time: '09:00' }), instant).action, 'none');  // already Sunday 02:05 there
});

test('reminder text names no business or person (resellable / multi-user)', () => {
  const r = check(cfg(), ET('2026-10-03T09:05:00'));
  assert.doesNotMatch(r.text, /Nick|Neith|octopus/i);
});
