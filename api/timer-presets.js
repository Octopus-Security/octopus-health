'use strict';

/**
 * timer-presets.js — saved setups for the Timers page, other than tempo.
 *
 * Tempo protocols stay in api/tempo.js. Round, interval, EMOM, AMRAP and the
 * combo caller share one UserSetting (`timer.presets`) in the signed-in user's
 * own database. The route opens getDatabase(req.user.username), so one account
 * never reads another's row.
 *
 * The Timers page copies these limits when it decides two setups are the same.
 */

const crypto = require('crypto');

const SETTING_KEY = 'timer.presets';
const MAX_SAVED = 30;
const KINDS = ['round', 'interval', 'emom', 'amrap', 'combo'];
const STRIKES = ['1', '2', '3', '4', '5', '6', 'E', 'K', 'N'];
const DEFAULT_STRIKES = ['1', '2', '3', '4', '5', '6'];

const FIELDS = {
  round: [
    ['rounds', 1, 99, 5],
    ['workMin', 0, 60, 3],
    ['workSec', 0, 59, 0],
    ['restMin', 0, 60, 1],
    ['restSec', 0, 59, 0],
    ['countdown', 0, 30, 10],
  ],
  interval: [
    ['rounds', 1, 99, 8],
    ['work', 1, 3600, 20],
    ['rest', 0, 3600, 10],
  ],
  emom: [
    ['minutes', 1, 60, 10],
    ['work', 1, 59, 40],
  ],
  amrap: [
    ['minutes', 1, 120, 10],
    ['seconds', 0, 59, 0],
  ],
  combo: [
    ['min', 1, 6, 2],
    ['max', 1, 8, 4],
    ['delay', 1, 15, 3],
    ['rounds', 1, 20, 5],
    ['roundMin', 1, 10, 3],
    ['rest', 0, 180, 60],
  ],
};

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

function clampInt(n, lo, hi, fallback) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return fallback;
  return Math.min(hi, Math.max(lo, x));
}

function blank() {
  return { round: [], interval: [], emom: [], amrap: [], combo: [] };
}

function newId() {
  return 'c' + crypto.randomBytes(6).toString('hex');
}

function cleanStrikes(raw) {
  const have = new Set(Array.isArray(raw) ? raw.map(s => String(s)) : []);
  const out = STRIKES.filter(s => have.has(s));
  return out.length ? out : DEFAULT_STRIKES.slice();
}

/** One stored setup. A zero-length round becomes one second so the clock can run. */
function normalizeOne(kind, raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const [key, lo, hi, fallback] of FIELDS[kind]) out[key] = clampInt(src[key], lo, hi, fallback);
  if (kind === 'round' && out.workMin === 0 && out.workSec === 0) out.workSec = 1;
  if (kind === 'combo') {
    if (out.max < out.min) out.max = out.min;
    out.strikes = cleanStrikes(src.strikes);
  }
  const id = typeof src.id === 'string' && /^c[0-9a-f]{12}$/.test(src.id) ? src.id : '';
  out.id = id;
  return out;
}

function signature(kind, preset) {
  const n = normalizeOne(kind, preset);
  const id = n.id;
  delete n.id;
  const sig = JSON.stringify(n);
  n.id = id;
  return sig;
}

function prepareKind(kind, list) {
  if (!FIELDS[kind]) throw fail(400, 'unknown timer');
  if (!Array.isArray(list)) throw fail(400, 'presets must be a list');
  if (list.length > MAX_SAVED) throw fail(400, `at most ${MAX_SAVED} saved timers`);
  const out = [];
  const seen = new Set();
  const ids = new Set();
  for (const raw of list) {
    const n = normalizeOne(kind, raw);
    const sig = signature(kind, n);
    if (seen.has(sig)) continue;
    seen.add(sig);
    if (!n.id || ids.has(n.id)) n.id = newId();
    ids.add(n.id);
    out.push(n);
  }
  return out;
}

async function readAll(db) {
  const all = blank();
  const row = await db.UserSetting.findByPk(SETTING_KEY);
  if (!row || row.value == null) return all;
  try {
    const parsed = JSON.parse(row.value);
    if (!parsed || typeof parsed !== 'object') return all;
    for (const kind of KINDS) {
      if (Array.isArray(parsed[kind])) all[kind] = prepareKind(kind, parsed[kind].slice(0, MAX_SAVED));
    }
    return all;
  } catch {
    return blank();
  }
}

async function list(db) {
  return readAll(db);
}

async function save(db, kind, presets) {
  if (!FIELDS[kind]) throw fail(400, 'unknown timer');
  const all = await readAll(db);
  all[kind] = prepareKind(kind, presets);
  await db.UserSetting.upsert({ key: SETTING_KEY, value: JSON.stringify(all) });
  return all[kind];
}

module.exports = {
  SETTING_KEY, MAX_SAVED, KINDS, FIELDS, STRIKES,
  normalizeOne, signature, prepareKind, list, save,
};
