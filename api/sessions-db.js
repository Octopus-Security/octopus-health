'use strict';

/**
 * sessions-db.js - the ONE shared SQLite file for shareable sessions.
 *
 * Health keeps a database PER USER and that must not change: the file is the privacy
 * boundary for logs, weight and meals. A published session has to be readable by someone with
 * no account, so it cannot live in anyone's per-user file. It lives here instead, in
 * <data dir>/shared-sessions.sqlite (same volume, so it survives deploys), with an `owner`
 * column keyed on username. Nothing in this file is ever joined to a per-user database.
 *
 * Additive only: sync() creates the table when missing and never alters it. Never use
 * sync({ force }) or sync({ alter }) here; a later column is added with a guarded
 * ALTER TABLE ... ADD COLUMN in migrate(), like every other store in the estate.
 */

const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const cache = new Map(); // storage path -> handle (tests change DATA_DIR between files)

function getSharedDatabase() {
  const storage = path.join(require('../lib/dataDir')(), 'shared-sessions.sqlite');
  if (cache.has(storage)) return cache.get(storage);

  const sequelize = new Sequelize({ dialect: 'sqlite', storage, logging: false });

  const SharedSession = sequelize.define('SharedSession', {
    // The account that wrote it. Anyone else asking for the row gets 404, never 403.
    owner:       { type: DataTypes.STRING, allowNull: false },
    title:       { type: DataTypes.STRING, allowNull: false, defaultValue: 'Untitled session' },
    intro:       { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    // JSON array of items; each carries its own snapshot of name, pose key, cues, instructions.
    items:       { type: DataTypes.TEXT, allowNull: false, defaultValue: '[]' },
    // JSON object. PRIVATE TO THE OWNER: who it is for, goal, limits, equipment. Never rendered
    // by any public route; see api/sessions-store.js publicView(), which is a whitelist.
    tailoring:   { type: DataTypes.TEXT, allowNull: false, defaultValue: '{}' },
    // 'private' | 'unlisted' | 'public'. Default private: publishing is a decision the owner
    // makes, never a default they discover.
    visibility:  { type: DataTypes.STRING, allowNull: false, defaultValue: 'private' },
    // Unguessable link secret (192 bits). Resolves only while visibility is unlisted/public.
    token:       { type: DataTypes.STRING, allowNull: false },
    // Human-readable address for PUBLIC sessions only (title + random suffix).
    slug:        { type: DataTypes.STRING, allowNull: true },
    publishedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'SharedSessions',
    indexes: [{ unique: true, fields: ['token'] }, { unique: true, fields: ['slug'] }, { fields: ['owner'] }],
  });

  const handle = { sequelize, SharedSession, ready: null };
  handle.ready = () => (handle._p = handle._p || sequelize.sync().then(() => handle));
  cache.set(storage, handle);
  return handle;
}

module.exports = { getSharedDatabase };
