'use strict';

// One shared file for "please add this exercise to the catalogue".
// Workout logs stay in each account's own database. A submission is the
// exercise the person chose to offer: name, muscles, pose, instructions.
// Nothing in here is joined to a per-user file.

const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const cache = new Map();
let approvedCache = { at: 0, rows: [] };

function getCatalogueDatabase() {
  const storage = path.join(require('../lib/dataDir')(), 'catalogue-review.sqlite');
  if (cache.has(storage)) return cache.get(storage);

  const sequelize = new Sequelize({ dialect: 'sqlite', storage, logging: false });
  const Submission = sequelize.define('CatalogueSubmission', {
    owner: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    nameKey: { type: DataTypes.STRING, allowNull: false },
    payload: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
    note: { type: DataTypes.TEXT, allowNull: true },
    decidedBy: { type: DataTypes.STRING, allowNull: true },
  }, {
    tableName: 'CatalogueSubmissions',
    indexes: [{ fields: ['owner', 'nameKey'] }, { fields: ['status'] }],
  });

  const handle = { sequelize, Submission, ready: null };
  handle.ready = () => (handle._p = handle._p || sequelize.sync().then(() => handle));
  cache.set(storage, handle);
  return handle;
}

function bustApproved() { approvedCache.at = 0; }

function parsePayload(raw) {
  try {
    const p = JSON.parse(raw || '{}');
    return p && typeof p === 'object' ? p : null;
  } catch { return null; }
}

async function approvedExercises() {
  if (Date.now() - approvedCache.at < 30000 && approvedCache.rows) return approvedCache.rows;
  const h = await getCatalogueDatabase().ready();
  const rows = await h.Submission.findAll({ where: { status: 'approved' }, raw: true });
  const out = [];
  const seen = new Set();
  for (const r of rows) {
    const p = parsePayload(r.payload);
    if (!p || !p.name) continue;
    const key = String(p.name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  approvedCache = { at: Date.now(), rows: out };
  return out;
}

async function approvedByName() {
  const map = new Map();
  for (const p of await approvedExercises()) map.set(String(p.name).toLowerCase(), p);
  return map;
}

const PENDING_CAP = 30;

async function submit(owner, exercise) {
  const h = await getCatalogueDatabase().ready();
  const nameKey = exercise.name.toLowerCase();
  const payload = JSON.stringify(exercise);
  const open = await h.Submission.findOne({ where: { owner, nameKey, status: 'pending' } });
  if (open) {
    await open.update({ name: exercise.name, payload, note: null });
    return { ok: true, id: open.id, status: 'pending', updated: true };
  }
  const n = await h.Submission.count({ where: { owner, status: 'pending' } });
  if (n >= PENDING_CAP) return { ok: false, status: 400, error: 'You already have 30 exercises waiting for review.' };
  const row = await h.Submission.create({ owner, name: exercise.name, nameKey, payload, status: 'pending' });
  return { ok: true, id: row.id, status: 'pending', updated: false };
}

async function forOwner(owner) {
  const h = await getCatalogueDatabase().ready();
  const rows = await h.Submission.findAll({ where: { owner }, order: [['updatedAt', 'DESC']], limit: 40, raw: true });
  return rows.map((r) => ({ id: r.id, name: r.name, status: r.status, note: r.note || '', updatedAt: r.updatedAt }));
}

async function pendingList() {
  const h = await getCatalogueDatabase().ready();
  const rows = await h.Submission.findAll({ where: { status: 'pending' }, order: [['createdAt', 'ASC']], raw: true });
  return rows.map((r) => ({ id: r.id, owner: r.owner, name: r.name, note: r.note || '', exercise: parsePayload(r.payload), createdAt: r.createdAt }));
}

async function decide(id, { approve, decidedBy, note }) {
  const h = await getCatalogueDatabase().ready();
  const row = await h.Submission.findByPk(id);
  if (!row || row.status !== 'pending') return null;
  const exercise = parsePayload(row.payload);
  await row.update({
    status: approve ? 'approved' : 'rejected',
    decidedBy: decidedBy || null,
    note: note ? String(note).slice(0, 500) : null,
  });
  bustApproved();
  return { id: row.id, owner: row.owner, exercise };
}

module.exports = {
  getCatalogueDatabase, approvedExercises, approvedByName, submit, forOwner, pendingList, decide, bustApproved, PENDING_CAP,
};
