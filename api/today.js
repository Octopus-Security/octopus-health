'use strict';

/**
 * /today — the workout the morning brief sends, on the web.
 *
 * Neith's brief (cortex workout_today) is built from a WorkoutTemplate in THIS
 * database, named "<day>:<location>" ("mon:gym"). Until this page it existed only
 * as a chat message: no animation, no how-to, and no way to log it without going
 * back to the chat. The brief now links here with the slug it used, so the page
 * shows exactly the plan that was sent; "Start logging" opens the live logger
 * (/workout) with those exercises already in it. Nothing here needs Discord,
 * Telegram or cortex.
 *
 * Limit: when a workout constraint is active (injury, travel) cortex rewrites the
 * plan with a model and keeps the result only in the message, so this page shows
 * the template it was based on. Constraints moving into health fixes that.
 */

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const SLUG = /^(sun|mon|tue|wed|thu|fri|sat):[a-z][a-z0-9_-]{0,23}$/;

/** "mon" for the given instant, in ET (the estate's only clock). */
function dayKeyET(now = new Date()) {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(now);
  return wd.toLowerCase().slice(0, 3);
}

function todayET(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * Which template to show. A requested slug wins when it exists (it is what the brief
 * used); otherwise today's home plan, then any plan for today, then nothing.
 */
function resolveSlug(names, requested, dayKey) {
  const have = new Set(names);
  if (requested && SLUG.test(requested) && have.has(requested)) return requested;
  if (have.has(`${dayKey}:home`)) return `${dayKey}:home`;
  return names.filter(n => n.startsWith(dayKey + ':')).sort()[0] || null;
}

function asList(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

/** "3 × 10", "4 × max", "3 × 45 s" — the same reading the brief gives. */
function prescription(ex) {
  const sets = Number(ex.sets) > 0 ? Number(ex.sets) : null;
  let per = null;
  if (ex.repMode === 'max') per = 'max';
  else if (ex.repMode === 'timed' && Number(ex.duration) > 0) per = `${Number(ex.duration)} s`;
  else if (ex.reps != null && String(ex.reps).trim()) per = String(ex.reps).trim();
  if (sets && per) return `${sets} × ${per}`;
  if (sets) return `${sets} sets`;
  return per || '';
}

/** The template as the page needs it, with each exercise matched to the library (for its demo). */
function planFromTemplate(t, defsByName) {
  let meta = {};
  try { meta = JSON.parse(t.description || '{}') || {}; } catch { meta = {}; }
  let list = [];
  try { list = JSON.parse(t.exercises || '[]') || []; } catch { list = []; }
  const [day, location] = String(t.name).split(':');
  return {
    slug: t.name, day, location: meta.location || location || 'home',
    label: meta.label || t.name, type: t.type || 'strength',
    warmup: asList(meta.warmup), cooldown: asList(meta.cooldown),
    exercises: list.filter(e => e && (e.exerciseName || e.name)).map(e => {
      const name = String(e.exerciseName || e.name);
      const def = defsByName.get(name.toLowerCase());
      return {
        name, id: def ? def.id : (e.exerciseId || null), category: def ? def.category : null,
        prescription: prescription(e), sets: Number(e.sets) > 0 ? Number(e.sets) : null,
        note: e.notes || e.note || '',
      };
    }),
  };
}

function mount(app, { requireLogin, getDatabase }) {
  app.get('/today', requireLogin, async (req, res) => {
    const db = getDatabase(req.user.username);
    await db.sequelize.sync();
    const day = dayKeyET();
    const rows = await db.WorkoutTemplate.findAll({ attributes: ['name'] });
    const slug = resolveSlug(rows.map(r => r.name), String(req.query.slug || ''), day);
    const defs = await db.ExerciseDefinition.findAll({ attributes: ['id', 'name', 'category'] });
    const defsByName = new Map(defs.map(d => [String(d.name).toLowerCase(), d]));
    const tpl = slug ? await db.WorkoutTemplate.findOne({ where: { name: slug } }) : null;
    const plan = tpl ? planFromTemplate(tpl, defsByName) : null;

    let stretches = null;
    try {
      const d = await require('./daily-stretches').loadDaily(db);
      stretches = {
        name: d.name,
        items: d.items.map(i => {
          const def = defsByName.get(String(i.name).toLowerCase());
          return { name: i.name, id: i.exerciseId != null ? i.exerciseId : (def ? def.id : null), category: def ? def.category : null,
            holdSeconds: i.holdSeconds, sides: i.sides };
        }),
      };
    } catch { stretches = null; }   // the page still works without its stretch list

    res.render('today', { title: 'Today', user: req.user, activeTab: 'today', plan, stretches,
      today: todayET(), dayKey: day, requested: req.query.slug || null });
  });
}

module.exports = mount;
Object.assign(module.exports, { dayKeyET, todayET, resolveSlug, prescription, planFromTemplate, DAYS, SLUG });
