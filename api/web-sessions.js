'use strict';

/**
 * web-sessions.js - AUTHORING for shareable sessions (trainer or admin).
 *
 *   GET    /sessions                          list page
 *   GET    /sessions/:id                      editor page
 *   GET    /sessions/api/list                 the owner's sessions
 *   POST   /sessions/api                      create (private, empty)
 *   PUT    /sessions/api/:id                  save title, intro, items, tailoring
 *   POST   /sessions/api/:id/visibility       {visibility: private|unlisted|public}
 *   POST   /sessions/api/:id/rotate-link      new link secret; the old link dies at once
 *   DELETE /sessions/api/:id
 *   GET    /sessions/api/library              picker contents + vocabulary
 *   POST   /sessions/api/suggest              {tailoring} -> suggestions (never adds anything)
 *
 * Everyone who is not a trainer or admin (role re-checked within ~30 s, see trainer-guard.js) gets 404 on every one of these (not 403: do not confirm the
 * feature exists). A foreign session id is a 404 for the same reason. The shared database is the
 * only store touched here; no per-user database is joined to it except to READ the admin's own
 * exercise library for the picker.
 *
 * Same CSRF stance as web-gyms.js: JSON body required and Origin must match.
 */

const S = require('./sessions-store');
const L = require('./sessions-library');
const M = require('../lib/muscles');
const E = require('./equipment');
const mobility = require('./mobility');
const { getSharedDatabase } = require('./sessions-db');

const { trainerGuard, isTrainerRole } = require('./trainer-guard');
const isAdmin = (req) => !!(req.user && req.user.role === 'admin');

function mount(app, { requireLogin, getDatabase, verifyFresh }) {
  const guard = [requireLogin, trainerGuard(verifyFresh)];

  function sameOriginJson(req, res, next) {
    const origin = req.get('origin');
    if (origin) {
      let host = null;
      try { host = new URL(origin).host; } catch { /* refused below */ }
      if (host !== req.get('host')) return res.status(403).json({ ok: false, error: 'cross-origin request refused' });
    }
    if (!/^application\/json\b/i.test(req.get('content-type') || '')) return res.status(415).json({ ok: false, error: 'send application/json' });
    next();
  }
  const api = fn => async (req, res) => {
    try { const h = await getSharedDatabase().ready(); res.json({ ok: true, ...(await fn(req, h)) }); }
    catch (e) { res.status(e.status || 500).json({ ok: false, error: e.status ? e.message : 'Something went wrong' }); if (!e.status) console.error('sessions:', e.message); }
  };
  const me = req => req.user.username;

  app.get('/sessions', ...guard, async (req, res) => {
    const h = await getSharedDatabase().ready();
    res.render('sessions', { title: 'Sessions', user: req.user, activeTab: 'sessions', sessions: await S.listOwned(h, me(req)) });
  });

  app.get('/sessions/api/list', ...guard, api(async (req, h) => ({ sessions: await S.listOwned(h, me(req)) })));

  app.get('/sessions/api/library', ...guard, api(async (req) => {
    const db = getDatabase(me(req));
    const rows = await db.ExerciseDefinition.findAll({ order: [['name', 'ASC']] });
    const library = [...L.fromExercises(rows.map(r => r.toJSON())), ...L.fromRoutines(mobility.ROUTINES), ...L.fromMma()];
    // The client only needs enough to show and snapshot an item; muscle data stays server-side for suggest().
    return {
      library: library.map(({ type, ref, name, category, poseKey, cues, instructions, dose, group }) => ({ type, ref, name, category, poseKey, cues, instructions, dose, group: group || '' })),
      vocab: M.publicVocabulary(),
      equipment: E.ITEMS.map(i => ({ id: i.id, name: i.name, group: i.group })),
      mmaIncluded: L.fromMma().length,
    };
  }));

  app.post('/sessions/api/suggest', ...guard, sameOriginJson, api(async (req) => {
    const db = getDatabase(me(req));
    const rows = await db.ExerciseDefinition.findAll();
    const library = [...L.fromExercises(rows.map(r => r.toJSON())), ...L.fromRoutines(mobility.ROUTINES), ...L.fromMma()];
    return { suggestions: L.suggest(library, S.cleanTailoring((req.body || {}).tailoring)) };
  }));

  app.post('/sessions/api', ...guard, sameOriginJson, api(async (req, h) => ({ session: await S.create(h, me(req), req.body) })));
  app.put('/sessions/api/:id', ...guard, sameOriginJson, api(async (req, h) => ({ session: await S.update(h, me(req), req.params.id, req.body) })));
  app.post('/sessions/api/:id/visibility', ...guard, sameOriginJson, api(async (req, h) => ({ session: await S.setVisibility(h, me(req), req.params.id, (req.body || {}).visibility) })));
  app.post('/sessions/api/:id/rotate-link', ...guard, sameOriginJson, api(async (req, h) => ({ session: await S.rotateToken(h, me(req), req.params.id) })));
  app.delete('/sessions/api/:id', ...guard, sameOriginJson, api(async (req, h) => S.remove(h, me(req), req.params.id)));

  app.get('/sessions/:id(\\d+)', ...guard, async (req, res, next) => {
    const h = await getSharedDatabase().ready();
    let s;
    try { s = S.ownerView(await S.getOwned(h, me(req), req.params.id)); } catch (e) { if (e.status === 404) return next(); throw e; }
    // JSON for a <script type="application/json"> block: "<" and the two JS line separators escaped so
    // the text can never close the tag or break parsing.
    const sessionJson = JSON.stringify(s).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    res.render('session-edit', { title: 'Edit session', user: req.user, activeTab: 'sessions', session: s, sessionJson });
  });
}

module.exports = mount;
module.exports.isAdmin = isAdmin;
module.exports.isTrainerRole = isTrainerRole;
