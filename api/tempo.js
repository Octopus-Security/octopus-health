'use strict';

/**
 * tempo.js — saved phase protocols for the Timers page (strict pull-ups and
 * anything built the same way: named phases, a second count, a rep count).
 *
 * The builtin is not stored. Customs live in the signed-in user's own database
 * (UserSetting `tempo.protocols`), so a phone and a laptop see the same list.
 * There is no cross-user read: the route opens getDatabase(req.user.username).
 */

const crypto = require('crypto');

const SETTING_KEY = 'tempo.protocols';
const MAX_SAVED = 30;
const MAX_PHASES = 8;
const MAX_SECONDS = 180;
const MAX_REPS = 100;

const PULLUP_PHASES = Object.freeze([
  { label: 'Up', speak: 'up', seconds: 5 },
  { label: 'Top', speak: 'hold', seconds: 5 },
  { label: 'Down', speak: 'down', seconds: 5 },
  { label: 'Dead hang', speak: 'hang', seconds: 5 },
]);

const BUILTIN = Object.freeze({
  id: 'strict-pull-up',
  name: 'Strict pull-up',
  reps: 5,
  builtin: true,
  phases: PULLUP_PHASES,
});

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

function clampInt(n, lo, hi, fallback) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return fallback;
  return Math.min(hi, Math.max(lo, x));
}

function cleanText(s, max, fallback) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
  return t || fallback;
}

/** Drop a zero-second phase. If that leaves nothing, fall back to the pull-up phases. */
function normalize(raw) {
  const phasesIn = Array.isArray(raw && raw.phases) ? raw.phases.slice(0, MAX_PHASES) : [];
  let phases = phasesIn.map((p, i) => ({
    label: cleanText(p && p.label, 40, 'Phase ' + (i + 1)),
    speak: cleanText(p && (p.speak || p.label), 40, 'phase'),
    seconds: clampInt(p && p.seconds, 0, MAX_SECONDS, 5),
  })).filter(p => p.seconds > 0);
  if (!phases.length) phases = PULLUP_PHASES.map(p => ({ ...p }));
  return {
    id: cleanText(raw && raw.id, 40, ''),
    name: cleanText(raw && raw.name, 60, 'Custom'),
    reps: clampInt(raw && raw.reps, 1, MAX_REPS, 5),
    builtin: !!(raw && raw.builtin),
    phases,
  };
}

function cycleSeconds(protocol) {
  return normalize(protocol).phases.reduce((s, p) => s + p.seconds, 0);
}

/** One entry per phase of each rep, in order. `repStart` is the first phase of that rep. */
function steps(protocol) {
  const p = normalize(protocol);
  const out = [];
  for (let r = 1; r <= p.reps; r++) {
    p.phases.forEach((ph, i) => {
      out.push({
        rep: r, reps: p.reps, phase: i, phases: p.phases.length,
        label: ph.label, speak: ph.speak, seconds: ph.seconds,
        repStart: i === 0,
      });
    });
  }
  return out;
}

/** What the combo-caller voice says at the start of a step. */
function cue(step) {
  return step.repStart ? `rep ${step.rep}. ${step.speak}` : step.speak;
}

function newId() {
  return 'c' + crypto.randomBytes(6).toString('hex');
}

/**
 * Replace the saved list. Builtins are refused (they are not stored).
 * Same id updates; a repeated name replaces the older row.
 */
function prepareSave(list) {
  if (!Array.isArray(list)) throw fail(400, 'protocols must be a list');
  if (list.length > MAX_SAVED) throw fail(400, `at most ${MAX_SAVED} saved protocols`);
  const out = [];
  for (const raw of list) {
    const n = normalize(raw);
    if (n.builtin || n.id === BUILTIN.id) throw fail(400, 'the built-in protocol is not saved');
    const nameKey = n.name.toLowerCase();
    const dup = out.findIndex(p => (n.id && p.id === n.id) || p.name.toLowerCase() === nameKey);
    if (dup >= 0) {
      n.id = out[dup].id;
      out.splice(dup, 1);
    }
    if (!n.id) n.id = newId();
    n.builtin = false;
    out.push(n);
  }
  return out;
}

async function list(db) {
  const row = await db.UserSetting.findByPk(SETTING_KEY);
  if (!row || row.value == null) return [];
  try {
    const parsed = JSON.parse(row.value);
    if (!Array.isArray(parsed)) return [];
    return prepareSave(parsed.filter(p => p && p.id !== BUILTIN.id && !p.builtin).slice(0, MAX_SAVED));
  } catch {
    return [];
  }
}

async function save(db, protocols) {
  const clean = prepareSave(protocols);
  await db.UserSetting.upsert({ key: SETTING_KEY, value: JSON.stringify(clean) });
  return clean;
}

module.exports = {
  SETTING_KEY, MAX_SAVED, BUILTIN, PULLUP_PHASES,
  normalize, cycleSeconds, steps, cue, prepareSave, list, save,
};
