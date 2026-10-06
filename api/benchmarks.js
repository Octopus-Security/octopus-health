'use strict';

/**
 * benchmarks.js — weekly benchmark movements: defaults, what is due, the weekly
 * plan that always includes them, and the reminder decision. Pure: the clock is
 * an argument everywhere, so a fake clock tests everything here.
 *
 * ── What a benchmark is ──────────────────────────────────────────────────────
 * A named movement the user re-tests on a schedule (every week, or every 2-4
 * weeks for something heavy like a treadmill test). Its RESULTS are ordinary
 * fitness-test results for the same `item` (see fitness-tests.js), so a result
 * logged from the tests page, the treadmill page or "log benchmark pushups 22"
 * is one history, not three.
 *
 * ── Defaults are seed data, never rules ──────────────────────────────────────
 * DEFAULT_BENCHMARKS are written once per user and remembered in a seed log
 * (fitness-store.js). Editing, reordering or deleting a seeded row is permanent:
 * a redeploy never re-adds a deleted default and never reverts an edit. A NEW
 * default added in a later release is created once for existing users too.
 *
 * ── Weeks ────────────────────────────────────────────────────────────────────
 * Weeks run Monday-Sunday in the USER'S time zone. dayOfWeek is 0=Sunday ..
 * 6=Saturday, like JavaScript. A benchmark with no dayOfWeek happens on the
 * user's benchmark day (default Saturday).
 */

const { addDays } = require('./fitness-tests');

const DEFAULT_TZ = process.env.HEALTH_DEFAULT_TZ || 'America/New_York';
const DEFAULT_BENCHMARK_DAY = 6;      // Saturday
const FOCUSES = ['balanced', 'push', 'pull', 'skills', 'endurance', 'legs', 'core'];

const DEFAULT_BENCHMARKS = [
  { seedKey: 'max_pushups_handles', item: 'max_pushups_handles', focus: 'push',      everyWeeks: 1 },
  { seedKey: 'max_pike_pushups',    item: 'max_pike_pushups',    focus: 'push',      everyWeeks: 1 },
  { seedKey: 'tuck_lsit_hold',      item: 'tuck_lsit_hold',      focus: 'skills',    everyWeeks: 1 },
  { seedKey: 'plank_hold',          item: 'plank_hold',          focus: 'core',      everyWeeks: 1 },
  { seedKey: 'squats_60s',          item: 'squats_60s',          focus: 'legs',      everyWeeks: 1 },
  { seedKey: 'hollow_hold',         item: 'hollow_hold',         focus: 'core',      everyWeeks: 1 },
  { seedKey: 'treadmill_stage',     item: 'treadmill_stage',     focus: 'endurance', everyWeeks: 4 },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** 'sat', 'Saturday', 6, '6' -> 6; null when not a day. */
function parseDay(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' || /^\d$/.test(String(v))) { const n = Number(v); return n >= 0 && n <= 6 ? n : null; }
  const k = String(v).trim().toLowerCase().slice(0, 3);
  const i = DAY_NAMES.findIndex(n => n.toLowerCase().slice(0, 3) === k);
  return i >= 0 ? i : null;
}

/** "9", "09:30", "9am", "6:15 pm" -> "HH:MM" 24h; null when not a time. */
function parseTimeOfDay(v) {
  const m = String(v || '').trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2] || 0);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function validTz(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/** What the clock says in `tz`: date, weekday (0=Sun) and minutes since midnight. */
function localParts(now, tz = DEFAULT_TZ) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(now).map(x => [x.type, x.value]));
  const hour = Number(p.hour) % 24;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday),
    minutes: hour * 60 + Number(p.minute),
  };
}

const dowOf = dateStr => new Date(`${dateStr}T00:00:00Z`).getUTCDay();
/** Monday of the week containing dateStr. */
function weekStart(dateStr) {
  const dow = dowOf(dateStr);
  return addDays(dateStr, -((dow + 6) % 7));
}
const weeksBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / (7 * 86400000));

/**
 * Is this benchmark part of the week starting `ws`?
 * Weekly ones always; every-N-week ones when never done, or when N or more
 * weeks have passed since the week of the last result. A result logged THIS
 * week keeps it in this week's list (it shows as done), so the plan does not
 * lose the item the moment it is logged.
 */
function isDue(b, lastDate, ws) {
  if (!b.enabled) return false;
  if (!lastDate) return true;
  const lastWs = weekStart(lastDate);
  if (lastWs === ws) return true;
  return weeksBetween(lastWs, ws) >= Math.max(1, b.everyWeeks || 1);
}

/**
 * @param benchmarks rows {id,key,name,item,short,everyWeeks,dayOfWeek,enabled,position,focus}
 * @param lastByItem  {item: 'YYYY-MM-DD'} most recent result date
 * @returns benchmarks due in the week of `date`, each with `day` and `doneThisWeek`
 */
function dueThisWeek(benchmarks, lastByItem, date, benchmarkDay = DEFAULT_BENCHMARK_DAY) {
  const ws = weekStart(date);
  return benchmarks
    .filter(b => isDue(b, lastByItem[b.item], ws))
    .sort((a, b) => a.position - b.position)
    .map(b => {
      const last = lastByItem[b.item];
      return { ...b, day: b.dayOfWeek ?? benchmarkDay, doneThisWeek: !!last && last >= ws };
    });
}

// ── The week's plan ──────────────────────────────────────────────────────────

const TRAIN_DAYS = [1, 3, 5]; // Mon / Wed / Fri

/**
 * A 7-day plan: three training days built by `trainingBlocks(dayIndex)` (the
 * caller supplies them from the skill tree) and every due benchmark on its day.
 * Benchmarks are NOT optional furniture - they are added here, in one place, so
 * the starter plan and any other plan built from this function cannot forget
 * them. A benchmark day that is also a training day carries both.
 */
function buildWeek({ date, benchmarks, lastByItem, benchmarkDay = DEFAULT_BENCHMARK_DAY, trainingBlocks, trainDays = TRAIN_DAYS }) {
  const due = dueThisWeek(benchmarks, lastByItem, date, benchmarkDay);
  const ws = weekStart(date);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dow = (i + 1) % 7; // Mon..Sun
    const ti = trainDays.indexOf(dow);
    days.push({
      dow, name: DAY_NAMES[dow], date: addDays(ws, i),
      kind: ti >= 0 ? 'train' : 'rest',
      blocks: ti >= 0 ? trainingBlocks(ti) : [],
      benchmarks: due.filter(b => b.day === dow),
    });
  }
  for (const d of days) if (d.benchmarks.length && d.kind === 'rest') d.kind = 'benchmarks';
  return { weekStart: ws, days, benchmarksDue: due };
}

// ── Reminder decision ────────────────────────────────────────────────────────

/**
 * Reminder state is one small JSON document per user:
 *   { enabled, day, time:'HH:MM', tz, lastSentDate, lastSentItems:[item], nudgedFor }
 * `check` only DECIDES; the caller delivers and then acks, so a failed DM is
 * retried next tick instead of being recorded as sent.
 *
 * Exactly once, then at most one nudge:
 *  - SEND on the reminder day, local time at/after `time`, once per date
 *    (lastSentDate), listing the benchmarks due and not yet logged this week.
 *  - NUDGE on the following local day at/after `time`, only if some of the items
 *    sent are still unlogged since the send, and only once per send (nudgedFor).
 *  A user who logs everything gets no nudge; nothing is ever sent a third time.
 */
function defaultReminder() {
  // day null = "the user's benchmark day", resolved by the store; an explicit
  // number means they chose a reminder day of their own.
  return { enabled: true, day: null, time: '09:00', tz: DEFAULT_TZ, lastSentDate: null, lastSentItems: [], nudgedFor: null };
}

function reminderCheck({ config, benchmarks, lastByItem, now }) {
  const c = { ...defaultReminder(), ...(config || {}) };
  if (c.day === null || c.day === undefined) c.day = DEFAULT_BENCHMARK_DAY;
  if (!c.enabled) return { action: 'none', reason: 'off' };
  const local = localParts(now, c.tz);
  const atMin = (() => { const [h, m] = c.time.split(':').map(Number); return h * 60 + m; })();
  if (local.minutes < atMin) return { action: 'none', reason: 'before time' };

  if (local.dow === c.day && c.lastSentDate !== local.date) {
    const ws = weekStart(local.date);
    const items = dueThisWeek(benchmarks, lastByItem, local.date, c.day).filter(b => !b.doneThisWeek);
    if (!items.length) return { action: 'none', reason: 'nothing due' };
    return { action: 'send', date: local.date, items: items.map(i => i.item), text: reminderText(items, 'send', ws) };
  }

  if (c.lastSentDate && local.date === addDays(c.lastSentDate, 1) && c.nudgedFor !== c.lastSentDate) {
    const remaining = benchmarks.filter(b => c.lastSentItems.includes(b.item) && !(lastByItem[b.item] && lastByItem[b.item] >= c.lastSentDate));
    if (!remaining.length) return { action: 'none', reason: 'all logged' };
    return { action: 'nudge', date: c.lastSentDate, items: remaining.map(i => i.item), text: reminderText(remaining, 'nudge') };
  }
  return { action: 'none', reason: 'not due' };
}

/** What state to store once the DM was delivered. */
function reminderAck(config, kind, date, items) {
  const c = { ...defaultReminder(), ...(config || {}) };
  if (kind === 'send') return { ...c, lastSentDate: date, lastSentItems: items || [], nudgedFor: null };
  if (kind === 'nudge') return { ...c, nudgedFor: date };
  return c;
}

function reminderText(items, kind) {
  const lines = items.map(b => `- ${b.name}: "log benchmark ${b.short || b.item} <${b.unit || 'number'}>"`);
  const head = kind === 'nudge'
    ? 'Quick nudge, one only: these benchmarks from yesterday are still not logged.'
    : 'Weekly benchmark day. This week\'s movements:';
  return `${head}\n${lines.join('\n')}\nReply with a line like the ones above to log one. Say "benchmark reminders off" to stop these, or "benchmark reminders Sunday 6pm" to move them.`;
}

module.exports = {
  DEFAULT_TZ, DEFAULT_BENCHMARK_DAY, FOCUSES, DEFAULT_BENCHMARKS, DAY_NAMES, TRAIN_DAYS,
  parseDay, parseTimeOfDay, validTz, localParts, weekStart, weeksBetween,
  isDue, dueThisWeek, buildWeek, defaultReminder, reminderCheck, reminderAck, reminderText,
};
