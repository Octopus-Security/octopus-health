'use strict';

/**
 * web-exercises.js - the Exercises section of the Logs area.
 *
 *   GET  /logs/exercises                 every exercise logged, counts, last date; Rename / Merge
 *   GET  /logs/exercises/detail?name=    one exercise: PRs, strength graph, plateau tips
 *   GET  /logs/api/exercises             the list as JSON
 *   GET  /logs/api/exercises/stats?name= the detail as JSON
 *   POST /logs/api/exercises/move        { from, to, confirm } - rename / merge (preview first)
 *
 * The name is a QUERY parameter, not a path segment: exercise names hold slashes,
 * parentheses and em dashes, and a path segment has to survive every proxy intact.
 * Cookie session, the account's own database. Writes are same-origin JSON only.
 */

const X = require('./exercise-manage');
const S = require('./exercise-stats');
const { bestPerExercise } = require('./pr-detect');

function sameOriginJson(req, res, next) {
  const origin = req.get('origin');
  if (origin) {
    let host = null;
    try { host = new URL(origin).host; } catch { /* fall through */ }
    if (host !== req.get('host')) return res.status(403).json({ ok: false, error: 'cross-origin request refused' });
  }
  if (!/^application\/json\b/i.test(req.get('content-type') || '')) {
    return res.status(415).json({ ok: false, error: 'send application/json' });
  }
  next();
}

async function detail(db, name) {
  const rows = await X.setsFor(db, name);
  if (!rows.length) return null;
  const a = S.analyse(rows);
  let stored = null;
  try {
    const recs = await db.PersonalRecord.findAll({ where: { exerciseName: name } });
    stored = bestPerExercise(recs.map(r => r.toJSON()))[0] || null;
  } catch { /* the computed PRs stand on their own */ }
  return { name, totalSets: rows.length, ...a, storedRecord: stored };
}

module.exports = function mountExercises(app, { requireLogin, getDatabase }) {
  const dbFor = req => getDatabase(req.user.username);
  const api = fn => async (req, res) => {
    try {
      const r = await fn(dbFor(req), req);
      res.status(r.ok ? 200 : (r.status || 400)).json(r);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  };

  app.get('/logs/exercises', requireLogin, async (req, res) => {
    try {
      const list = await X.listExercises(dbFor(req));
      res.render('exercises-list', { title: 'Exercises in your log', user: req.user, activeTab: 'logs', list });
    } catch (e) { res.status(500).send('Could not load exercises'); }
  });

  app.get('/logs/exercises/detail', requireLogin, async (req, res) => {
    try {
      const name = String(req.query.name || '').trim();
      const d = name ? await detail(dbFor(req), name) : null;
      if (!d) return res.status(404).render('exercises-detail', { title: 'Exercise not found', user: req.user, activeTab: 'logs', d: null, name, S });
      res.render('exercises-detail', { title: d.name, user: req.user, activeTab: 'logs', d, name: d.name, S });
    } catch (e) { res.status(500).send('Could not load exercise'); }
  });

  app.get('/logs/api/exercises', requireLogin, api(async db => ({ ok: true, exercises: await X.listExercises(db) })));
  app.get('/logs/api/exercises/stats', requireLogin, api(async (db, req) => {
    const d = await detail(db, String(req.query.name || '').trim());
    return d ? { ok: true, ...d } : { ok: false, status: 404, error: 'no such exercise' };
  }));
  app.post('/logs/api/exercises/move', requireLogin, sameOriginJson,
    api((db, req) => X.moveExercise(db, (req.body || {}).from, (req.body || {}).to, { confirm: (req.body || {}).confirm === true })));
};
module.exports.detail = detail;
