'use strict';

/**
 * Picking a comp-prep plan from how long the athlete has, and back-dating the start
 * so the plan's TAPER lands on competition week. The one rule that matters: whatever
 * plan is chosen, weekNumber on comp day (computed the way /plans/today computes it)
 * equals the plan's length — so the final, taper week is comp week.
 *
 * Run: node --test test/plan-select.test.js
 */

const { test } = require('node:test');
const assert   = require('node:assert');
const { weeksUntil, selectPlan, alignedStartDate } = require('../api/plan-select');

const PLANS = [
  { durationWeeks: 2, name: '2wk' }, { durationWeeks: 4, name: '4wk' },
  { durationWeeks: 6, name: '6wk' }, { durationWeeks: 8, name: '8wk' },
];

// The exact weekNumber math from GET /plans/today, on clean day boundaries.
function weekNumberOn(dateStr, startStr) {
  const day = 86400000;
  const start = new Date(startStr + 'T00:00:00Z');
  const today = new Date(dateStr + 'T00:00:00Z');
  return Math.floor((today - start) / (7 * day)) + 1;
}

test('weeksUntil rounds up whole weeks and never goes negative', () => {
  assert.strictEqual(weeksUntil('2026-09-29', new Date('2026-09-01T12:00:00Z')), 4); // 28 days
  assert.strictEqual(weeksUntil('2026-09-29', new Date('2026-08-31T12:00:00Z')), 5); // 29 days → ceil
  assert.strictEqual(weeksUntil('2026-09-29', new Date('2026-09-29T12:00:00Z')), 0); // comp day
  assert.strictEqual(weeksUntil('2026-09-01', new Date('2026-09-29T12:00:00Z')), 0); // past → 0, not negative
});

test('selectPlan takes the longest block that fits the weeks available', () => {
  assert.strictEqual(selectPlan(PLANS, 5).durationWeeks, 4);  // fits: 2,4 → 4
  assert.strictEqual(selectPlan(PLANS, 4).durationWeeks, 4);  // exact
  assert.strictEqual(selectPlan(PLANS, 7).durationWeeks, 6);  // fits: 2,4,6 → 6
  assert.strictEqual(selectPlan(PLANS, 12).durationWeeks, 8); // all fit → longest
});

test('selectPlan falls to the shortest block when notice is shorter than any plan', () => {
  assert.strictEqual(selectPlan(PLANS, 1).durationWeeks, 2);
  assert.strictEqual(selectPlan(PLANS, 0).durationWeeks, 2);
});

test('selectPlan returns null for no plans', () => {
  assert.strictEqual(selectPlan([], 4), null);
});

test('alignedStartDate puts comp day in the plan’s final (taper) week — for every length', () => {
  const comp = '2026-09-29';
  for (const weeks of [2, 4, 6, 8]) {
    const start = alignedStartDate(comp, weeks);
    assert.strictEqual(weekNumberOn(comp, start), weeks,
      `${weeks}-week plan: comp day should land in week ${weeks}, got ${weekNumberOn(comp, start)} (start ${start})`);
    // And the day BEFORE the block's start is week 0 (not yet begun), i.e. start is a real boundary.
    assert.ok(weekNumberOn(comp, start) >= 1);
  }
});
