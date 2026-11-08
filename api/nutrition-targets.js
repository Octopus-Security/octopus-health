'use strict';

/**
 * nutrition-targets.js - daily calorie / protein (and optional carb / fat) targets,
 * today's progress against them, a 7-day view, and a starting-point estimate.
 *
 * General guidance for a fitness log, not medical advice. Nothing here treats or
 * prescribes anything for a condition.
 *
 * The rules this file exists to keep:
 *
 *   - An UNLOGGED day is not a zero day. A day with no meals is "not logged"; its
 *     totals are null, never 0, and it is left out of every average. A day where only
 *     some meals carry calories is "partial": the number shown is what was logged and
 *     says so. Nobody should read "0 kcal" off this and think they ate nothing.
 *   - The ESTIMATE never goes below ESTIMATE_FLOOR_KCAL and never subtracts more than
 *     a small fixed amount. Users may type their own target (within sanity bounds);
 *     the app never suggests an extreme.
 *   - Going over a target is not flagged. No nudge, no alert colour.
 *   - The estimate is a plain formula (below), not a model. No spend.
 */

const ESTIMATE_FLOOR_KCAL = 1500;     // the lowest number the app will ever suggest
const KCAL_MIN = 800, KCAL_MAX = 6000; // manual entry bounds: sanity, not advice
const LIMITS = {
  calories: [KCAL_MIN, KCAL_MAX],
  protein:  [20, 400],
  carbs:    [0, 1000],
  fats:     [0, 500],
};
const FIELDS = ['calories', 'protein', 'carbs', 'fats'];
const SOURCES = ['manual', 'estimate'];

// kcal per kg of body weight per day, by usual activity. A rough rule of thumb.
const ACTIVITY = {
  low:      { label: 'Mostly seated, little training',   kcalPerKg: 28 },
  light:    { label: 'Light training 1-3 days a week',   kcalPerKg: 31 },
  moderate: { label: 'Training 3-5 days a week',         kcalPerKg: 34 },
  high:     { label: 'Hard training 6-7 days a week',    kcalPerKg: 37 },
};
// Gentle fixed steps; no "aggressive" option exists.
const GOALS = {
  maintain: { label: 'Maintain weight',     deltaKcal: 0 },
  lose:     { label: 'Lose weight slowly',  deltaKcal: -250 },
  gain:     { label: 'Gain weight slowly',  deltaKcal: 250 },
};
const PROTEIN_G_PER_KG = 1.6;

const NOTE = 'General guidance for a fitness log, not medical advice. If you have a health condition, or are pregnant, ask a qualified professional what is right for you.';

const err = (message) => Object.assign(new Error(message), { status: 400 });

const { todayET, addDays } = require('../lib/et');

function parseNum(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Validate a target set. Whole-set semantics: a field left out becomes "no target".
 * Calories or protein must be given; carbs and fat are optional.
 * Returns clean integers. Throws a 400 on anything outside the bounds.
 */
function validateTargets(input) {
  const body = input || {};
  const out = {};
  for (const f of FIELDS) {
    const n = parseNum(body[f]);
    if (Number.isNaN(n)) throw err(`${f} must be a number`);
    if (n === null) { out[f] = null; continue; }
    const [lo, hi] = LIMITS[f];
    if (n < lo || n > hi) throw err(`${f} must be between ${lo} and ${hi}`);
    out[f] = Math.round(n);
  }
  if (out.calories === null && out.protein === null) throw err('set at least a calorie or a protein target');
  const source = body.source === undefined ? 'manual' : body.source;
  if (!SOURCES.includes(source)) throw err('source must be manual or estimate');
  out.source = source;
  return out;
}

/**
 * Starting-point estimate from the weight the user typed and a goal.
 *   maintenance = weightKg x kcalPerKg(activity)
 *   target      = maintenance + goal step (0, -250 or +250), never below the floor
 *   protein     = 1.6 g per kg
 * Returns the numbers AND the working, so the page can show how it got there.
 */
function estimate({ weight, unit, goal, activity } = {}) {
  const w = parseNum(weight);
  if (w === null || Number.isNaN(w)) throw err('enter your weight as a number');
  const u = unit === 'kg' ? 'kg' : unit === 'lbs' ? 'lbs' : null;
  if (!u) throw err('unit must be kg or lbs');
  const kg = u === 'kg' ? w : w * 0.45359237;
  if (kg < 30 || kg > 300) throw err('weight looks out of range (30 to 300 kg)');
  const act = ACTIVITY[activity || 'light'];
  if (!act) throw err('unknown activity level');
  const g = GOALS[goal || 'maintain'];
  if (!g) throw err('unknown goal');

  const maintenance = Math.round(kg * act.kcalPerKg);
  let calories = maintenance + g.deltaKcal;
  let raisedToFloor = false;
  if (calories < ESTIMATE_FLOOR_KCAL) { calories = ESTIMATE_FLOOR_KCAL; raisedToFloor = true; }
  const protein = Math.round(kg * PROTEIN_G_PER_KG);
  return {
    calories: Math.round(calories / 5) * 5,
    protein,
    maintenance, raisedToFloor,
    kg: Math.round(kg * 10) / 10,
    working: `${Math.round(kg * 10) / 10} kg x ${act.kcalPerKg} kcal/kg = ${maintenance} kcal` +
      (g.deltaKcal ? `, ${g.deltaKcal > 0 ? '+' : '-'}${Math.abs(g.deltaKcal)} for "${g.label.toLowerCase()}"` : '') +
      (raisedToFloor ? `, raised to the ${ESTIMATE_FLOOR_KCAL} kcal minimum this app will suggest` : '') +
      `; protein ${PROTEIN_G_PER_KG} g x ${Math.round(kg * 10) / 10} kg = ${protein} g`,
    estimate: true,
    note: NOTE,
  };
}

// ── storage: one row (id 1) per account database ────────────────────────────

async function getTargets(db) {
  const row = await db.NutritionTarget.findByPk(1);
  if (!row) return null;
  const j = row.toJSON();
  return { calories: j.calories, protein: j.protein, carbs: j.carbs, fats: j.fats, source: j.source, updatedOn: j.updatedOn };
}

async function setTargets(db, input, now = new Date()) {
  const v = validateTargets(input);
  await db.NutritionTarget.upsert({ id: 1, ...v, updatedOn: todayET(now) });
  return getTargets(db);
}

async function clearTargets(db) {
  await db.NutritionTarget.destroy({ where: { id: 1 } });
  return null;
}

// ── progress ────────────────────────────────────────────────────────────────

/** Sum one macro over the meals that actually carry it; null when none do. */
function sumLogged(meals, key) {
  const have = meals.filter(m => m[key] !== null && m[key] !== undefined);
  if (!have.length) return null;
  return Math.round(have.reduce((t, m) => t + Number(m[key]), 0) * 10) / 10;
}

/**
 * One day's totals from its meals.
 *   status 'not_logged' - no meals at all; every total null (NOT zero)
 *   status 'partial'    - some meals lack calories, so the total is what was logged
 *   status 'logged'     - every meal carried calories
 */
function summariseDay(date, meals) {
  const calories = sumLogged(meals, 'calories');
  let status = 'logged';
  if (!meals.length) status = 'not_logged';
  else if (calories === null || meals.some(m => m.calories === null || m.calories === undefined)) status = 'partial';
  return {
    date, status, meals: meals.length,
    calories, protein: sumLogged(meals, 'protein'), carbs: sumLogged(meals, 'carbs'), fats: sumLogged(meals, 'fats'),
  };
}

/** Today plus the six days before it, oldest first, from the account's Meal rows. */
async function weekProgress(db, now = new Date()) {
  const today = todayET(now);
  const start = addDays(today, -6);
  const rows = await db.Meal.findAll({ where: { date: { [require('sequelize').Op.between]: [start, today] } } });
  const by = {};
  for (const m of rows) (by[m.date] = by[m.date] || []).push(m);
  const days = [];
  for (let i = 0; i < 7; i++) { const d = addDays(start, i); days.push(summariseDay(d, by[d] || [])); }

  // Averages use only days that logged that macro. An unlogged day is not a zero.
  const avg = (key) => {
    const vals = days.map(d => d[key]).filter(v => v !== null);
    return vals.length ? { value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), days: vals.length } : null;
  };
  return {
    today, days,
    todaySummary: days[6],
    loggedDays: days.filter(d => d.status !== 'not_logged').length,
    average: { calories: avg('calories'), protein: avg('protein'), carbs: avg('carbs'), fats: avg('fats') },
  };
}

/** Everything the page and the service endpoint need, in one shape. */
async function overview(db, now = new Date()) {
  const [targets, week] = await Promise.all([getTargets(db), weekProgress(db, now)]);
  return { ok: true, targets, week, floorKcal: ESTIMATE_FLOOR_KCAL, note: NOTE };
}

module.exports = {
  ESTIMATE_FLOOR_KCAL, KCAL_MIN, KCAL_MAX, LIMITS, ACTIVITY, GOALS, NOTE,
  validateTargets, estimate, getTargets, setTargets, clearTargets,
  summariseDay, weekProgress, overview, todayET, addDays,
};
