'use strict';

/**
 * plan-select.js — pick the competition-prep plan from how long the athlete has,
 * and the start date that lands the plan's TAPER on competition week.
 *
 * "Do what makes sense from how long I have": choose the seeded plan whose length
 * best fits the weeks available — the longest block that fits, so more runway buys a
 * fuller camp and short notice falls to the 2-week sharpen/taper. Then back-date the
 * start so the final (taper) week contains comp day, whatever today is: an athlete
 * with more weeks than the plan starts the block later; one with fewer starts
 * mid-block, joining the camp at the phase the remaining time allows.
 *
 * Pure and dependency-free so the arithmetic is tested on its own (test/plan-select).
 */

// These are CALENDAR dates, not instants, so all arithmetic is in UTC: a
// 'YYYY-MM-DD' string parses to UTC midnight, and mixing that with a local
// startOfDay would shift the day by the machine's offset and throw the week count
// off by one.
function dayMsUTC(d) {
  const x = new Date(d);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
}
function daysBetween(a, b) {
  return Math.round((dayMsUTC(b) - dayMsUTC(a)) / 86400000);
}
function toISODate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole weeks from today until the competition, rounded up; never negative. */
function weeksUntil(compDate, today = new Date()) {
  return Math.max(0, Math.ceil(daysBetween(today, compDate) / 7));
}

/**
 * Choose a plan for `weeks` of runway from `plans` (each with a numeric
 * durationWeeks). The longest plan that fits within the weeks available; if none
 * fit — shorter notice than the shortest plan — the shortest plan. null if empty.
 */
function selectPlan(plans, weeks) {
  if (!plans || !plans.length) return null;
  const sorted = [...plans].sort((a, b) => a.durationWeeks - b.durationWeeks);
  const fitting = sorted.filter(p => p.durationWeeks <= weeks);
  return fitting.length ? fitting[fitting.length - 1] : sorted[0];
}

/**
 * The start date (YYYY-MM-DD) that puts the plan's LAST week on comp week — comp day
 * is the final day of week N. /plans/today computes weekNumber as
 * floor((today - start)/7) + 1, so start = comp - (N*7 - 1) days yields weekNumber = N
 * on comp day and the taper phase resolves correctly.
 */
function alignedStartDate(compDate, durationWeeks) {
  return toISODate(dayMsUTC(compDate) - (durationWeeks * 7 - 1) * 86400000);
}

module.exports = { weeksUntil, selectPlan, alignedStartDate, daysBetween, toISODate };
