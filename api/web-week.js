'use strict';

/**
 * web-week.js - the Week page: the web twin of Neith's workout_week. Seven days, each
 * with the plan that day really has in THIS account (a WorkoutTemplate named
 * "<day>:<location>"), where it happens today once paused locations are accounted for,
 * what had to be swapped or left out for that place's equipment, and the active
 * constraints that apply. Nothing here needs Discord, Telegram or cortex, and no model
 * is called.
 *
 *   GET /week
 */

const G = require('./gyms-store');
const T = require('./today');
const C = require('./constraints');
const { displayName } = require('./template-names');

// Monday first, like the brief's weekly overview.
const ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_NAMES = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

/** One day's row for the page. Pure given planFor's answer, so it is testable without a database. */
function dayRow(day, plan, todayKey) {
  const base = { day, name: DAY_NAMES[day], isToday: day === todayKey };
  if (!plan || (!plan.template && !plan.allPaused)) {
    return { ...base, status: 'none', where: plan && plan.location ? plan.location : null, requested: plan ? plan.requested : null };
  }
  if (plan.allPaused) return { ...base, status: 'paused', requested: plan.requested, note: plan.pausedNote || 'Every location is paused.' };
  const tpl = plan.template;
  return {
    ...base, status: 'plan', requested: plan.requested, where: plan.location, gym: plan.gym ? plan.gym.name : plan.location,
    moved: !!plan.substituted, note: plan.substituted ? plan.pausedNote : null,
    slug: tpl.slug, label: tpl.label, type: tpl.type,
    exercises: (tpl.exercises || []).map(e => ({ name: String(e.exerciseName || e.name), prescription: T.prescription(e) })),
    fitNotes: plan.fit ? plan.fit.notes : [],
  };
}

function mount(app, { requireLogin, getDatabase }) {
  app.get('/week', requireLogin, async (req, res) => {
    const db = getDatabase(req.user.username);
    const gyms = await G.listGyms(db);
    const days = [];
    for (const d of ORDER) {
      let plan = null;
      try { plan = await G.planFor(db, { day: d }); } catch { plan = null; }
      days.push(dayRow(d, plan, T.dayKeyET()));
    }
    for (const row of days) if (row.slug) row.label = displayName(row.slug, { label: row.label });
    const paused = gyms.filter(g => !g.active).map(g => ({ slug: g.slug, name: g.name, until: g.pausedUntil }));
    const constraints = await C.list(db);
    res.render('week', { title: 'Week', user: req.user, activeTab: 'week', days, paused, constraints, today: G.todayET() });
  });
}

module.exports = mount;
Object.assign(module.exports, { dayRow, ORDER });
