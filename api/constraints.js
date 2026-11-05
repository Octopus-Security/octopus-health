'use strict';

/**
 * Workout constraints: ongoing limits (an injury, a trip, a missing bit of kit) that
 * every suggested workout must honour until they are cleared.
 *
 * Health OWNS these. Before, cortex kept a single one in its own settings table and
 * the adapted plan existed only as chat text; the web had no way to see or change it.
 * Health is a database per user, so none of this takes an owner: the model you hold is
 * already the right person's. No model is called anywhere in here.
 *
 * A constraint is ACTIVE while `active` is true and its `until` (an ET date) has not
 * passed. Expiry is computed on read and never written, so a GET changes nothing and an
 * expired row stays as history. "Clear" sets active=false and keeps the row.
 */

const { todayET } = require('../lib/et');

const TEXT_MAX = 500;
const EQUIP_MAX = 300;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const bad = m => Object.assign(new Error(m), { status: 400 });

function validDate(d) {
  return DATE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
}

/**
 * Body -> fields. `full` (create, and the web edit form) takes the three fields as given,
 * so an absent equipment/until means none; a partial update (service PATCH) only touches
 * what is present. Throws {status:400}.
 */
function fromBody(b, { full = true, today = todayET() } = {}) {
  b = b || {};
  const out = {};
  const has = k => b[k] !== undefined;
  if (full || has('text')) {
    const t = String(b.text == null ? '' : b.text).trim();
    if (!t) throw bad('text is required: say what is limited, for example "left shoulder strain, no overhead pressing"');
    if (t.length > TEXT_MAX) throw bad(`text is too long (max ${TEXT_MAX} characters)`);
    out.text = t;
  }
  if (full || has('equipment')) {
    const e = b.equipment == null ? '' : String(b.equipment).trim();
    if (e.length > EQUIP_MAX) throw bad(`equipment is too long (max ${EQUIP_MAX} characters)`);
    out.equipment = e || null;
  }
  if (full || has('until')) {
    const u = b.until == null ? '' : String(b.until).trim();
    if (u) {
      if (!validDate(u)) throw bad('until must be a date, YYYY-MM-DD');
      if (u < today) throw bad('until is already in the past');
      out.until = u;
    } else out.until = null;
  }
  return out;
}

function view(r, today = todayET()) {
  const expired = !!(r.until && r.until < today);
  return {
    id: r.id, text: r.text, equipment: r.equipment || null, until: r.until || null,
    active: !!r.active && !expired, cleared: !r.active, expired: !!r.active && expired,
    source: r.source || null, setAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
  };
}

async function list(db, { all = false, today = todayET() } = {}) {
  const rows = await db.WorkoutConstraint.findAll({ order: [['createdAt', 'DESC'], ['id', 'DESC']] });
  const v = rows.map(r => view(r, today));
  return all ? v : v.filter(c => c.active);
}

async function create(db, body, { source = 'web', today = todayET() } = {}) {
  const f = fromBody(body, { full: true, today });
  const row = await db.WorkoutConstraint.create({ ...f, active: true, source });
  return view(row, today);
}

async function find(db, id) {
  const n = Number(id);
  const r = Number.isInteger(n) ? await db.WorkoutConstraint.findByPk(n) : null;
  if (!r) throw Object.assign(new Error('No such constraint'), { status: 404 });
  return r;
}

async function update(db, id, body, { full = false, today = todayET() } = {}) {
  const r = await find(db, id);
  const f = fromBody(body, { full, today });
  // Editing a cleared or expired one brings it back only if the caller says so.
  if (body && body.active === true) { f.active = true; f.clearedAt = null; }
  await r.update(f);
  return view(r, today);
}

async function clear(db, id, today = todayET()) {
  const r = await find(db, id);
  if (r.active) await r.update({ active: false, clearedAt: new Date() });
  return view(r, today);
}

async function clearAll(db) {
  const [n] = await db.WorkoutConstraint.update({ active: false, clearedAt: new Date() }, { where: { active: true } });
  return n;
}

/**
 * One-time copy of a constraint cortex already held. Idempotent: a row with the same
 * text, equipment and until (in any state, including cleared) means it was imported
 * already and nothing is written. An `until` already past is kept, as an expired row,
 * so nothing cortex held is lost; it simply is not active.
 */
async function importOne(db, body, today = todayET()) {
  const b = body || {};
  const text = String(b.text == null ? '' : b.text).trim();
  if (!text) throw bad('text is required');
  if (text.length > TEXT_MAX) throw bad(`text is too long (max ${TEXT_MAX} characters)`);
  const equipment = b.equipment ? String(b.equipment).trim().slice(0, EQUIP_MAX) || null : null;
  const until = b.until ? String(b.until).trim() : null;
  if (until && !validDate(until)) throw bad('until must be a date, YYYY-MM-DD');
  const existing = await db.WorkoutConstraint.findOne({ where: { text, equipment, until } });
  if (existing) return { imported: false, constraint: view(existing, today) };
  const row = await db.WorkoutConstraint.create({ text, equipment, until, active: b.active === false ? false : true, source: 'cortex-import' });
  return { imported: true, constraint: view(row, today) };
}

module.exports = { TEXT_MAX, EQUIP_MAX, fromBody, view, list, create, update, clear, clearAll, importOne, validDate };
