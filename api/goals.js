'use strict';

/**
 * Goals: the ONE definition of "active", and the one place a write is normalised.
 *
 * Before this, "active" meant three different things: the service GET (not completed),
 * the dashboard (not completed) and cortex (re-filtered it client-side). A goal is now
 * active when its status is 'active' AND it is not past its deadline (ET date). The
 * Discord morning brief additionally needs `inBrief`. Cortex asks for ?active=1&brief=1
 * and displays what comes back; it does not decide again.
 *
 * `completed` is kept for old readers and always equals (status === 'done').
 * Health is a database per user, so none of this takes an owner: the Goal model you
 * hold is already the right person's.
 */

const { Op } = require('sequelize');

const STATUSES = ['active', 'paused', 'done'];
const KINDS = ['strength', 'skill', 'mobility', 'body_comp', 'nutrition', 'habit', 'other'];
const TYPES = ['weight', 'exercise', 'calories'];

/** ET is the only clock; offsetDays shifts it (1 = tomorrow's date). */
function etDay(offsetDays = 0, now = new Date()) {
  return new Date(now.getTime() + offsetDays * 86400000)
    .toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/** Sort: priority ascending (null last), then oldest first. Stable and total. */
function byPriority(a, b) {
  const pa = a.priority == null ? Infinity : a.priority;
  const pb = b.priority == null ? Infinity : b.priority;
  if (pa !== pb) return pa < pb ? -1 : 1;
  const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (ca !== cb) return ca - cb;
  return (a.id || 0) - (b.id || 0);
}

/**
 * Active goals, in order. `day` is the ET date to judge deadlines against (default
 * today); `brief` narrows to the ones the Discord brief includes.
 */
async function listActive(Goal, { brief = false, day = etDay() } = {}) {
  const where = { status: 'active', [Op.or]: [{ deadline: null }, { deadline: { [Op.gte]: day } }] };
  if (brief) where.inBrief = true;
  const rows = await Goal.findAll({ where });
  return rows.sort(byPriority);
}

/** Every goal, for the full list: active, paused, done in that order, each by priority. */
async function listAll(Goal) {
  const rank = { active: 0, paused: 1, done: 2 };
  const rows = await Goal.findAll();
  return rows.sort((a, b) => (rank[a.status] - rank[b.status]) || byPriority(a, b));
}

const truthy = v => v === true || v === 1 || v === '1' || v === 'true' || v === 'on';
const num = v => (v === null || v === '' ? null : parseFloat(v));

/**
 * A request body (JSON or an HTML form) -> the fields to set. Only keys that are PRESENT
 * are returned, so a PATCH never wipes what it did not mention. Invalid enum values throw
 * a {status:400} error instead of being stored. `existing` is the current row (for
 * keeping status and completed in step), or null on create.
 */
function fromBody(b, existing = null, { form = false } = {}) {
  const out = {};
  const bad = m => { const e = new Error(m); e.status = 400; throw e; };
  const has = k => b[k] !== undefined;
  for (const f of ['title', 'exerciseName', 'unit', 'progression', 'description']) {
    if (has(f)) out[f] = b[f] === '' ? null : b[f];
  }
  if (has('deadline')) out.deadline = b.deadline || null;
  if (has('type')) { if (!TYPES.includes(b.type)) bad(`type must be one of ${TYPES.join(', ')}`); out.type = b.type; }
  if (has('targetValue')) { const n = num(b.targetValue); out.targetValue = Number.isFinite(n) ? n : 0; }
  if (has('currentValue')) { const n = num(b.currentValue); if (n !== null && !Number.isFinite(n)) bad('currentValue must be a number'); out.currentValue = n; }
  if (has('kind')) {
    if (b.kind === null || b.kind === '') out.kind = null;
    else if (KINDS.includes(b.kind)) out.kind = b.kind;
    else bad(`kind must be one of ${KINDS.join(', ')}`);
  }
  if (has('priority')) {
    const n = num(b.priority);
    if (n !== null && !Number.isInteger(n)) bad('priority must be a whole number');
    out.priority = n;
  }
  // An HTML form omits an unticked checkbox, so with {form:true} absent means false.
  for (const f of ['inBrief', 'nudge']) {
    if (form) out[f] = truthy(b[f]); else if (has(f)) out[f] = truthy(b[f]);
  }

  // status <-> completed. An explicit status wins; else `completed` maps onto it.
  let status = existing ? existing.status : 'active';
  if (has('status')) {
    if (!STATUSES.includes(b.status)) bad(`status must be one of ${STATUSES.join(', ')}`);
    status = b.status;
  } else if (has('completed')) {
    if (truthy(b.completed)) status = 'done';
    else if (status === 'done') status = 'active';
  }
  if (has('status') || has('completed') || !existing) {
    out.status = status;
    out.completed = status === 'done';
  }
  return out;
}

/**
 * Set priorities 1..n in the order given. Ids that do not exist in this user's database
 * are ignored (an id from another account simply is not there). Returns the ids applied.
 */
async function reorder(Goal, ids) {
  if (!Array.isArray(ids) || ids.some(i => !Number.isInteger(Number(i)))) {
    const e = new Error('ids must be an array of goal ids'); e.status = 400; throw e;
  }
  const clean = [...new Set(ids.map(Number))];
  const rows = await Goal.findAll({ where: { id: { [Op.in]: clean } } });
  const byId = new Map(rows.map(r => [r.id, r]));
  const applied = [];
  let p = 1;
  for (const id of clean) {
    const r = byId.get(id);
    if (!r) continue;
    if (r.priority !== p) { r.priority = p; await r.save(); }
    applied.push(id);
    p++;
  }
  return applied;
}

module.exports = { STATUSES, KINDS, TYPES, etDay, byPriority, listActive, listAll, fromBody, reorder };
