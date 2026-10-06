'use strict';

/**
 * fitness-store.js — the database half of skills, tests and benchmarks.
 *
 * Every function takes `db`, the object database.js's getDatabase(username)
 * returns. There is NO way to name another user here: the caller opened the
 * database for the authenticated account (web: req.user.username; service API:
 * the X-Service-User header, validated), and each account is its own SQLite
 * file. So "someone else's row" is not filtered - it does not exist in this
 * file - and a lookup by id answers 404 exactly like an id that was never
 * issued, which is the estate rule (a 403 would confirm the id exists).
 *
 * Errors carry .status (400 bad input, 404 not found, 409 ambiguous) and the
 * routes pass it straight through.
 */

const T = require('./skill-tree');
const F = require('./fitness-tests');
const B = require('./benchmarks');
const W = require('./week-plan');

const fail = (status, message, extra) => Object.assign(new Error(message), { status }, extra || {});

// ── settings ─────────────────────────────────────────────────────────────────

async function getSetting(db, key, fallback = null) {
  const row = await db.UserSetting.findByPk(key);
  if (!row || row.value == null) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}
async function setSetting(db, key, value) {
  await db.UserSetting.upsert({ key, value: JSON.stringify(value) });
  return value;
}

async function benchmarkDayOf(db) { return getSetting(db, 'benchmark_day', B.DEFAULT_BENCHMARK_DAY); }

/** The stored reminder document, defaults filled in, `day` still possibly null. */
async function getRawReminder(db) {
  return { ...B.defaultReminder(), ...(await getSetting(db, 'benchmark_reminder', {})) };
}

/** What the user sees and the check uses: `day` resolved to their benchmark day when they set none. */
async function getReminder(db) {
  const raw = await getRawReminder(db);
  return { ...raw, day: raw.day ?? await benchmarkDayOf(db) };
}

/** Today's date in the user's own time zone (the reminder's tz setting). */
async function todayFor(db, now = new Date()) {
  const r = await getReminder(db);
  return B.localParts(now, r.tz).date;
}

function checkDate(d, now = new Date()) {
  if (d == null || d === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d)) || Number.isNaN(Date.parse(`${d}T00:00:00Z`)) || new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) !== d) {
    throw fail(400, `date must be YYYY-MM-DD, got "${d}"`);
  }
  if (Date.parse(`${d}T00:00:00Z`) > now.getTime() + 2 * 86400000) throw fail(400, 'date is in the future');
  return String(d);
}

const numberOrNull = (v, name, max = 100000) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw fail(400, `${name} must be a number between 0 and ${max}`);
  return n;
};

// ── equipment ────────────────────────────────────────────────────────────────

async function getEquipment(db) {
  const stored = await getSetting(db, 'equipment', null);
  return { stored, effective: [...T.effectiveEquipment(stored)], isDefault: stored === null };
}

/** action: set | add | remove | reset */
async function changeEquipment(db, action, list) {
  const cur = (await getSetting(db, 'equipment', null)) || [...T.DEFAULT_EQUIPMENT];
  const tokens = action === 'reset' ? [] : T.normalizeEquipment(list);
  let next;
  if (action === 'set') next = tokens;
  else if (action === 'add') next = [...new Set([...cur, ...tokens])];
  else if (action === 'remove') next = cur.filter(x => !tokens.includes(x));
  else if (action === 'reset') { await db.UserSetting.destroy({ where: { key: 'equipment' } }); return getEquipment(db); }
  else throw fail(400, 'action must be set, add, remove or reset');
  await setSetting(db, 'equipment', next);
  return getEquipment(db);
}

// ── skills ───────────────────────────────────────────────────────────────────

async function skillState(db, equipmentOverride) {
  const tree = T.loadTree();
  const attempts = (await db.SkillAttempt.findAll({ order: [['date', 'ASC'], ['id', 'ASC']] })).map(a => a.toJSON());
  const st = T.statusMap(tree, attempts);
  const eq = equipmentOverride ? new Set(['none', ...T.normalizeEquipment(equipmentOverride)]) : T.effectiveEquipment((await getEquipment(db)).stored);
  return { tree, attempts, st, have: eq };
}

function resolveSkill(tree, query) {
  const r = T.findSkill(tree, query);
  if (!r) throw fail(404, `No skill matches "${query}".`);
  if (r.candidates) throw fail(409, `"${query}" matches several skills: ${r.candidates.map(s => s.name).join('; ')}. Which one?`, { candidates: r.candidates.map(s => ({ id: s.id, name: s.name })) });
  if (r.line) throw fail(409, `"${query}" is a whole line, not one skill. Ask for its progression, or name a step.`, { line: r.line });
  return r.skill;
}

const RESULTS = { succeeded: 'succeeded', success: 'succeeded', yes: 'succeeded', achieved: 'succeeded', done: 'succeeded', passed: 'succeeded', not_yet: 'not_yet', 'not yet': 'not_yet', failed: 'not_yet', fail: 'not_yet', no: 'not_yet' };

async function logAttempt(db, { skill, result, reps, seconds, notes, date }, now = new Date()) {
  const { tree, st: before, have } = await skillState(db);
  const s = resolveSkill(tree, skill);
  const res = RESULTS[String(result || '').trim().toLowerCase()];
  if (!res) throw fail(400, 'result must be "succeeded" or "not_yet"');
  const row = await db.SkillAttempt.create({
    skillId: s.id, date: checkDate(date, now) || await todayFor(db, now), result: res,
    reps: numberOrNull(reps, 'reps'), seconds: numberOrNull(seconds, 'seconds', 36000),
    notes: notes ? String(notes).slice(0, 1000) : null,
  });
  const { st: after } = await skillState(db);
  const wasAchieved = before.get(s.id).status === 'achieved';
  const out = { ok: true, attempt: row.toJSON(), skill: T.describeSkill(tree, after, have, s), newlyAchieved: res === 'succeeded' && !wasAchieved, newlyUnlocked: [] };
  if (out.newlyAchieved) {
    out.newlyUnlocked = (tree.children.get(s.id) || []).map(id => tree.byId.get(id))
      .filter(c => before.get(c.id).status === 'locked' && after.get(c.id).status === 'unlocked')
      .map(c => T.describeSkill(tree, after, have, c));
    out.skippedPrerequisites = T.ancestorsInOrder(tree, s.id).slice(0, -1).filter(id => !after.get(id).achievedAt).map(id => tree.byId.get(id).name);
    const c = s.criterion;
    const target = c.hold || c.reps;
    const got = c.hold ? numberOrNull(seconds, 'seconds') : numberOrNull(reps, 'reps');
    if (got != null && got < target) out.criterionNote = `Marked achieved on your word, but the standard is ${T.formatCriterion(c)} and you logged ${got}.`;
  }
  return out;
}

async function deleteAttempt(db, id) {
  const row = /^\d+$/.test(String(id)) ? await db.SkillAttempt.findByPk(Number(id)) : null;
  if (!row) throw fail(404, 'Not found');
  await row.destroy();
  return { ok: true };
}

async function listAttempts(db, { skill, limit = 50 } = {}) {
  const where = {};
  if (skill) where.skillId = resolveSkill(T.loadTree(), skill).id;
  const rows = await db.SkillAttempt.findAll({ where, order: [['date', 'DESC'], ['id', 'DESC']], limit: Math.min(Number(limit) || 50, 200) });
  return rows.map(r => r.toJSON());
}

// ── fitness results ──────────────────────────────────────────────────────────

async function itemInfoFor(db, query) {
  const cat = F.findItem(query);
  if (cat) return { id: cat.id, name: cat.name, unit: cat.unit, better: cat.better, battery: cat.battery, kind: cat.kind, cat };
  const b = await findBenchmarkRow(db, query, { quiet: true });
  if (b) return { id: b.item, name: b.name, unit: b.unit, better: b.better, battery: 'benchmark', kind: 'custom', cat: null };
  return null;
}

async function logResult(db, { item, value, date, notes, detail }, now = new Date()) {
  const info = await itemInfoFor(db, item);
  if (!info) throw fail(404, `Unknown test item "${item}". Use one from the test list or a benchmark you added.`);
  let v = typeof value === 'string' && info.kind === 'time' ? F.parseTime(value) : Number(value);
  if (!Number.isFinite(v) || v < 0 || v > 1e7) throw fail(400, 'value must be a non-negative number');
  const row = await db.FitnessResult.create({
    item: info.id, battery: info.battery, value: v, unit: info.unit || null,
    date: checkDate(date, now) || await todayFor(db, now),
    detail: detail ? JSON.stringify(detail).slice(0, 4000) : null,
    notes: notes ? String(notes).slice(0, 1000) : null,
  });
  return { ok: true, result: row.toJSON(), item: info.id, name: info.name, trend: await trendFor(db, info.id, info.better) };
}

async function resultsFor(db, item) {
  return (await db.FitnessResult.findAll({ where: { item }, order: [['date', 'ASC'], ['id', 'ASC']] })).map(r => r.toJSON());
}

async function trendFor(db, item, better) {
  return F.trend(await resultsFor(db, item), better);
}

async function deleteResult(db, id) {
  const row = /^\d+$/.test(String(id)) ? await db.FitnessResult.findByPk(Number(id)) : null;
  if (!row) throw fail(404, 'Not found');
  await row.destroy();
  return { ok: true };
}

/** Trend for every item the user has any result for, newest activity first. */
async function allTrends(db, { battery } = {}) {
  const rows = (await db.FitnessResult.findAll({ order: [['date', 'ASC'], ['id', 'ASC']] })).map(r => r.toJSON());
  const by = new Map();
  for (const r of rows) { if (!by.has(r.item)) by.set(r.item, []); by.get(r.item).push(r); }
  const benches = new Map((await db.Benchmark.findAll()).map(b => [b.item, b]));
  const out = [];
  for (const [item, rs] of by) {
    const cat = F.getItem(item), b = benches.get(item);
    if (battery && (cat ? cat.battery : 'benchmark') !== battery) continue;
    out.push({ item, name: cat ? cat.name : (b ? b.name : item), unit: cat ? cat.unit : (b ? b.unit : null), better: cat ? cat.better : (b ? b.better : 'higher'), battery: cat ? cat.battery : 'benchmark', ...F.trend(rs, cat ? cat.better : (b ? b.better : 'higher')) });
  }
  return out.sort((a, b) => String(b.latest.date).localeCompare(String(a.latest.date)));
}

// ── benchmarks ───────────────────────────────────────────────────────────────

/**
 * Create each default once. The seed log (BenchmarkSeeds) is what makes
 * deletion stick and edits survive: a default already in the log is skipped
 * whether or not its row still exists, and an existing row is never rewritten.
 */
async function seedBenchmarks(db) {
  const seen = new Set((await db.BenchmarkSeed.findAll()).map(r => r.seedKey));
  let pos = (await db.Benchmark.max('position')) ?? -1;
  for (const d of B.DEFAULT_BENCHMARKS) {
    if (seen.has(d.seedKey)) continue;
    const cat = F.getItem(d.item);
    const exists = await db.Benchmark.findOne({ where: { item: d.item } });
    if (!exists) {
      await db.Benchmark.create({ item: d.item, name: cat.name, short: cat.short, unit: cat.unit, better: cat.better, focus: d.focus, everyWeeks: d.everyWeeks, position: ++pos, seedKey: d.seedKey });
    }
    await db.BenchmarkSeed.upsert({ seedKey: d.seedKey });
  }
  // First use of benchmarks also creates the reminder config (default ON; the
  // bot offers off/time changes). No row = never touched = never reminded.
  if (!(await db.UserSetting.findByPk('benchmark_reminder'))) await setSetting(db, 'benchmark_reminder', B.defaultReminder());
}

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function findBenchmarkRow(db, query, { quiet = false } = {}) {
  // An all-digit query is an ID and only ever an id: loose name matching would
  // let "6" find "Squats in 60 s", and an id that is not this account's must be
  // a plain 404, never a near miss.
  if (/^\d+$/.test(String(query).trim())) {
    const row = await db.Benchmark.findByPk(Number(query));
    if (row) return row;
    if (quiet) return null;
    throw fail(404, 'Not found');
  }
  const all = await db.Benchmark.findAll();
  const q = norm(query);
  if (!q) { if (quiet) return null; throw fail(400, 'which benchmark?'); }
  const exact = all.filter(b => String(b.id) === String(query).trim() || b.item === String(query).trim().toLowerCase() || norm(b.short) === q || norm(b.name) === q);
  if (exact.length === 1) return exact[0];
  const loose = exact.length ? exact : all.filter(b => norm(b.name).includes(q) || norm(b.short).includes(q) || q.includes(norm(b.short)));
  if (loose.length === 1) return loose[0];
  if (quiet) return null;
  if (!loose.length) throw fail(404, `No benchmark matches "${query}".`);
  throw fail(409, `"${query}" matches several benchmarks: ${loose.map(b => b.name).join('; ')}. Which one?`);
}

async function lastByItem(db) {
  const [rows] = await db.sequelize.query('select item, max(date) as d from FitnessResults group by item');
  return Object.fromEntries(rows.map(r => [r.item, r.d]));
}

async function listBenchmarks(db, now = new Date()) {
  await seedBenchmarks(db);
  const rem = await getReminder(db);
  const focus = await getSetting(db, 'focus', 'balanced');
  const benchmarkDay = await benchmarkDayOf(db);
  const rows = (await db.Benchmark.findAll({ order: [['position', 'ASC'], ['id', 'ASC']] })).map(b => b.toJSON());
  const last = await lastByItem(db);
  const date = B.localParts(now, rem.tz).date;
  const due = new Set(B.dueThisWeek(rows, last, date, benchmarkDay).map(b => b.item));
  const out = [];
  for (const b of rows) {
    out.push({ ...b, day: b.dayOfWeek ?? benchmarkDay, dayName: B.DAY_NAMES[b.dayOfWeek ?? benchmarkDay], dueThisWeek: due.has(b.item), lastDate: last[b.item] || null, trend: await trendFor(db, b.item, b.better) });
  }
  // Focus-first ordering is a VIEW, not an edit: stored positions are the user's.
  const ranked = focus === 'balanced' ? out : [...out].sort((a, b) => (b.focus === focus) - (a.focus === focus) || a.position - b.position);
  return { benchmarks: ranked, focus, benchmarkDay, today: date };
}

async function renumber(db) {
  const rows = await db.Benchmark.findAll({ order: [['position', 'ASC'], ['id', 'ASC']] });
  for (let i = 0; i < rows.length; i++) if (rows[i].position !== i) await rows[i].update({ position: i });
}

function cleanBenchmarkFields(f, { forCreate = false } = {}) {
  const out = {};
  if (f.name !== undefined) { const n = String(f.name).trim(); if (!n || n.length > 80) throw fail(400, 'name must be 1-80 characters'); out.name = n; }
  if (f.short !== undefined) { const n = String(f.short).trim().slice(0, 40); if (n) out.short = n; }
  if (f.unit !== undefined) out.unit = String(f.unit).trim().slice(0, 16) || null;
  if (f.better !== undefined) { if (!['higher', 'lower'].includes(f.better)) throw fail(400, 'better must be higher or lower'); out.better = f.better; }
  if (f.focus !== undefined) { if (!B.FOCUSES.includes(f.focus)) throw fail(400, `focus must be one of ${B.FOCUSES.join(', ')}`); out.focus = f.focus; }
  if (f.everyWeeks !== undefined) { const n = Number(f.everyWeeks); if (!Number.isInteger(n) || n < 1 || n > 12) throw fail(400, 'everyWeeks must be a whole number from 1 to 12'); out.everyWeeks = n; }
  if (f.dayOfWeek !== undefined) {
    if (f.dayOfWeek === null || f.dayOfWeek === 'default' || f.dayOfWeek === '') out.dayOfWeek = null;
    else { const d = B.parseDay(f.dayOfWeek); if (d === null) throw fail(400, 'day must be a weekday name or 0-6'); out.dayOfWeek = d; }
  }
  if (f.enabled !== undefined) out.enabled = !!f.enabled;
  return out;
}

async function addBenchmark(db, f) {
  await seedBenchmarks(db);
  const cat = f.item ? (F.findItem(f.item) || null) : (f.name ? F.findItem(f.name) : null);
  let item, base;
  if (cat) { item = cat.id; base = { name: cat.name, short: cat.short, unit: cat.unit, better: cat.better, focus: null }; }
  else {
    if (!f.name) throw fail(400, 'name is required for a custom benchmark');
    item = `custom_${slug(f.name)}`;
    if (!slug(f.name)) throw fail(400, 'name needs letters or digits');
    base = { name: String(f.name).trim(), short: slug(f.name), unit: 'reps', better: 'higher', focus: null };
  }
  const fields = cleanBenchmarkFields(f);
  const existing = await db.Benchmark.findOne({ where: { item } });
  if (existing) { await existing.update({ ...fields, enabled: true }); return { ok: true, benchmark: existing.toJSON(), existed: true }; }
  const pos = ((await db.Benchmark.max('position')) ?? -1) + 1;
  const row = await db.Benchmark.create({ item, ...base, ...fields, position: pos, enabled: true });
  return { ok: true, benchmark: row.toJSON(), existed: false };
}

async function updateBenchmark(db, query, f) {
  const row = await findBenchmarkRow(db, query);
  await row.update(cleanBenchmarkFields(f));
  return { ok: true, benchmark: row.toJSON() };
}

async function removeBenchmark(db, query) {
  const row = await findBenchmarkRow(db, query);
  const snap = row.toJSON();
  await row.destroy();           // the seed log keeps a default from coming back
  await renumber(db);
  return { ok: true, removed: snap };
}

/** to: 1-based position, or direction 'up'|'down'. Renumbers so positions stay 0..n-1. */
async function moveBenchmark(db, query, { to, direction }) {
  const row = await findBenchmarkRow(db, query);
  const rows = await db.Benchmark.findAll({ order: [['position', 'ASC'], ['id', 'ASC']] });
  const ids = rows.map(r => r.id);
  const i = ids.indexOf(row.id);
  let j;
  if (direction === 'up') j = Math.max(0, i - 1);
  else if (direction === 'down') j = Math.min(ids.length - 1, i + 1);
  else { const n = Number(to); if (!Number.isInteger(n) || n < 1) throw fail(400, 'position must be a whole number from 1'); j = Math.min(ids.length, n) - 1; }
  ids.splice(i, 1); ids.splice(j, 0, row.id);
  for (let k = 0; k < ids.length; k++) await db.Benchmark.update({ position: k }, { where: { id: ids[k] } });
  return { ok: true, order: (await db.Benchmark.findAll({ order: [['position', 'ASC']] })).map(b => b.name) };
}

async function setFocus(db, focus) {
  if (!B.FOCUSES.includes(focus)) throw fail(400, `focus must be one of ${B.FOCUSES.join(', ')}`);
  await setSetting(db, 'focus', focus);
  return { ok: true, focus };
}

async function logBenchmark(db, { benchmark, value, date, notes }, now = new Date()) {
  await seedBenchmarks(db);
  const row = await findBenchmarkRow(db, benchmark);
  return logResult(db, { item: row.item, value, date, notes }, now);
}

async function setBenchmarkDay(db, day) {
  const d = B.parseDay(day);
  if (d === null) throw fail(400, 'day must be a weekday name or 0-6');
  await setSetting(db, 'benchmark_day', d);
  return { ok: true, day: d, dayName: B.DAY_NAMES[d] };
}

// ── reminder ─────────────────────────────────────────────────────────────────

async function updateReminder(db, f) {
  await seedBenchmarks(db);
  const next = { ...(await getRawReminder(db)) };
  if (f.enabled !== undefined) next.enabled = !!f.enabled;
  if (f.day === null || f.day === 'follow') next.day = null;
  else if (f.day !== undefined) { const d = B.parseDay(f.day); if (d === null) throw fail(400, 'day must be a weekday name or 0-6'); next.day = d; }
  if (f.time !== undefined) { const t = B.parseTimeOfDay(f.time); if (!t) throw fail(400, 'time must look like 18:30 or 6:30pm'); next.time = t; }
  if (f.tz !== undefined) { if (!B.validTz(f.tz)) throw fail(400, `unknown time zone "${f.tz}" (use e.g. Europe/London)`); next.tz = f.tz; }
  await setSetting(db, 'benchmark_reminder', next);
  const shown = await getReminder(db);
  return { ok: true, reminder: shown, dayName: B.DAY_NAMES[shown.day] };
}

/** Decide what, if anything, to DM now. Pure read: nothing is recorded until ack. */
async function reminderCheck(db, now = new Date()) {
  const raw = await getSetting(db, 'benchmark_reminder', null);
  if (!raw) return { action: 'none', reason: 'never used' };
  const benchmarks = (await db.Benchmark.findAll({ order: [['position', 'ASC']] })).map(b => b.toJSON());
  return B.reminderCheck({ config: await getReminder(db), benchmarks, lastByItem: await lastByItem(db), now });
}

async function reminderAck(db, { kind, date, items }) {
  if (!['send', 'nudge'].includes(kind)) throw fail(400, 'kind must be send or nudge');
  const cur = await getRawReminder(db);
  await setSetting(db, 'benchmark_reminder', B.reminderAck(cur, kind, String(date), items));
  return { ok: true };
}

// ── plan ─────────────────────────────────────────────────────────────────────

async function weekPlan(db, now = new Date(), { equipment } = {}) {
  await seedBenchmarks(db);
  const rem = await getReminder(db);
  const s = await skillState(db, equipment);
  const rows = (await db.Benchmark.findAll({ order: [['position', 'ASC']] })).map(b => b.toJSON());
  return W.buildPlan({
    tree: s.tree, st: s.st, have: s.have, focus: await getSetting(db, 'focus', 'balanced'),
    benchmarks: rows, lastByItem: await lastByItem(db), date: B.localParts(now, rem.tz).date, benchmarkDay: await benchmarkDayOf(db),
  });
}

module.exports = {
  getSetting, setSetting, getReminder, todayFor, checkDate,
  getEquipment, changeEquipment, skillState, resolveSkill,
  logAttempt, deleteAttempt, listAttempts,
  logResult, deleteResult, resultsFor, trendFor, allTrends, itemInfoFor,
  seedBenchmarks, listBenchmarks, addBenchmark, updateBenchmark, removeBenchmark, moveBenchmark, setFocus, logBenchmark, setBenchmarkDay, findBenchmarkRow,
  updateReminder, reminderCheck, reminderAck, weekPlan,
};
