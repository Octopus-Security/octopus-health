'use strict';

/**
 * fitness-tests.js — the catalogue of fitness tests and the comparison maths.
 * Pure: no database, no clock (callers pass dates).
 *
 * Two batteries, plus the cardio tests both lean on:
 *
 *   calisthenics  max reps / hold times for bodyweight work.
 *   fitness       a general battery in the spirit of school fitness batteries
 *                 (aerobic test, curl-ups, push-ups at a set cadence, trunk lift,
 *                 sit-and-reach). The NAMES of these tests are generic; the
 *                 instructions below are our own words and we do not reproduce
 *                 any published test's script, audio or norm tables.
 *   cardio        the treadmill progressive test (public/js/treadmill.js), the
 *                 12-minute distance test and the 1.5-mile time.
 *
 * NO NORM TABLES. Age/sex standards are somebody else's data and wrong numbers
 * here would be quoted back to people as fact. What we do is compare a person
 * with THEIR OWN previous results (see trend()). Where an item carries a
 * `guidance` string it is general advice, labelled as such, with the source in
 * a comment next to it.
 *
 * Sources for the protocols (cited, not copied):
 *  - 12-minute run: K. H. Cooper, "A means of assessing maximal oxygen intake",
 *    JAMA 1968; 203(3):201-204. Cover as much distance as possible in 12 min.
 *  - 1.5-mile run for time: the same family of field tests (Cooper); lower is
 *    better.
 *  - Curl-up / push-up cadence of one repetition about every 3 s (20 per min)
 *    follows the convention used by FitnessGram (The Cooper Institute,
 *    FitnessGram administration manual). We state the cadence as a parameter,
 *    not the manual's wording.
 */

const ITEMS = [
  // ── calisthenics battery ──────────────────────────────────────────────────
  { id: 'max_pushups_handles', battery: 'calisthenics', name: 'Max push-ups on handles', short: 'pushups', unit: 'reps', kind: 'reps', better: 'higher', equipment: ['handles'],
    how: 'Hands on push-up handles under the shoulders, body straight from head to heels. Lower until the chest is a fist above the floor, press to full lockout. One set to failure; stop when the body line breaks or you pause longer than a breath at the top.' },
  { id: 'max_pushups', battery: 'calisthenics', name: 'Max push-ups (floor)', short: 'floor-pushups', unit: 'reps', kind: 'reps', better: 'higher', equipment: [],
    how: 'Same standard as the handle version but hands flat on the floor. Keep it separate from the handles result: the range is different.' },
  { id: 'max_pike_pushups', battery: 'calisthenics', name: 'Max pike push-ups', short: 'pike-pushups', unit: 'reps', kind: 'reps', better: 'higher', equipment: [],
    how: 'Hips high in an inverted V, feet on the floor. Lower the top of the head to a point just ahead of the hands and press back up. One set to failure with full range.' },
  { id: 'max_pullups', battery: 'calisthenics', name: 'Max pull-ups', short: 'pullups', unit: 'reps', kind: 'reps', better: 'higher', equipment: ['bar'],
    how: 'Dead hang to chin over the bar, no kip. One set to failure. No bar: use max inverted rows instead.' },
  { id: 'max_rows', battery: 'calisthenics', name: 'Max inverted rows', short: 'rows', unit: 'reps', kind: 'reps', better: 'higher', equipment: ['bar|dip-bars'],
    how: 'Body straight under a hip-height bar, heels on the floor, pull the chest to the bar. One set to failure; note the bar height in the notes so you test the same angle next time.' },
  { id: 'max_dips', battery: 'calisthenics', name: 'Max dips', short: 'dips', unit: 'reps', kind: 'reps', better: 'higher', equipment: ['dip-bars'],
    how: 'Strict full-range dips on parallel bars, one set to failure. Bench dips are deliberately not used here (hard on the front of the shoulder). With stable tall handles you may test handle dips instead - note it.' },
  { id: 'plank_hold', battery: 'calisthenics', name: 'Plank hold', short: 'plank', unit: 's', kind: 'hold', better: 'higher', equipment: [],
    how: 'Forearm plank, glutes tight, ribs down. Time until the hips sag or rise out of a straight line.' },
  { id: 'wall_sit', battery: 'calisthenics', name: 'Wall sit', short: 'wall-sit', unit: 's', kind: 'hold', better: 'higher', equipment: ['wall'],
    how: 'Back flat on a wall, thighs level with the floor, knees over ankles, hands off the legs. Time until you rise or the thighs drift above level.' },
  { id: 'squats_60s', battery: 'calisthenics', name: 'Bodyweight squats in 60 s', short: 'squats', unit: 'reps', kind: 'reps', better: 'higher', equipment: [],
    how: 'Count full-depth squats completed in 60 seconds. You may rest standing but the clock keeps running.' },
  { id: 'hollow_hold', battery: 'calisthenics', name: 'Hollow body hold', short: 'hollow', unit: 's', kind: 'hold', better: 'higher', equipment: [],
    how: 'On your back, lower back pressed to the floor, arms overhead, legs and shoulders lifted. Time until the lower back lifts off the floor.' },
  { id: 'tuck_lsit_hold', battery: 'calisthenics', name: 'Tuck L-sit hold', short: 'tuck-lsit', unit: 's', kind: 'hold', better: 'higher', equipment: ['handles|dip-bars'],
    how: 'Arms locked on handles or bars, shoulders pressed down, knees tucked and feet off the floor. Time until a foot touches down or the elbows bend.' },
  // ── general fitness battery ───────────────────────────────────────────────
  { id: 'curl_ups', battery: 'fitness', name: 'Curl-ups (cadence)', short: 'curl-ups', unit: 'reps', kind: 'reps', better: 'higher', equipment: [],
    how: 'On your back, knees bent, feet flat. Curl the shoulders off the floor and lower again at a steady beat of about one rep every 3 seconds (use a metronome or timer). Stop at the first missed beat or when form fails.' },
  { id: 'pushups_cadence', battery: 'fitness', name: 'Push-ups at cadence', short: 'cadence-pushups', unit: 'reps', kind: 'reps', better: 'higher', equipment: [],
    how: 'Full push-ups at a steady beat of about one rep every 3 seconds. Count reps until you miss the beat twice or form breaks.' },
  { id: 'trunk_lift', battery: 'fitness', name: 'Trunk lift', short: 'trunk-lift', unit: 'cm', kind: 'distance', better: 'higher', equipment: [],
    how: 'Face down, hands under the thighs. Lift the chest slowly off the floor using the back muscles, hold still, and measure the height of the chin above the floor. Look at a spot on the floor, do not jerk. Best of two tries.' },
  { id: 'sit_and_reach', battery: 'fitness', name: 'Sit-and-reach', short: 'sit-reach', unit: 'cm', kind: 'distance', better: 'higher', equipment: [],
    how: 'Seated, one leg straight, the sole of the foot against a box or wall; reach forward along a ruler with both hands. Record how far past (positive) or short of (negative) the toes the fingertips get, best of two. Test the same leg each time.' },
  // ── cardio (aerobic) ──────────────────────────────────────────────────────
  { id: 'treadmill_stage', battery: 'cardio', name: 'Treadmill progressive test (last stage)', short: 'treadmill', unit: 'stage', kind: 'stage', better: 'higher', equipment: ['treadmill'],
    how: 'Open /tests/treadmill. Speed rises every minute on the schedule the page shows and announces; run (or walk fast) until you cannot keep up, then press Stop. Same start speed and incline every time you repeat it.',
    link: '/tests/treadmill' },
  { id: 'cooper_12min_m', battery: 'cardio', name: '12-minute distance', short: 'cooper', unit: 'm', kind: 'distance', better: 'higher', equipment: ['treadmill'],
    how: 'Run or walk as far as you can in 12 minutes at an even effort (set the treadmill yourself, you may change the speed). Read the distance off the display.',
    link: '/tests/treadmill?mode=cooper' },
  { id: 'run_1_5mi_s', battery: 'cardio', name: '1.5-mile time', short: 'mile-and-a-half', unit: 's', kind: 'time', better: 'lower', equipment: ['treadmill'],
    how: 'Cover 1.5 miles (2.41 km) as fast as you can, even pacing; record the time in seconds (or mm:ss).' },
];

const BATTERIES = {
  calisthenics: { name: 'Calisthenics test', blurb: 'Max reps and hold times. Rest 3-5 minutes between items, easy items first. Test fresh, after a warm-up, not after a hard session.' },
  fitness: { name: 'General fitness test', blurb: 'An aerobic test (the treadmill test or the 12-minute distance), then curl-ups, push-ups at cadence, trunk lift and sit-and-reach. Do the aerobic item last if you are testing the same day.' },
  cardio: { name: 'Aerobic tests', blurb: 'Treadmill-based. Use the same protocol each time or the comparison means nothing.' },
};

const byId = new Map(ITEMS.map(i => [i.id, i]));
const getItem = id => byId.get(id) || null;

function catalog(battery) {
  return ITEMS.filter(i => !battery || i.battery === battery);
}

function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

/** Resolve free text ("push-ups", "plank hold", an id) to a catalogue item, or null. */
function findItem(query) {
  const q = norm(query);
  if (!q) return null;
  return ITEMS.find(i => i.id === String(query).trim().toLowerCase() || norm(i.short) === q || norm(i.name) === q) || null;
}

/**
 * Compare a person with themselves.
 *
 * @param results [{value, date:'YYYY-MM-DD', id?}] any order
 * @param better  'higher' | 'lower'
 *
 * Reference points are DATE-based, not "the previous row": the result ON OR
 * BEFORE (latest.date - 7 days) is "last week" and on or before (latest.date -
 * 28 days) is "4 weeks ago". If nothing is that old yet the answer is null, not
 * the nearest result - saying "up 3 since last week" about a result from
 * yesterday would be a made-up comparison.
 *
 * `delta` is latest - reference; `improved` accounts for direction (a lower
 * 1.5-mile time is an improvement).
 */
function trend(results, better = 'higher') {
  const rows = [...results].sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.id || 0) - (b.id || 0));
  if (!rows.length) return { count: 0, latest: null, best: null, previous: null, vsPrevious: null, vsLastWeek: null, vs4Weeks: null };
  const latest = rows[rows.length - 1];
  const sign = better === 'lower' ? -1 : 1;
  const best = rows.reduce((b, r) => (sign * r.value > sign * b.value ? r : b), rows[0]);
  const cmp = ref => ref ? { reference: { value: ref.value, date: ref.date }, delta: round(latest.value - ref.value), improved: sign * (latest.value - ref.value) > 0 ? true : (latest.value === ref.value ? null : false) } : null;
  const olderThan = days => {
    const cutoff = addDays(String(latest.date), -days);
    const older = rows.filter(r => r !== latest && String(r.date) <= cutoff);
    return older.length ? older[older.length - 1] : null;
  };
  const previous = rows.length > 1 ? rows[rows.length - 2] : null;
  return {
    count: rows.length,
    latest: { value: latest.value, date: latest.date },
    best: { value: best.value, date: best.date, isLatest: best === latest },
    previous: previous ? { value: previous.value, date: previous.date } : null,
    vsPrevious: cmp(previous),
    vsLastWeek: cmp(olderThan(7)),
    vs4Weeks: cmp(olderThan(28)),
  };
}

const round = n => Math.round(n * 100) / 100;

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 125 -> "2:05"; used for time items and for the hold display. */
function formatValue(item, value) {
  if (value == null) return '-';
  if (item && item.kind === 'time') {
    const s = Math.round(value);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  return `${value}${item && item.unit && item.unit !== 'reps' ? ' ' + item.unit : ''}`;
}

/** "2:05" or "125" -> 125 seconds. Used where the unit is time. */
function parseTime(text) {
  const m = String(text).trim().match(/^(\d+):([0-5]?\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

module.exports = { ITEMS, BATTERIES, getItem, catalog, findItem, trend, formatValue, parseTime, addDays };
