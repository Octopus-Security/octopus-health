'use strict';

/**
 * gyms-store.js — gyms, their equipment, pausing, and plan fitting, over the
 * per-user database. Shared by the web page (web-gyms.js) and the service API
 * (routes/gyms-service.js) so the two cannot disagree. Dates are ET strings.
 */

const E = require('./equipment');

const todayET = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });

const seeded = new WeakSet();
/** Create the shipped gyms the first time an account is seen. Additive: a gym that
 *  exists (even renamed, even emptied) is never touched again. */
async function ensureSeeded(db) {
  if (seeded.has(db.Gym)) return;
  for (const g of E.CATALOGUE.gyms) {
    const [row, created] = await db.Gym.findOrCreate({ where: { slug: g.slug }, defaults: { slug: g.slug, name: g.name, notes: g.notes || null, sortOrder: g.sortOrder || 0 } });
    if (created) {
      for (const eq of g.equipment) await db.GymEquipment.create({ gymId: row.id, equipmentId: eq.id, label: eq.label || null, attrs: eq.attrs ? JSON.stringify(eq.attrs) : null });
    }
  }
  seeded.add(db.Gym);
}

function view(g, eqRows, today) {
  const active = E.isActive(g, today);
  const equipment = eqRows.filter(r => r.gymId === g.id).map(r => {
    const item = E.ITEMS.find(i => i.id === r.equipmentId);
    let attrs = null; try { attrs = r.attrs ? JSON.parse(r.attrs) : null; } catch { attrs = null; }
    return { id: r.equipmentId, name: item ? item.name : r.equipmentId, label: r.label || null, attrs, known: !!item };
  });
  return {
    slug: g.slug, name: g.name, notes: g.notes || null, sortOrder: g.sortOrder,
    active, paused: !active, pausedUntil: g.pausedUntil || null,
    equipment, effective: [...E.expand(equipment.map(e => e.id))],
  };
}

async function listGyms(db, today = todayET()) {
  await ensureSeeded(db);
  const gyms = await db.Gym.findAll({ order: [['sortOrder', 'ASC'], ['id', 'ASC']] });
  const eq = await db.GymEquipment.findAll();
  return gyms.map(g => view(g, eq, today));
}

async function rawGym(db, slug) {
  await ensureSeeded(db);
  const g = await db.Gym.findOne({ where: { slug: String(slug || '').toLowerCase() } });
  if (!g) throw bad(`No gym "${slug}".`, 404);
  return g;
}

async function getGym(db, slug, today = todayET()) {
  const g = await rawGym(db, slug);
  return view(g, await db.GymEquipment.findAll({ where: { gymId: g.id } }), today);
}

/** Pause / resume / rename / notes. `until` is an ET date, or null for "until I resume it". */
async function updateGym(db, slug, patch = {}, today = todayET()) {
  const g = await rawGym(db, slug);
  const set = {};
  if (patch.name != null) { const n = String(patch.name).trim().slice(0, 60); if (!n) throw bad('name cannot be empty'); set.name = n; }
  if (patch.notes !== undefined) set.notes = patch.notes ? String(patch.notes).slice(0, 500) : null;
  if (patch.active !== undefined) {
    set.active = !!patch.active;
    if (set.active) set.pausedUntil = null;
  }
  if (patch.pausedUntil !== undefined && patch.active !== true) {
    if (patch.pausedUntil === null || patch.pausedUntil === '') set.pausedUntil = null;
    else {
      if (!DATE.test(String(patch.pausedUntil))) throw bad('resume date must be YYYY-MM-DD');
      set.pausedUntil = String(patch.pausedUntil);
    }
  }
  await g.update(set);
  return getGym(db, slug, today);
}

const pauseGym = (db, slug, until, today) => updateGym(db, slug, { active: false, pausedUntil: until || null }, today);
const resumeGym = (db, slug, today) => updateGym(db, slug, { active: true }, today);

async function addEquipment(db, slug, input, today = todayET()) {
  const g = await rawGym(db, slug);
  const id = E.toId(input && (input.equipment || input.id || input.name));
  if (!id) throw bad(`Unknown equipment "${input && (input.equipment || input.id || input.name)}". Known: ${E.IDS.join(', ')}.`);
  const exists = await db.GymEquipment.findOne({ where: { gymId: g.id, equipmentId: id } });
  const label = input.label ? String(input.label).slice(0, 80) : null;
  if (!exists) await db.GymEquipment.create({ gymId: g.id, equipmentId: id, label, attrs: input.attrs && typeof input.attrs === 'object' ? JSON.stringify(input.attrs) : null });
  else if (label) await exists.update({ label });
  return getGym(db, slug, today);
}

async function removeEquipment(db, slug, equipment, today = todayET()) {
  const g = await rawGym(db, slug);
  const id = E.toId(equipment);
  if (!id) throw bad(`Unknown equipment "${equipment}".`);
  await db.GymEquipment.destroy({ where: { gymId: g.id, equipmentId: id } });
  return getGym(db, slug, today);
}

/** Which gym does this requested location become today? (pause + fallback) */
async function resolve(db, requested, today = todayET()) {
  const gyms = await listGyms(db, today);
  // listGyms already folded the resume date into `active`, so isActive() sees plain booleans here.
  return { ...E.resolveLocation(gyms, requested, today), gyms };
}

/**
 * The day's template for a location, fitted to that location's equipment.
 * Template choice: gym -> "<day>:gym" else "<day>:home"; park -> a template whose own
 * location is park, else "<day>:park", else "<day>:home"; home -> "<day>:home".
 * `location` omitted = the day's own default (the home template's declared location).
 * Never mutates stored templates; a failure to fit returns the template as stored.
 */
async function planFor(db, { day, location, now = new Date() } = {}) {
  const today = todayET(now);
  const dayKey = DAYS.includes(day) ? day : DAYS[new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay()];
  const rows = await db.WorkoutTemplate.findAll({ where: {}, order: [['name', 'ASC']] });
  const meta = t => { try { return JSON.parse(t.description || '{}') || {}; } catch { return {}; } };
  const forDay = rows.filter(t => String(t.name).startsWith(dayKey + ':'));
  const homeT = forDay.find(t => t.name === `${dayKey}:home`);
  const requested = (location && String(location).toLowerCase()) || (homeT && meta(homeT).location) || 'home';
  const res = await resolve(db, requested, today);
  const base = { ok: true, day: dayKey, requested, today, pausedNote: res.note };
  if (!res.location) return { ...base, location: null, allPaused: true, template: null, fit: null };

  const loc = res.location;
  const pick = loc === 'gym' ? [`${dayKey}:gym`, `${dayKey}:home`]
    : loc === 'park' ? [forDay.find(t => meta(t).location === 'park')?.name, `${dayKey}:park`, `${dayKey}:home`]
    : [`${dayKey}:home`];
  const tpl = pick.map(n => n && forDay.find(t => t.name === n)).find(Boolean);
  if (!tpl) return { ...base, location: loc, template: null, fit: null, substituted: res.substituted };

  const m = meta(tpl);
  let exercises = []; try { exercises = JSON.parse(tpl.exercises || '[]'); } catch { exercises = []; }
  const gym = res.gyms.find(g => g.slug === loc);
  const defs = await db.ExerciseDefinition.findAll({ attributes: ['name', 'equipment'] });
  const legacy = new Map(defs.map(d => [String(d.name).toLowerCase(), d.equipment]));
  const fit = E.fitExercises(exercises, gym.equipment.map(e => e.id), legacy);
  return {
    ...base, location: loc, substituted: res.substituted, gym: { slug: gym.slug, name: gym.name },
    template: { id: tpl.id, slug: tpl.name, label: m.label || tpl.name, type: tpl.type, location: loc, warmup: m.warmup, cooldown: m.cooldown, exercises: fit.exercises, isCustom: tpl.isCustom },
    fit: { substitutions: fit.substitutions, omitted: fit.omitted, notes: E.describeFit(fit, gym.name) },
  };
}

module.exports = { todayET, ensureSeeded, listGyms, getGym, updateGym, pauseGym, resumeGym, addEquipment, removeEquipment, resolve, planFor, DAYS };
