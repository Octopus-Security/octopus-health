'use strict';

/**
 * web-fitness.js — the browser pages for the skill tree, fitness tests, the
 * treadmill test and weekly benchmarks. Mounted from index.js with the app's own
 * requireLogin; every handler opens `getDatabase(req.user.username)` and nothing
 * else, so a page can only ever read or change the signed-in account's file, and
 * a row id belonging to anybody else is a 404 (see fitness-store.js).
 *
 *   GET  /skills                       tree, status, equipment, log an attempt
 *   GET  /tests                        batteries, instructions, record, compare
 *   GET  /tests/treadmill              the audio-guided treadmill / 12-minute test
 *   GET  /tests/treadmill/audio.wav    the same cues as a file (tones only)
 *   GET  /benchmarks                   trends + the editable benchmark list + reminder
 *   POST|PUT|PATCH|DELETE /skills/api/*, /tests/api/*, /benchmarks/api/*   JSON
 *
 * State-changing routes demand a JSON body AND a same-origin Origin header when
 * one is sent. A cross-site <form> cannot send application/json and a cross-site
 * fetch is blocked by CORS preflight (we send no CORS headers); the Origin check
 * is the second wall for the odd client that gets past the first.
 */

const T  = require('./skill-tree');
const F  = require('./fitness-tests');
const B  = require('./benchmarks');
const S  = require('./fitness-store');
const TM = require('../public/js/treadmill.js');

function mount(app, { requireLogin, getDatabase }) {
  const dbFor = req => getDatabase(req.user.username);

  function sameOriginJson(req, res, next) {
    const origin = req.get('origin');
    if (origin) {
      let host = null;
      try { host = new URL(origin).host; } catch { /* falls through to refusal */ }
      if (host !== req.get('host')) return res.status(403).json({ ok: false, error: 'cross-origin request refused' });
    }
    // The header, not req.is(): req.is() answers null for a request with no body
    // (every DELETE), which would refuse the page's own delete buttons.
    if (!/^application\/json\b/i.test(req.get('content-type') || '')) return res.status(415).json({ ok: false, error: 'send application/json' });
    next();
  }

  const api = fn => async (req, res) => {
    try { res.json(await fn(req, dbFor(req))); }
    catch (e) { res.status(e.status || 500).json({ ok: false, error: e.status ? e.message : 'Something went wrong' }); if (!e.status) console.error(e); }
  };

  // ── skills ───────────────────────────────────────────────────────────────
  app.get('/skills', requireLogin, async (req, res) => {
    const db = dbFor(req);
    const { tree, st, have, attempts } = await S.skillState(db);
    const equipment = await S.getEquipment(db);
    const lines = Object.entries(T.LINES).map(([key, meta]) => ({
      key, title: meta.title,
      skills: tree.skills.filter(s => s.line === key).map(s => T.describeSkill(tree, st, have, s)),
    }));
    res.render('skills', {
      title: 'Skill Tree', user: req.user, lines, equipment, known: T.KNOWN_EQUIPMENT,
      summary: T.summary(tree, st, have),
      recent: attempts.slice(-15).reverse().map(a => ({ ...a, name: tree.byId.get(a.skillId)?.name || a.skillId })),
    });
  });
  app.post('/skills/api/attempts', requireLogin, sameOriginJson, api((req, db) => S.logAttempt(db, req.body || {})));
  app.delete('/skills/api/attempts/:id', requireLogin, sameOriginJson, api((req, db) => S.deleteAttempt(db, req.params.id)));
  app.put('/skills/api/equipment', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, ...(await S.changeEquipment(db, (req.body || {}).action || 'set', (req.body || {}).equipment)) })));

  // ── tests ────────────────────────────────────────────────────────────────
  app.get('/tests', requireLogin, async (req, res) => {
    const db = dbFor(req);
    const batteries = [];
    for (const [key, meta] of Object.entries(F.BATTERIES)) {
      const items = [];
      for (const it of F.catalog(key)) items.push({ ...it, trend: await S.trendFor(db, it.id, it.better) });
      batteries.push({ key, ...meta, items });
    }
    const recent = (await db.FitnessResult.findAll({ order: [['date', 'DESC'], ['id', 'DESC']], limit: 30 })).map(r => r.toJSON())
      .map(r => ({ ...r, name: F.getItem(r.item)?.name || r.item, shown: F.formatValue(F.getItem(r.item), r.value) }));
    res.render('tests', { title: 'Fitness Tests', user: req.user, batteries, recent, fmt: F.formatValue });
  });
  app.post('/tests/api/results', requireLogin, sameOriginJson, api((req, db) => S.logResult(db, req.body || {})));
  app.delete('/tests/api/results/:id', requireLogin, sameOriginJson, api((req, db) => S.deleteResult(db, req.params.id)));

  // ── treadmill ────────────────────────────────────────────────────────────
  app.get('/tests/treadmill', requireLogin, (req, res) => {
    res.render('treadmill', { title: 'Treadmill Test', user: req.user, mode: req.query.mode === 'cooper' ? 'cooper' : 'progressive', defaults: TM.DEFAULTS });
  });

  app.get('/tests/treadmill/audio.wav', requireLogin, (req, res) => {
    const q = req.query;
    const stages = Math.max(1, Math.min(30, parseInt(q.stages, 10) || 12));
    const o = { unit: q.unit === 'mph' ? 'mph' : 'kmh', start: q.start, step: q.step, incline: q.incline };
    const events = q.mode === 'cooper' ? TM.cooperEvents() : TM.progressiveEvents(stages, o);
    const wav = Buffer.from(TM.renderWav(events));
    res.set({ 'Content-Type': 'audio/wav', 'Content-Length': wav.length, 'Content-Disposition': 'attachment; filename="treadmill-test.wav"', 'Cache-Control': 'no-store' });
    res.send(wav);
  });

  // ── benchmarks ───────────────────────────────────────────────────────────
  app.get('/benchmarks', requireLogin, async (req, res) => {
    const db = dbFor(req);
    const view = await S.listBenchmarks(db);
    const reminder = await S.getReminder(db);
    const plan = await S.weekPlan(db);
    res.render('benchmarks', {
      title: 'Benchmarks', user: req.user, ...view, reminder, plan, fmt: F.formatValue, getItem: F.getItem,
      catalog: F.catalog().filter(i => !view.benchmarks.some(b => b.item === i.id)),
      focuses: B.FOCUSES, dayNames: B.DAY_NAMES,
    });
  });
  app.post('/benchmarks/api/add', requireLogin, sameOriginJson, api((req, db) => S.addBenchmark(db, req.body || {})));
  app.post('/benchmarks/api/log', requireLogin, sameOriginJson, api((req, db) => S.logBenchmark(db, req.body || {})));
  app.put('/benchmarks/api/focus', requireLogin, sameOriginJson, api((req, db) => S.setFocus(db, (req.body || {}).focus)));
  app.put('/benchmarks/api/day', requireLogin, sameOriginJson, api((req, db) => S.setBenchmarkDay(db, (req.body || {}).day)));
  app.put('/benchmarks/api/reminder', requireLogin, sameOriginJson, api((req, db) => S.updateReminder(db, req.body || {})));
  app.patch('/benchmarks/api/:id', requireLogin, sameOriginJson, api((req, db) => S.updateBenchmark(db, req.params.id, req.body || {})));
  app.delete('/benchmarks/api/:id', requireLogin, sameOriginJson, api((req, db) => S.removeBenchmark(db, req.params.id)));
  app.post('/benchmarks/api/:id/move', requireLogin, sameOriginJson, api((req, db) => S.moveBenchmark(db, req.params.id, req.body || {})));
}

module.exports = mount;
