'use strict';

/**
 * equipment.js — the ONE equipment vocabulary (content/equipment/catalogue.json)
 * and the pure rules that use it. No database in here, so every rule is unit
 * testable; gyms-store.js is the storage half.
 *
 * Who reads this list: the skill tree (api/skill-tree.js derives its tokens from
 * it), the gyms page, plan fitting below, cortex (GET /api/service/equipment) and
 * octopus-mma (a drift-tested snapshot of the ids). A new piece of equipment goes
 * in the JSON and nowhere else.
 *
 * Three ideas:
 *   - an id is stable forever; names and aliases change freely;
 *   - `provides` — owning a power tower IS owning a pull-up bar, dip bars, handles;
 *   - an exercise declares what it needs ("a|b" = either); a location only gets
 *     the exercises its equipment allows, with a reported substitute or omission.
 */

const fs = require('fs');
const path = require('path');

const CATALOGUE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'equipment', 'catalogue.json'), 'utf8'));
const ITEMS = CATALOGUE.items;
const IDS = ITEMS.map(i => i.id);
const BY_ID = new Map(ITEMS.map(i => [i.id, i]));

const squash = s => String(s == null ? '' : s).toLowerCase().replace(/[_]+/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').replace(/'/g, '').replace(/\s+/g, ' ').trim();

// squashed alias / id / name -> id. Exact names beat aliases when they collide.
const LOOKUP = new Map();
for (const it of ITEMS) for (const k of [...(it.aliases || []), it.name]) { const q = squash(k); if (q && !LOOKUP.has(q)) LOOKUP.set(q, it.id); }
for (const it of ITEMS) { LOOKUP.set(squash(it.id), it.id); }

/** Free text or an id -> canonical id, or null. Tolerates a leading article and a plural 's'. */
function toId(raw) {
  let k = squash(raw).replace(/^(a|an|the|my)\s+/, '');
  if (!k || k === 'none') return null;
  return LOOKUP.get(k) || LOOKUP.get(k.replace(/s$/, '')) || LOOKUP.get(k + 's') || null;
}

/** An id plus everything owning it also gives you, transitively. */
function expand(ids) {
  const out = new Set();
  const add = id => { if (!id || out.has(id)) return; out.add(id); for (const p of (BY_ID.get(id)?.provides || [])) add(p); };
  for (const id of ids || []) add(id);
  return out;
}

const RULES = CATALOGUE.exerciseRules.map(r => ({ ...r, re: new RegExp(r.match, 'i') }));

/** Do the owned ids satisfy every requirement ("a|b" = either)? Returns the unmet ones. */
function unmet(requires, have) {
  return (requires || []).filter(req => !String(req).split('|').some(a => have.has(a)));
}

/**
 * What an exercise needs. Order of authority: the exercise's own `requires`
 * (a template can state it), then a catalogue rule by name, then the library's
 * legacy `equipment` string, then nothing (bodyweight).
 */
function requirementsFor(ex, legacy) {
  const name = String(ex.exerciseName || ex.name || '');
  if (Array.isArray(ex.requires)) return { requires: ex.requires, substitutes: ex.substitutes || [] };
  const rule = RULES.find(r => r.re.test(name));
  if (rule) return { requires: rule.requires || [], substitutes: rule.substitutes || [] };
  const tok = legacy ? CATALOGUE.legacyExerciseTokens[String(legacy).toLowerCase()] : null;
  return { requires: tok ? [tok] : [], substitutes: [] };
}

/**
 * Fit a template's exercises to the equipment a location has.
 * @param exercises  template exercise objects ({exerciseName, sets, reps, ...})
 * @param ownedIds   ids the location lists (expanded here)
 * @param legacyByName  optional Map(lowercase name -> library equipment string)
 * @returns {{exercises, substitutions:[{from,to}], omitted:[{name, missing}]}}
 *   Never throws; an unknown shape is passed through untouched.
 */
function fitExercises(exercises, ownedIds, legacyByName) {
  const have = expand(ownedIds);
  const list = Array.isArray(exercises) ? exercises : [];
  const names = new Set(list.map(e => String(e.exerciseName || e.name || '').toLowerCase()));
  const out = [], substitutions = [], omitted = [];
  for (const ex of list) {
    const name = String(ex.exerciseName || ex.name || '');
    const { requires, substitutes } = requirementsFor(ex, legacyByName && legacyByName.get(name.toLowerCase()));
    const missing = unmet(requires, have);
    if (!missing.length) { out.push(ex); continue; }
    const sub = substitutes.find(s => !names.has(String(s.name).toLowerCase()) && unmet(s.requires, have).length === 0);
    if (sub) {
      names.add(String(sub.name).toLowerCase());
      // Keep sets/reps/notes of the original: the slot is the same, the tool differs.
      const key = ex.exerciseName !== undefined ? 'exerciseName' : 'name';
      out.push({ ...ex, [key]: sub.name, prKey: undefined, substitutedFor: name });
      substitutions.push({ from: name, to: sub.name });
    } else {
      omitted.push({ name, missing: missing.map(m => m.split('|').map(a => BY_ID.get(a)?.name || a).join(' or ')) });
    }
  }
  return { exercises: out, substitutions, omitted };
}

/** One readable line per change, for a chat message or a web banner. */
function describeFit(fit, gymName) {
  const lines = [];
  for (const s of fit.substitutions) lines.push(`${s.from} swapped for ${s.to} (${gymName} lacks what the original needs)`);
  for (const o of fit.omitted) lines.push(`${o.name} left out (${gymName} has no ${o.missing.join(', ')})`);
  return lines;
}

// ── pause / resume (dates are ET YYYY-MM-DD strings; they compare as strings) ──

/** Active today? A paused gym with a resume date on or before today is active again. */
function isActive(gym, today) {
  if (gym.active !== false) return true;
  return !!(gym.pausedUntil && gym.pausedUntil <= today);
}

/**
 * Where does a day that wanted `requested` actually happen?
 * Fallback order is Home, Park, then the work gym last (a day with no shift
 * should not silently become a gym day). Nothing active -> location null.
 */
function resolveLocation(gyms, requested, today) {
  const active = new Set(gyms.filter(g => isActive(g, today)).map(g => g.slug));
  const want = requested || 'home';
  if (active.has(want)) return { location: want, requested: want, substituted: false, note: null };
  const fallback = ['home', 'park', 'gym'].find(s => s !== want && active.has(s)) || [...active].find(s => s !== want) || null;
  const g = gyms.find(x => x.slug === want);
  const name = g ? g.name : want;
  const resume = g && g.pausedUntil ? ` until ${g.pausedUntil}` : '';
  if (!fallback) {
    return { location: null, requested: want, substituted: false, allPaused: true,
      note: `Every location is paused, so there is no plan to suggest. Resume one on the Gyms page (or tell Neith "resume ${name}").` };
  }
  const fbName = (gyms.find(x => x.slug === fallback) || {}).name || fallback;
  return { location: fallback, requested: want, substituted: true, note: `${name} is paused${resume}, so this is the ${fbName} version.` };
}

module.exports = {
  CATALOGUE, ITEMS, IDS, toId, expand, requirementsFor, fitExercises, describeFit, isActive, resolveLocation, unmet,
};
