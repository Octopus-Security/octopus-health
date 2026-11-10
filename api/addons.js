'use strict';

/**
 * addons.js - goal add-ons: a goal-specific bundle layered ON TOP of the account's weekly
 * program. It adds a fixed amount of work per week on chosen days and progresses over weeks.
 * An account may run several at once, next to its single active TrainingPlan.
 *
 *   catalogue   content/addons/*.json, one file per add-on (loaded and validated here)
 *   state       the GoalAddon table in the per-user database (this file is the only writer)
 *   merge       placeWeek (pure) puts each active add-on's sessions on days; addonsForWeek /
 *               addonsForDay add the database half (state, gear, done flags)
 *   done        one UserSetting per add-on per ET day, in the routineDone style
 *
 * Catalogue shape (content/addons/README is this comment):
 *   { id, title, goalKind, summary, honesty, deload: 'follow'|'keep', nutritionLink?, requires?: [equipment id],
 *     requiresNote?, weeks: [ { from, to|null, focus, tracks: [ { id, sessionsPerWeek, placement, sessions } ] } ] }
 *   placement: 'training' (days the week plan marks as training) | 'rest' | 'any' (every day) | 'daily'
 *     (every day, so sessionsPerWeek must be 7)
 *   sessions: a list of session templates; session k of a track in a week is sessions[k % length].
 *   a session is a list of items: { routine: <api/mobility.js id> } or
 *     { exercise: <exact SEED_EXERCISES name>, sets, reps | duration, note?, requires?, substitutes? }
 *   `tracks` (a deviation from "one sessionsPerWeek per phase"): one add-on can mix a 2x/week strength
 *   track on training days with a 4x/week mobility track, and still never put two sessions on one day.
 *
 * Week index = whole weeks since startDate (ET) + 1, evaluated at the date asked about, or at the
 * first day of the week being built (never before startDate). It picks the phase.
 *
 * Every date here is an ET calendar string from lib/et.js; nothing calls toISOString for a date.
 */

const fs = require('fs');
const path = require('path');
const { todayET, addDays, daysBetween } = require('../lib/et');

const CONTENT_DIR = path.join(__dirname, '..', 'content', 'addons');
const STATUSES = ['active', 'paused', 'done'];
const PLACEMENTS = ['training', 'rest', 'any', 'daily'];
const DELOADS = ['follow', 'keep'];
const GOAL_KINDS = ['strength', 'skill', 'mobility', 'body_comp', 'nutrition', 'habit', 'other'];
const REMIND_KEY = 'addons:remindAt';

// ── catalogue ────────────────────────────────────────────────────────────────

const isStr = v => typeof v === 'string' && v.trim().length > 0;
const isInt = v => Number.isInteger(v);

/**
 * Structural errors for one add-on (always), and reference errors when `refs` is given:
 * refs = { exercises:Set<exact name>, routines:Set<id>, equipment:Set<id> }.
 * Returns an array of strings; empty means valid.
 */
function validateAddon(a, refs = null) {
  const errs = [];
  const err = m => errs.push(`${a && a.id ? a.id : '(no id)'}: ${m}`);
  if (!a || typeof a !== 'object') return ['not an object'];
  if (!isStr(a.id) || !/^[a-z0-9-]+$/.test(a.id)) err('id must be lowercase letters, digits and dashes');
  for (const f of ['title', 'summary', 'honesty']) if (!isStr(a[f])) err(`${f} is required`);
  if (!GOAL_KINDS.includes(a.goalKind)) err(`goalKind must be one of ${GOAL_KINDS.join(', ')}`);
  if (!DELOADS.includes(a.deload)) err(`deload must be one of ${DELOADS.join(', ')}`);
  if (a.nutritionLink !== undefined && typeof a.nutritionLink !== 'boolean') err('nutritionLink must be a boolean');
  if (a.requires !== undefined && !(Array.isArray(a.requires) && a.requires.every(isStr))) err('requires must be a list of equipment ids');
  if (refs && Array.isArray(a.requires)) for (const r of a.requires) if (!refs.equipment.has(r)) err(`unknown equipment id "${r}"`);
  if (!Array.isArray(a.weeks) || !a.weeks.length) { err('weeks must be a non-empty list'); return errs; }
  let expectFrom = 1;
  a.weeks.forEach((ph, pi) => {
    const at = `weeks[${pi}]`;
    if (ph.from !== expectFrom) err(`${at}.from must be ${expectFrom} (phases are contiguous from week 1)`);
    const last = pi === a.weeks.length - 1;
    if (last) { if (ph.to !== null) err(`${at}.to must be null on the last phase (ongoing)`); }
    else if (!isInt(ph.to) || ph.to < ph.from) err(`${at}.to must be a whole week >= from`);
    else expectFrom = ph.to + 1;
    if (!isStr(ph.focus)) err(`${at}.focus is required`);
    if (!Array.isArray(ph.tracks) || !ph.tracks.length) { err(`${at}.tracks must be a non-empty list`); return; }
    ph.tracks.forEach((t, ti) => {
      const tat = `${at}.tracks[${ti}]`;
      if (!isStr(t.id)) err(`${tat}.id is required`);
      if (!isInt(t.sessionsPerWeek) || t.sessionsPerWeek < 1 || t.sessionsPerWeek > 7) err(`${tat}.sessionsPerWeek must be 1 to 7`);
      if (!PLACEMENTS.includes(t.placement)) err(`${tat}.placement must be one of ${PLACEMENTS.join(', ')}`);
      if (t.placement === 'daily' && t.sessionsPerWeek !== 7) err(`${tat}: placement daily means sessionsPerWeek 7`);
      if (!Array.isArray(t.sessions) || !t.sessions.length) { err(`${tat}.sessions must be a non-empty list`); return; }
      t.sessions.forEach((s, si) => {
        if (!Array.isArray(s) || !s.length) { err(`${tat}.sessions[${si}] must be a non-empty list of items`); return; }
        s.forEach((it, ii) => {
          const iat = `${tat}.sessions[${si}][${ii}]`;
          if (it && it.routine !== undefined) {
            if (!isStr(it.routine)) err(`${iat}.routine must be a routine id`);
            else if (refs && !refs.routines.has(it.routine)) err(`${iat}: unknown routine "${it.routine}"`);
          } else if (it && it.exercise !== undefined) {
            if (!isStr(it.exercise)) err(`${iat}.exercise must be a name`);
            else if (refs && !refs.exercises.has(it.exercise)) err(`${iat}: "${it.exercise}" is not a SEED_EXERCISES name`);
            if (!isInt(it.sets) || it.sets < 1) err(`${iat}.sets must be a whole number >= 1`);
            const hasReps = it.reps !== undefined, hasDur = it.duration !== undefined;
            if (hasReps === hasDur) err(`${iat}: give exactly one of reps or duration`);
            if (hasReps && !(isInt(it.reps) && it.reps > 0)) err(`${iat}.reps must be a positive whole number`);
            if (hasDur && !(isInt(it.duration) && it.duration > 0)) err(`${iat}.duration (seconds) must be a positive whole number`);
            if (it.requires !== undefined) {
              if (!Array.isArray(it.requires)) err(`${iat}.requires must be a list`);
              else if (refs) for (const r of it.requires) for (const alt of String(r).split('|')) if (!refs.equipment.has(alt)) err(`${iat}: unknown equipment id "${alt}"`);
            }
            for (const sub of it.substitutes || []) {
              if (!isStr(sub.name)) err(`${iat}: a substitute needs a name`);
              else if (refs && !refs.exercises.has(sub.name)) err(`${iat}: substitute "${sub.name}" is not a SEED_EXERCISES name`);
              if (refs) for (const r of sub.requires || []) for (const alt of String(r).split('|')) if (!refs.equipment.has(alt)) err(`${iat}: unknown equipment id "${alt}"`);
            }
          } else err(`${iat} must have "routine" or "exercise"`);
        });
      });
    });
  });
  return errs;
}

/** Read and structurally validate every content/addons/*.json. { addons, errors } - never throws. */
function loadCatalogue(dir = CONTENT_DIR) {
  const addons = [], errors = [];
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort(); } catch (e) { errors.push(`cannot read ${dir}: ${e.message}`); }
  for (const f of files) {
    let a;
    try { a = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { errors.push(`${f}: ${e.message}`); continue; }
    const errs = validateAddon(a);
    if (a && a.id && f !== `${a.id}.json`) errs.push(`${f}: file name must be <id>.json`);
    if (errs.length) errors.push(...errs); else addons.push(a);
  }
  const seen = new Set();
  for (const a of addons) { if (seen.has(a.id)) errors.push(`${a.id}: duplicate id`); seen.add(a.id); }
  return { addons, errors };
}

const LOADED = loadCatalogue();
if (LOADED.errors.length) console.error('addons: catalogue problems:', LOADED.errors.join('; '));
const CATALOGUE = LOADED.addons;
const getAddon = id => CATALOGUE.find(a => a.id === id) || null;

// ── phases ───────────────────────────────────────────────────────────────────

/** Whole weeks since startDate, plus one, as of `refDate`. Never below 1. */
function weekIndex(startDate, refDate) {
  const d = daysBetween(startDate, refDate);
  return d < 0 ? 1 : Math.floor(d / 7) + 1;
}

/** The phase a given week index falls in. */
function phaseFor(addon, idx) {
  return addon.weeks.find(p => idx >= p.from && (p.to === null || idx <= p.to)) || addon.weeks[addon.weeks.length - 1];
}
const phaseLabel = ph => (ph.to === null ? `Week ${ph.from}+` : ph.from === ph.to ? `Week ${ph.from}` : `Weeks ${ph.from}-${ph.to}`);

// ── placement (pure) ─────────────────────────────────────────────────────────

/** n evenly spread picks from a list of m candidates (n <= m, results are distinct and ordered). */
function spread(list, n) {
  const m = list.length;
  if (n >= m) return list.slice();
  const out = [];
  for (let i = 0; i < n; i++) out.push(list[Math.floor((i * m) / n + m / (2 * n))]);
  return out;
}

/** The detail text for an entry item: "3x8", "3x30 s" or "12 min". */
function detailOf(it) {
  if (it.kind === 'routine') return it.minutes ? `${it.minutes} min` : '';
  return it.duration != null ? `${it.sets}x${it.duration} s` : `${it.sets}x${it.reps}`;
}

let routineIndex = null;
function routineInfo(id) {
  if (!routineIndex) { try { routineIndex = new Map(require('./mobility').ROUTINES.map(r => [r.id, r])); } catch { routineIndex = new Map(); } }
  return routineIndex.get(id) || null;
}

function toEntryItem(raw) {
  if (raw.routine !== undefined) {
    const r = routineInfo(raw.routine);
    const it = { kind: 'routine', id: raw.routine, name: r ? r.name : raw.routine, minutes: r ? r.minutes : null };
    return { ...it, detail: detailOf(it) };
  }
  const it = { kind: 'exercise', name: raw.exercise, sets: raw.sets, reps: raw.reps != null ? raw.reps : null, duration: raw.duration != null ? raw.duration : null,
    note: raw.note || null, requires: raw.requires, substitutes: raw.substitutes };
  return { ...it, detail: detailOf(it) };
}

/** Halve the sets of every exercise (never below 1). Routines are left as they are. Returns a copy. */
function applyDeload(entry) {
  if (!entry || entry.deloaded || entry.deload !== 'follow') return entry;
  const items = entry.items.map(it => {
    if (it.kind !== 'exercise') return it;
    const sets = Math.max(1, Math.ceil((Number(it.sets) || 1) / 2));
    const out = { ...it, sets };
    return { ...out, detail: detailOf(out) };
  });
  return { ...entry, items, deloaded: true };
}

/** Fit a session's exercise items to the equipment in `have` (a Set of ids), using api/equipment.js. */
function fitSession(items, have) {
  if (!have) return { items, notes: [] };
  const E = require('./equipment');
  const exercises = items.filter(i => i.kind === 'exercise');
  const fit = E.fitExercises(exercises.map(i => ({ ...i, exerciseName: i.name })), have);
  const kept = new Map();
  for (const f of fit.exercises) kept.set(f.substitutedFor || f.exerciseName, f);
  const out = [];
  for (const it of items) {
    if (it.kind === 'routine') { out.push(it); continue; }
    const f = kept.get(it.name);
    if (!f) continue;                                   // left out: no gear and no substitute
    const { exerciseName, substitutedFor, prKey, ...rest } = f;
    const swapped = { ...rest, name: exerciseName };
    if (substitutedFor) swapped.substitutedFor = substitutedFor;
    out.push(swapped);
  }
  return { items: out, notes: E.describeFit(fit, 'this location') };
}

/**
 * Place every active add-on's sessions for one week. PURE.
 *   states: [{ addonId, startDate, reminder? }]  (active ones only)
 *   days:   [{ date, kind: 'train'|'rest'|'benchmarks', routines?: [id] }]  seven consecutive days
 *   opts:   { deload: bool, have: Set|null }
 * Returns { byDate: { date: [entry] }, summary: [{ addonId, title, phase, weekIndex, planned, dates }] }.
 *
 * Rules: sessions go on the days their track's placement allows, spread evenly; never more than one
 * session of the same add-on per day (tracks are placed in order and a taken day is gone); no session
 * before startDate; deload halves sets for 'follow' add-ons; a routine the plan already has that day
 * (day.routines) or another add-on already placed that day is merged, not repeated.
 */
function placeWeek(states, days, opts = {}) {
  const byDate = {};
  for (const d of days) byDate[d.date] = [];
  const summary = [];
  for (const st of states || []) {
    const addon = getAddon(st.addonId);
    if (!addon) continue;
    const ref = days[0].date > st.startDate ? days[0].date : st.startDate;
    const idx = weekIndex(st.startDate, ref);
    const phase = phaseFor(addon, idx);
    const used = new Set();
    const dates = [];
    for (const tr of phase.tracks) {
      const eligible = days.filter(d => d.date >= st.startDate && !used.has(d.date) && (
        tr.placement === 'training' ? d.kind === 'train' : tr.placement === 'rest' ? d.kind !== 'train' : true));
      const picks = spread(eligible.map(d => d.date), tr.sessionsPerWeek);
      picks.forEach((date, k) => {
        used.add(date);
        const raw = tr.sessions[k % tr.sessions.length];
        const day = days.find(d => d.date === date);
        let entry = {
          addonId: addon.id, title: addon.title, goalKind: addon.goalKind, date, track: tr.id,
          phase: { from: phase.from, to: phase.to, label: phaseLabel(phase) }, weekIndex: idx, focus: phase.focus,
          deload: addon.deload, deloaded: false, merged: [], notes: [],
          items: raw.map(toEntryItem),
        };
        // Merge: drop a routine the plan (or an earlier add-on) already has this day.
        const taken = new Set([...(day.routines || []), ...byDate[date].flatMap(e => e.items.filter(i => i.kind === 'routine').map(i => i.id))]);
        entry.items = entry.items.filter(i => {
          if (i.kind === 'routine' && taken.has(i.id)) { entry.merged.push(i.id); return false; }
          return true;
        });
        const fit = fitSession(entry.items, opts.have || null);
        entry.items = fit.items; entry.notes = fit.notes;
        if (opts.deload) entry = applyDeload(entry);
        byDate[date].push(entry);
        dates.push(date);
      });
    }
    summary.push({ addonId: addon.id, title: addon.title, phase: { from: phase.from, to: phase.to, label: phaseLabel(phase) }, weekIndex: idx,
      focus: phase.focus, planned: dates.length, dates: dates.sort() });
  }
  return { byDate, summary };
}

// ── week skeleton (training days, from the same source buildPlan uses) ───────

/** Seven days Mon..Sun for a week: { date, kind, routines }. Mirrors week-plan.buildPlan's training days. */
function weekSkeleton(weekStartDate) {
  const B = require('./benchmarks');
  const W = require('./week-plan');
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStartDate, i);
    const dow = (i + 1) % 7;
    const ti = B.TRAIN_DAYS.indexOf(dow);
    days.push({ date, kind: ti >= 0 ? 'train' : 'rest', routines: ti >= 0 ? W.routinesForTrainingDay(ti) : [] });
  }
  return days;
}

// ── state (GoalAddon table) ──────────────────────────────────────────────────

const doneKey = (addonId, date) => `addonDone:${addonId}:${date}`;
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const validTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));

async function listStates(db) {
  const rows = await db.GoalAddon.findAll({ order: [['id', 'ASC']] });
  return rows.map(r => r.toJSON());
}
const activeStates = async db => (await listStates(db)).filter(s => s.status === 'active' && getAddon(s.addonId));

function fail(status, message) { return Object.assign(new Error(message), { status }); }

/** A row for this add-on that is not finished (active or paused), or null. */
async function openRow(db, addonId) {
  return db.GoalAddon.findOne({ where: { addonId, status: ['active', 'paused'] } });
}

/**
 * Start an add-on today (ET). Idempotent: an active one is returned as is, a paused one is resumed.
 * Links to an active Goal of the same title when there is one, else creates a Goal of the right kind.
 */
async function startAddon(db, addonId, now = new Date()) {
  const addon = getAddon(addonId);
  if (!addon) throw fail(404, 'unknown add-on');
  const existing = await openRow(db, addonId);
  if (existing) {
    if (existing.status === 'paused') await existing.update({ status: 'active' });
    return existing.toJSON();
  }
  let goal = await db.Goal.findOne({ where: { title: addon.title, status: 'active' } });
  if (!goal) {
    goal = await db.Goal.create({
      type: 'exercise', targetValue: 1, title: addon.title, kind: addon.goalKind, status: 'active', completed: false,
      description: `Add-on: ${addon.summary}`, inBrief: true,
    });
  }
  const row = await db.GoalAddon.create({ addonId, status: 'active', startDate: todayET(now), goalId: goal.id, reminder: false });
  return row.toJSON();
}

async function setStatus(db, addonId, from, to) {
  if (!getAddon(addonId)) throw fail(404, 'unknown add-on');
  const row = await db.GoalAddon.findOne({ where: { addonId, status: from } });
  if (!row) throw fail(409, `that add-on is not ${from.join(' or ')}`);
  await row.update({ status: to });
  return row.toJSON();
}
const pauseAddon = (db, id) => setStatus(db, id, ['active'], 'paused');
const resumeAddon = (db, id) => setStatus(db, id, ['paused'], 'active');
const stopAddon = (db, id) => setStatus(db, id, ['active', 'paused'], 'done');

async function setReminder(db, addonId, on) {
  const row = await openRow(db, addonId);
  if (!row) throw fail(404, 'start the add-on first');
  await row.update({ reminder: !!on });
  return row.toJSON();
}

async function getRemindAt(db) {
  const r = await db.UserSetting.findByPk(REMIND_KEY);
  return r && validTime(r.value) ? r.value : null;
}
async function setRemindAt(db, time) {
  if (time === null || time === '' || time === undefined) { await db.UserSetting.destroy({ where: { key: REMIND_KEY } }); return null; }
  if (!validTime(time)) throw fail(400, 'time must be HH:MM (24 hour, ET)');
  await db.UserSetting.upsert({ key: REMIND_KEY, value: time });
  return time;
}

async function setSessionDone(db, addonId, done, date = todayET()) {
  if (!getAddon(addonId)) throw fail(404, 'unknown add-on');
  if (!validDate(date)) throw fail(400, 'date must be YYYY-MM-DD');
  if (date > todayET()) throw fail(400, 'cannot mark a future day done');
  if (done === false) await db.UserSetting.destroy({ where: { key: doneKey(addonId, date) } });
  else await db.UserSetting.upsert({ key: doneKey(addonId, date), value: new Date().toISOString() });
  return { addonId, date, done: done !== false };
}

async function doneSet(db, addonIds, dates) {
  const keys = addonIds.flatMap(id => dates.map(d => doneKey(id, d)));
  if (!keys.length) return new Set();
  const rows = await db.UserSetting.findAll({ where: { key: keys } });
  return new Set(rows.map(r => r.key));
}

// ── merge (database half) ────────────────────────────────────────────────────

async function gearHave(db) {
  try { const g = await require('./mobility').activeGear(db, null); return g ? g.have : null; } catch { return null; }
}

/**
 * Every active add-on's sessions for the week starting weekStartDate (a Monday, ET).
 * Returns { weekStart, days: { date: [entry + done] }, summary: [{ ..., done, remaining }] }.
 */
async function addonsForWeek(db, weekStartDate, opts = {}) {
  const states = await activeStates(db);
  const days = weekSkeleton(weekStartDate);
  const have = opts.have !== undefined ? opts.have : await gearHave(db);
  const { byDate, summary } = placeWeek(states, days, { deload: !!opts.deload, have });
  const dates = days.map(d => d.date);
  const done = await doneSet(db, states.map(s => s.addonId), dates);
  for (const date of dates) for (const e of byDate[date]) e.done = done.has(doneKey(e.addonId, date));
  for (const s of summary) {
    s.done = s.dates.filter(d => done.has(doneKey(s.addonId, d))).length;
    s.remaining = s.planned - s.done;
  }
  return { weekStart: weekStartDate, days: byDate, summary };
}

/** The add-on entries due on one ET date. */
async function addonsForDay(db, dateET = todayET(), opts = {}) {
  const B = require('./benchmarks');
  const week = await addonsForWeek(db, B.weekStart(dateET), opts);
  return { date: dateET, entries: week.days[dateET] || [], summary: week.summary };
}

// ── plan integration ─────────────────────────────────────────────────────────

/** Used by week-plan.buildPlan: attach a per-day `addons` section. Pure; returns { days, summary }. */
function attachToPlanDays(planDays, states, opts = {}) {
  if (!states || !states.length) return { days: planDays.map(d => ({ ...d, addons: [] })), summary: [] };
  const { byDate, summary } = placeWeek(states, planDays.map(d => ({ date: d.date, kind: d.kind === 'benchmarks' ? 'rest' : d.kind, routines: d.routines || [] })), opts);
  return { days: planDays.map(d => ({ ...d, addons: byDate[d.date] || [] })), summary };
}

// ── reminder payload for the service route ───────────────────────────────────

const TEXT_MAX = 900;
function entryDetails(e) {
  return e.items.map(i => ({ kind: i.kind, name: i.name, detail: i.detail || '' }));
}

/** The plain-text reminder: what is due and not done, within 900 characters. Empty when nothing is. */
function reminderText(items) {
  const open = items.filter(i => !i.sessionDone && i.entries.length);
  if (!open.length) return '';
  const lines = ['Add-ons for today:'];
  for (const i of open) {
    lines.push(`${i.title} (${i.phase})`);
    for (const e of i.entries) lines.push(`- ${e.name}${e.detail ? ' ' + e.detail : ''}`);
  }
  lines.push('Mark it done on the Add-ons page.');
  let text = lines.join('\n');
  if (text.length > TEXT_MAX) text = text.slice(0, TEXT_MAX - 3).trimEnd() + '...';
  return text;
}

/**
 * The body of GET /api/service/addons/today. See the contract in api/routes/service.js.
 */
async function todayPayload(db, username, now = new Date()) {
  const date = todayET(now);
  const [remindAt, states, day] = await Promise.all([getRemindAt(db), activeStates(db), addonsForDay(db, date)]);
  const wants = new Set(states.filter(s => s.reminder).map(s => s.addonId));
  const items = day.entries.filter(e => wants.has(e.addonId)).map(e => ({
    addonId: e.addonId, title: e.title, phase: e.phase.label, sessionDone: !!e.done, summary: e.focus, entries: entryDetails(e),
  }));
  return { user: username, date, remindAt, reminders: !!remindAt && wants.size > 0, items, text: reminderText(items) };
}

module.exports = {
  CONTENT_DIR, STATUSES, PLACEMENTS, REMIND_KEY, TEXT_MAX,
  validateAddon, loadCatalogue, CATALOGUE, getAddon,
  weekIndex, phaseFor, phaseLabel, spread, detailOf, applyDeload, placeWeek, weekSkeleton, attachToPlanDays,
  doneKey, validTime, listStates, activeStates, startAddon, pauseAddon, resumeAddon, stopAddon, setReminder,
  getRemindAt, setRemindAt, setSessionDone, addonsForWeek, addonsForDay, reminderText, todayPayload,
};
