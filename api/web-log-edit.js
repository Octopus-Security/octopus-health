'use strict';

/**
 * Browser routes for correcting the log — the Logs page's door into
 * api/log-edit.js. Cookie session (requireLogin), the account's own database.
 *
 * Same-origin JSON only, like web-fitness.js: these change history, and a
 * cookie-carrying form post from another site must not be able to.
 */

const E = require('./log-edit');

function sameOriginJson(req, res, next) {
  const origin = req.get('origin');
  if (origin) {
    let host = null;
    try { host = new URL(origin).host; } catch { /* fall through */ }
    if (host !== req.get('host')) return res.status(403).json({ ok: false, error: 'cross-origin request refused' });
  }
  if (req.method !== 'DELETE' && !/^application\/json\b/i.test(req.get('content-type') || '')) {
    return res.status(415).json({ ok: false, error: 'send application/json' });
  }
  next();
}

/**
 * Exercise names this account has already logged, most-used first.
 *
 * The add-exercise box searched only the built-in library, so a name the
 * person uses every week ("Chest Fly Machine") never came up and got retyped
 * with a new spelling — which then makes health's name resolver ask "which did
 * you mean?" on the next chat log. Offering the existing name first is the
 * cheap end of that problem.
 */
async function knownNames(db, q) {
  const { QueryTypes } = require('sequelize');
  const like = q ? `%${String(q).trim()}%` : '%';
  return db.sequelize.query(
    `SELECT s.exerciseName AS name, COUNT(*) AS sets, MAX(ws.date) AS last
       FROM WorkoutSets s LEFT JOIN WorkoutSessions ws ON ws.id = s.sessionId
      WHERE s.exerciseName LIKE :like
      GROUP BY s.exerciseName
      ORDER BY sets DESC, name ASC
      LIMIT 200`,
    { replacements: { like }, type: QueryTypes.SELECT },
  );
}

module.exports = function mountLogEdit(app, { requireLogin, getDatabase }) {
  const dbFor = async req => {
    const db = getDatabase(req.user.username);
    await db.sequelize.sync();
    return db;
  };
  const send = (res, r) => res.status(r.ok ? 200 : (r.status || 400)).json(r);
  const route = fn => async (req, res) => {
    try { send(res, await fn(await dbFor(req), req)); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  };

  app.get('/workout/api/known-names', requireLogin,
    route(async (db, req) => ({ ok: true, names: await knownNames(db, req.query.q) })));

  app.get('/logs/api/session/:id', requireLogin, route((db, req) => E.getSession(db, req.params.id)));
  app.patch('/logs/api/session/:id', requireLogin, sameOriginJson,
    route((db, req) => E.editSession(db, req.params.id, req.body || {})));
  app.delete('/logs/api/session/:id', requireLogin, sameOriginJson,
    route((db, req) => E.deleteSession(db, req.params.id)));
  app.post('/logs/api/session/:id/sets', requireLogin, sameOriginJson,
    route((db, req) => E.addSet(db, req.params.id, req.body || {})));
  app.post('/logs/api/session/:id/rename', requireLogin, sameOriginJson,
    route((db, req) => E.renameExercise(db, req.params.id, (req.body || {}).from, (req.body || {}).to)));
  app.patch('/logs/api/set/:id', requireLogin, sameOriginJson,
    route((db, req) => E.editSet(db, req.params.id, req.body || {})));
  app.delete('/logs/api/set/:id', requireLogin, sameOriginJson,
    route((db, req) => E.deleteSet(db, req.params.id)));
};

module.exports.knownNames = knownNames;
