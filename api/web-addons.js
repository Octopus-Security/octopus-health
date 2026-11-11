'use strict';

/**
 * web-addons.js - the Add-ons page: browse the catalogue, start / pause / resume / stop, see this
 * week's quota and progress, mark a day's session done, and set reminders. Works with no Discord,
 * Telegram or cortex (the bots are an extra channel; the reminder text comes from the service route).
 * Every handler opens getDatabase(req.user.username) and nothing else.
 *
 *   GET  /addons                       page
 *   GET  /addons/api                   { catalogue, states, remindAt, week, today }
 *   POST /addons/api/start             { addonId }
 *   POST /addons/api/pause|resume|stop { addonId }
 *   PUT  /addons/api/reminder          { addonId, reminder: bool }
 *   PUT  /addons/api/remind-at         { time: "HH:MM" | null }   (ET, per account)
 *   POST /addons/api/done              { addonId, done: bool, date?: YYYY-MM-DD }
 *
 * Same CSRF stance as web-nutrition.js: JSON body required, Origin must match.
 */

const A = require('./addons');
const B = require('./benchmarks');
const { todayET } = require('../lib/et');

function mount(app, { requireLogin, getDatabase }) {
  const dbFor = req => getDatabase(req.user.username);
  const ready = async db => { await db.sequelize.sync(); if (db.migrate) await db.migrate(); return db; };

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
    try { const db = await ready(dbFor(req)); res.json(await fn(req, db)); }
    catch (e) { res.status(e.status || 500).json({ ok: false, error: e.status ? e.message : 'Something went wrong' }); if (!e.status) console.error(e); }
  };

  async function overview(db) {
    const today = todayET();
    const [states, remindAt, week] = await Promise.all([A.listStates(db), A.getRemindAt(db), A.addonsForWeek(db, B.weekStart(today))]);
    const open = new Map(states.filter(s => s.status !== 'done').map(s => [s.addonId, s]));
    const summaryBy = new Map(week.summary.map(s => [s.addonId, s]));
    const todayEntries = week.days[today] || [];
    const cards = A.CATALOGUE.map(a => {
      const st = open.get(a.id) || null;
      const sum = summaryBy.get(a.id) || null;
      const phase = st ? A.phaseFor(a, A.weekIndex(st.startDate, today)) : a.weeks[0];
      return {
        id: a.id, title: a.title, goalKind: a.goalKind, summary: a.summary, honesty: a.honesty, requiresNote: a.requiresNote || null,
        nutritionLink: !!a.nutritionLink, deload: a.deload,
        state: st ? { status: st.status, startDate: st.startDate, reminder: !!st.reminder, goalId: st.goalId, weekIndex: A.weekIndex(st.startDate, today) } : null,
        phase: { label: A.phaseLabel(phase), focus: phase.focus, tracks: phase.tracks.map(t => ({ id: t.id, sessionsPerWeek: t.sessionsPerWeek, placement: t.placement })) },
        quota: sum ? { planned: sum.planned, done: sum.done, remaining: sum.remaining } : null,
        today: todayEntries.filter(e => e.addonId === a.id),
      };
    });
    return { ok: true, today, remindAt, cards };
  }

  app.get('/addons', requireLogin, async (req, res) => {
    const db = await ready(dbFor(req));
    const data = await overview(db);
    let nutrition = null;
    if (data.cards.some(c => c.nutritionLink && c.state && c.state.status === 'active')) {
      try { nutrition = await require('./nutrition-targets').overview(db); } catch { nutrition = null; }
    }
    res.render('addons', { title: 'Add-ons', user: req.user, activeTab: 'addons', ...data, nutrition });
  });

  app.get('/addons/api', requireLogin, api(async (req, db) => overview(db)));
  app.post('/addons/api/start', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, state: await A.startAddon(db, (req.body || {}).addonId) })));
  app.post('/addons/api/pause', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, state: await A.pauseAddon(db, (req.body || {}).addonId) })));
  app.post('/addons/api/resume', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, state: await A.resumeAddon(db, (req.body || {}).addonId) })));
  app.post('/addons/api/stop', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, state: await A.stopAddon(db, (req.body || {}).addonId) })));
  app.put('/addons/api/reminder', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, state: await A.setReminder(db, (req.body || {}).addonId, (req.body || {}).reminder === true) })));
  app.put('/addons/api/remind-at', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, remindAt: await A.setRemindAt(db, (req.body || {}).time) })));
  app.post('/addons/api/done', requireLogin, sameOriginJson, api(async (req, db) => {
    const b = req.body || {};
    return { ok: true, ...(await A.setSessionDone(db, b.addonId, b.done !== false, b.date || todayET())) };
  }));
}

module.exports = mount;
