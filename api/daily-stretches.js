'use strict';

/**
 * daily-stretches.js - the stretches a person does every day, and the JSON that
 * edits and reads them.
 *
 * ── Data model ──────────────────────────────────────────────────────────────
 * Reuses ExercisePlan; no new table and no new column. Each account has at most
 * one plan of its own, "My Daily Stretches" (type 'stretch'), and a UserSetting
 * row `dailyStretchPlanId` says which plan that is. Both live in the account's
 * own sqlite file, so nothing here can reach another account.
 *
 *   setting unset       -> the daily list is the seeded "Daily Starter Stretch",
 *                          READ-ONLY. Nothing has been chosen, so nothing is stored.
 *   first edit / preset -> the effective list is COPIED into "My Daily Stretches"
 *                          and the setting is written. The seeded plan is never
 *                          edited, so it can still be loaded as a preset.
 *   setting -> deleted  -> back to the default, not an error.
 *
 * Seeding never touches the setting or the plan it points at, so re-seeding
 * cannot overwrite a choice. Presets are ordinary seeded ExercisePlans of type
 * 'stretch'; loading one copies its items, so editing the list never edits it.
 *
 * Items are stored in the plan's existing shape: { exerciseId, name, sets,
 * reps:null, duration, notes } where `duration` is the hold in seconds and `sets`
 * is the number of holds (2 = once each side, 1 = a single hold). The API calls
 * those holdSeconds and sides.
 *
 *   GET  /stretch/api/daily                      list + presets
 *   POST /stretch/api/daily/add      { exerciseId }
 *   POST /stretch/api/daily/remove   { exerciseId | name }
 *   POST /stretch/api/daily/move     { exerciseId | name, direction: 'up'|'down' }
 *   POST /stretch/api/daily/update   { exerciseId | name, holdSeconds?, sides? }
 *   POST /stretch/api/daily/preset   { presetId, mode: 'replace'|'add' }
 * and, for cortex, GET /api/service/stretches/daily (api/routes/service.js).
 */

const M = require('../lib/muscles');

const SETTING_KEY = 'dailyStretchPlanId';
const DEFAULT_NAME = 'Daily Starter Stretch (10 min)';
const MY_NAME = 'My Daily Stretches';
const MIN_HOLD = 5;
const MAX_HOLD = 600;
const DEFAULT_HOLD = 30;

// ── Pure helpers ─────────────────────────────────────────────────────────────

const keyOf = (x) => String(x && x.name || '').trim().toLowerCase();

function clampHold(v, fallback = DEFAULT_HOLD) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(MAX_HOLD, Math.max(MIN_HOLD, n));
}

const sidesOf = (sets) => (Number(sets) >= 2 ? 2 : 1);

/** A stored plan item -> the API shape. Tolerates anything a hand-edited plan holds. */
function fromStored(raw) {
  raw = raw || {};
  return {
    exerciseId: Number.isInteger(raw.exerciseId) ? raw.exerciseId : null,
    name: String(raw.name || '').trim(),
    holdSeconds: clampHold(raw.duration),
    sides: sidesOf(raw.sets),
    notes: raw.notes || null,
  };
}

/** The API shape -> what the plan stores. Always a fresh object (never aliases a preset's). */
function toStored(it) {
  return {
    exerciseId: it.exerciseId ?? null, name: it.name,
    sets: it.sides === 2 ? 2 : 1, reps: null, duration: it.holdSeconds,
    notes: it.notes || null,
  };
}

function parseItems(text) {
  try { const a = JSON.parse(text || '[]'); return Array.isArray(a) ? a.map(fromStored).filter(i => i.name) : []; }
  catch { return []; }
}

/** Minutes of holding, one decimal. Changeovers are not counted. */
function totalMinutes(items) {
  const secs = items.reduce((t, i) => t + i.holdSeconds * i.sides, 0);
  return Math.round(secs / 6) / 10;
}

function shortInstructions(text, max = 140) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return stop > 60 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, '') + '...';
}

// ── Store (operates on one account's getDatabase() result) ───────────────────

async function ownPlan(db) {
  const row = await db.UserSetting.findByPk(SETTING_KEY);
  const id = row && Number(row.value);
  if (!Number.isInteger(id)) return null;
  const plan = await db.ExercisePlan.findByPk(id);
  return plan && plan.type === 'stretch' ? plan : null;
}

/** The list in force: { plan (own, or null), isDefault, name, items }. */
async function loadDaily(db) {
  const own = await ownPlan(db);
  if (own) return { plan: own, isDefault: false, name: own.name, items: parseItems(own.items) };
  const starter = await db.ExercisePlan.findOne({ where: { name: DEFAULT_NAME } });
  return {
    plan: null, isDefault: true,
    name: starter ? starter.name : 'Daily stretches',
    items: starter ? parseItems(starter.items) : [],
  };
}

// One writer at a time per account: two quick taps must not both "materialise" a
// list, which would leave an orphaned second plan.
const queues = new Map();
function serialised(username, fn) {
  const prev = queues.get(username) || Promise.resolve();
  const run = prev.then(fn);
  const tail = run.then(() => {}, () => {});
  queues.set(username, tail);
  tail.then(() => { if (queues.get(username) === tail) queues.delete(username); });
  return run;
}

async function materialise(db) {
  const cur = await loadDaily(db);
  if (cur.plan) return cur.plan;
  let name = MY_NAME, n = 1;
  while (await db.ExercisePlan.findOne({ where: { name } })) name = `${MY_NAME} (${++n})`;
  const plan = await db.ExercisePlan.create({
    name, type: 'stretch',
    description: 'The stretches I do every day. Managed from the Stretch page.',
    items: JSON.stringify(cur.items.map(toStored)),
  });
  await db.UserSetting.upsert({ key: SETTING_KEY, value: String(plan.id) });
  return plan;
}

async function saveItems(db, plan, items) {
  await plan.update({ items: JSON.stringify(items.map(toStored)) });
}

const err = (status, message) => Object.assign(new Error(message), { status });

function find(items, ref) {
  const id = ref && ref.exerciseId != null ? Number(ref.exerciseId) : null;
  const key = ref && ref.name ? String(ref.name).trim().toLowerCase() : null;
  return items.findIndex(i => (id != null && i.exerciseId === id) || (key && keyOf(i) === key));
}

async function mutate(db, username, fn) {
  return serialised(username, async () => {
    const cur = await loadDaily(db);
    const items = cur.items.slice();
    const result = await fn(items);
    if (result === false) return { daily: await view(db), changed: false };
    const plan = await materialise(db);
    await saveItems(db, plan, items);
    return { daily: await view(db), changed: true, ...(result && typeof result === 'object' ? result : {}) };
  });
}

async function addStretch(db, username, exerciseId) {
  const def = Number.isInteger(Number(exerciseId)) ? await db.ExerciseDefinition.findByPk(Number(exerciseId)) : null;
  if (!def) throw err(404, 'unknown exercise');
  if (!M.isStretch(def)) throw err(400, 'only stretches can be daily stretches');
  return mutate(db, username, (items) => {
    if (find(items, { exerciseId: def.id, name: def.name }) >= 0) return false; // already there: idempotent
    items.push({
      exerciseId: def.id, name: def.name,
      holdSeconds: clampHold(def.defaultDuration), sides: def.defaultSets === 2 ? 2 : 1, notes: null,
    });
  });
}

async function removeStretch(db, username, ref) {
  return mutate(db, username, (items) => {
    const i = find(items, ref);
    if (i < 0) return false;
    items.splice(i, 1);
  });
}

async function moveStretch(db, username, ref, direction) {
  if (direction !== 'up' && direction !== 'down') throw err(400, "direction must be 'up' or 'down'");
  return mutate(db, username, (items) => {
    const i = find(items, ref);
    if (i < 0) throw err(404, 'not in your daily stretches');
    const j = direction === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= items.length) return false;
    [items[i], items[j]] = [items[j], items[i]];
  });
}

async function updateStretch(db, username, ref, patch) {
  const p = patch || {};
  if (p.holdSeconds === undefined && p.sides === undefined) throw err(400, 'give holdSeconds and/or sides');
  if (p.sides !== undefined && ![1, 2].includes(Number(p.sides))) throw err(400, 'sides must be 1 or 2');
  if (p.holdSeconds !== undefined && !(Number(p.holdSeconds) >= MIN_HOLD && Number(p.holdSeconds) <= MAX_HOLD)) {
    throw err(400, `holdSeconds must be ${MIN_HOLD} to ${MAX_HOLD}`);
  }
  return mutate(db, username, (items) => {
    const i = find(items, ref);
    if (i < 0) throw err(404, 'not in your daily stretches');
    if (p.holdSeconds !== undefined) items[i].holdSeconds = clampHold(p.holdSeconds);
    if (p.sides !== undefined) items[i].sides = Number(p.sides);
  });
}

/** Plans a person can load from: every stretch plan except their own daily one. */
async function listPresets(db) {
  const own = await ownPlan(db);
  const rows = await db.ExercisePlan.findAll({ where: { type: 'stretch' }, order: [['name', 'ASC']] });
  return rows.filter(r => !own || r.id !== own.id).map(r => {
    const items = parseItems(r.items);
    return { id: r.id, name: r.name, description: r.description || '', itemCount: items.length, totalMinutes: totalMinutes(items) };
  });
}

async function loadPreset(db, username, presetId, mode) {
  if (mode !== 'replace' && mode !== 'add') throw err(400, "mode must be 'replace' or 'add'");
  const own = await ownPlan(db);
  const preset = Number.isInteger(Number(presetId)) ? await db.ExercisePlan.findByPk(Number(presetId)) : null;
  if (!preset || preset.type !== 'stretch' || (own && own.id === preset.id)) throw err(404, 'unknown preset');
  const incoming = parseItems(preset.items); // fresh objects: later edits cannot reach the preset
  return mutate(db, username, (items) => {
    if (mode === 'replace') {
      items.splice(0, items.length, ...incoming);
      return { added: incoming.length, skipped: 0 };
    }
    const have = new Set(items.map(keyOf));
    let added = 0, skipped = 0;
    for (const it of incoming) {
      if (have.has(keyOf(it))) { skipped++; continue; }
      have.add(keyOf(it)); items.push(it); added++;
    }
    return { added, skipped };
  });
}

/** The shape the browser gets. */
async function view(db) {
  const d = await loadDaily(db);
  return { name: d.name, isDefault: d.isDefault, totalMinutes: totalMinutes(d.items), items: d.items };
}

/**
 * The shape cortex gets. Instructions are looked up now (by id, else name) and
 * shortened, so a plan item stays small and a renamed instruction still arrives.
 */
async function serviceView(db, baseUrl) {
  const d = await loadDaily(db);
  const defs = await db.ExerciseDefinition.findAll({ attributes: ['id', 'name', 'instructions'] });
  const byId = new Map(defs.map(e => [e.id, e])), byName = new Map(defs.map(e => [e.name, e]));
  const items = d.items.map(i => {
    const def = (i.exerciseId != null && byId.get(i.exerciseId)) || byName.get(i.name);
    return {
      name: i.name, holdSeconds: i.holdSeconds, sides: i.sides, sets: i.sides,
      instructions: shortInstructions(def && def.instructions),
    };
  });
  return {
    name: d.name, totalMinutes: totalMinutes(d.items), items,
    url: `${baseUrl || process.env.HEALTH_PUBLIC_URL || 'https://health.octopustechnology.net'}/stretch`,
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

function mount(app, { requireLogin, getDatabase }) {
  const handler = (fn) => async (req, res) => {
    try {
      const db = getDatabase(req.user.username);
      await db.sequelize.sync();
      res.json({ success: true, ...(await fn(db, req.user.username, req.body || {}, req)) });
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error('daily-stretches:', e.message);
      res.status(status).json({ success: false, error: status === 500 ? 'failed' : e.message });
    }
  };

  app.get('/stretch/api/daily', requireLogin, handler(async (db) => ({
    daily: await view(db), presets: await listPresets(db),
  })));
  app.post('/stretch/api/daily/add', requireLogin, handler((db, u, b) => addStretch(db, u, b.exerciseId)));
  app.post('/stretch/api/daily/remove', requireLogin, handler((db, u, b) => removeStretch(db, u, b)));
  app.post('/stretch/api/daily/move', requireLogin, handler((db, u, b) => moveStretch(db, u, b, b.direction)));
  app.post('/stretch/api/daily/update', requireLogin, handler((db, u, b) => updateStretch(db, u, b, b)));
  app.post('/stretch/api/daily/preset', requireLogin, handler(async (db, u, b) => {
    const r = await loadPreset(db, u, b.presetId, b.mode);
    return { ...r, presets: await listPresets(db) };
  }));
}

module.exports = mount;
Object.assign(module.exports, {
  SETTING_KEY, DEFAULT_NAME, MY_NAME,
  ownPlan, loadDaily, view, serviceView, listPresets, loadPreset,
  addStretch, removeStretch, moveStretch, updateStretch,
  totalMinutes, shortInstructions, fromStored, toStored,
});
