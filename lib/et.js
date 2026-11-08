'use strict';

/**
 * ET is the estate's only clock. toISOString() is UTC, so after 8pm ET (7pm in
 * winter) it names tomorrow. Everything that wants a calendar DATE comes from here.
 * A timestamp that really is an instant (startedAt, finishedAt) stays a Date.
 */
const TZ = 'America/New_York';

/** "2026-11-03" for the ET calendar day containing `now`. */
const todayET = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: TZ });

/** "HH:MM:SS" on the ET wall clock. */
const timeET = (now = new Date()) => now.toLocaleTimeString('en-GB', { timeZone: TZ, hour12: false });

/** Add whole days to a "YYYY-MM-DD" string. Pure calendar arithmetic, no clock involved. */
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ET calendar date `n` days from today (negative for the past). */
const etDateOffset = (n, now = new Date()) => addDays(todayET(now), n);

/** Whole days from date string a to date string b (b - a). */
function daysBetween(a, b) {
  return Math.round((Date.parse(`${String(b).slice(0, 10)}T00:00:00Z`) - Date.parse(`${String(a).slice(0, 10)}T00:00:00Z`)) / 86400000);
}

/** 0 (Sunday) to 6 for an ET calendar date string, or for today. */
function weekdayOf(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}
const weekdayET = (now = new Date()) => weekdayOf(todayET(now));

module.exports = { TZ, todayET, timeET, addDays, etDateOffset, daysBetween, weekdayOf, weekdayET };
