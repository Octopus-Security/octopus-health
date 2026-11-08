'use strict';

/**
 * web-coaching.js - the Coaching page (phase 3, api/coaching.js).
 *
 *   GET /coaching                 page: each movement pattern, where you are, plateau, weak point, next variation
 *   GET /coaching/api/status      the same as JSON
 *
 * Failed-set taps are written through the existing set editor
 * (PATCH /logs/api/set/:id {failed, failPoint}, api/log-edit.js) - no second write path.
 * Read-only here, so no CSRF surface. One sqlite file per account, as everywhere.
 */

const C = require('./coaching');

function mount(app, { requireLogin, getDatabase }) {
  const dbFor = req => getDatabase(req.user.username);

  app.get('/coaching/api/status', requireLogin, async (req, res) => {
    try {
      const db = dbFor(req); await db.sequelize.sync(); await db.migrate();
      res.json({ ok: true, ...(await C.status(db)) });
    } catch (e) { console.error(e); res.status(500).json({ ok: false, error: 'Something went wrong' }); }
  });

  app.get('/coaching', requireLogin, async (req, res) => {
    try {
      const db = dbFor(req); await db.sequelize.sync(); await db.migrate();
      const s = await C.status(db);
      res.render('coaching', { title: 'Coaching', user: req.user, activeTab: 'coaching', ...s });
    } catch (e) { console.error(e); res.status(500).send('Something went wrong'); }
  });
}

module.exports = mount;
