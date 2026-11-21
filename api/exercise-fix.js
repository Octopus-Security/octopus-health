'use strict';

/**
 * exercise-fix.js — fix many exercises at once.
 *
 * One page lists every exercise name you have logged (and, on request, every
 * exercise in your library) with what is wrong with it:
 *   - no muscles, so the Body Map cannot fill for it
 *   - not in your library at all (a name only the log knows)
 *   - the per-side flag is not set (lib/sides.js)
 *   - another spelling of the same lift exists ("needs tidying")
 * and a SUGGESTION for each: muscles from an exercise with the same movement,
 * a per-side value from the name or from how the sets were logged, the figure
 * the name rules pick. Suggestions are shown, never applied: the person
 * selects rows and accepts or overrides them, then saves. Saving shows a
 * preview first (`confirm` absent), like every other bulk write here.
 *
 * Only this account's own database is touched. A catalogue row edited here is
 * this account's copy; the seed refresh rewrites only instructions and video
 * links (database.js refreshSeedContent), so the edit stays.
 *
 *   GET  /logs/exercises/fix              the page
 *   GET  /logs/api/exercises/fix          rows + vocabulary, JSON
 *   POST /logs/api/exercises/fix          { changes: [...], confirm? }
 */

const { QueryTypes } = require('sequelize');
const { safeError } = require('../lib/safeguards');
const M = require('../lib/muscles');
const SIDES = require('../lib/sides');
const { CATEGORIES } = require('../lib/exercise-fields');
const PoseMap = require('../public/pose-map');
const X = require('./exercise-manage');
const { canonicalKey, baseKey } = require('./exercise-names');
const { makeResolver } = require('../lib/exercise-resolve');

const POSE_KEYS = new Set(PoseMap.keys());
const MAX_CHANGES = 500;
const lower = (s) => String(s || '').toLowerCase();
const list = (v) => M.normalize(v).muscles;

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

/** name -> definition lookups: exact (case-insensitive) first, then same spelling (plurals, punctuation). */
function indexDefs(defs) {
  const byLower = new Map();
  const byCanon = new Map();
  for (const d of defs) {
    if (!byLower.has(lower(d.name))) byLower.set(lower(d.name), d);
    const k = canonicalKey(d.name);
    if (!byCanon.has(k)) byCanon.set(k, d);
  }
  return { find: (name) => byLower.get(lower(name)) || byCanon.get(canonicalKey(name)) || null };
}

// Shorthand people log, expanded so "DB Curls" prefers Dumbbell Curl over EZ-Bar Curl.
const ABBREV = { db: 'dumbbell', kb: 'kettlebell', bb: 'barbell', bw: 'bodyweight', flye: 'fly', flie: 'fly', tri: 'tricep', bi: 'bicep' };
const expand = (name) => canonicalKey(name).split(' ').map(w => ABBREV[w] || w).join(' ');
const bkey = (name) => baseKey(expand(name));
const words = (name) => new Set(canonicalKey(name).split(' ').filter(Boolean).map(w => ABBREV[w] || w));
const overlap = (a, b) => { let n = 0; for (const w of a) if (b.has(w)) n++; return n; };

/**
 * An exercise with the same movement that already has muscles, to copy from.
 * Same movement first (equipment words removed), else whole-word containment
 * ("Paused Bench Press" inside "... Bench Press"); among several, the one
 * sharing the most words with the logged name wins, so the equipment matches.
 */
function muscleSource(name, defs, published) {
  const pub = published.get(lower(name));
  if (pub && list(pub.primaryMuscles).length) return { from: pub.name, why: 'the shared catalogue entry', def: pub };
  const bk = bkey(name);
  if (!bk) return null;
  const mine = words(name);
  const withMuscles = defs.filter(d => d.category !== 'recovery' && list(d.primaryMuscles).length);
  const padded = ` ${bk} `;
  const cands = [];
  for (const d of withMuscles) {
    const k = bkey(d.name);
    const same = k === bk;
    if (!same && !(k.length >= 4 && (padded.includes(` ${k} `) || ` ${k} `.includes(padded)))) continue;
    // Shared words (equipment included) count most; an exact movement breaks ties.
    const ov = overlap(mine, words(d.name));
    const sc = ov * 100 + (same ? 50 : 0) - Math.abs(words(d.name).size - mine.size);
    cands.push({ d, sc, ov, same });
  }
  if (!cands.length) return null;
  cands.sort((x, y) => y.sc - x.sc);
  const top = cands[0];
  // "BB Rows" fits Barbell Bent-Over Row and Barbell Upright Row equally well,
  // and they work different muscles: that is a question, so no suggestion.
  const key = (d) => list(d.primaryMuscles).slice().sort().join(',');
  const rival = cands.find(c => c !== top && c.ov === top.ov && c.same === top.same && key(c.d) !== key(top.d));
  if (rival) return null;
  return { from: top.d.name, why: top.same ? 'same movement' : 'a close name', def: top.d };
}

async function noteCounts(db) {
  const rows = await db.sequelize.query(
    `SELECT exerciseName AS name, COUNT(*) AS total,
            SUM(CASE WHEN lower(COALESCE(notes, '')) LIKE '%each side%' THEN 1 ELSE 0 END) AS perSide
       FROM WorkoutSets WHERE exerciseName IS NOT NULL GROUP BY exerciseName`,
    { type: QueryTypes.SELECT },
  );
  return new Map(rows.map(r => [r.name, { total: Number(r.total), perSide: Number(r.perSide) }]));
}

async function buildRows(db) {
  const [logged, defs, notes, review] = await Promise.all([
    X.spellingStats(db),
    db.ExerciseDefinition.findAll({ raw: true }),
    noteCounts(db),
    X.reviewExercises(db).catch(() => ({ groups: [], suggestions: [] })),
  ]);
  let published = new Map();
  try { published = await require('./catalogue-db').approvedByName(); } catch { /* own definitions still work */ }
  const idx = indexDefs(defs);
  // The shared resolver (lib/exercise-resolve.js) gives the alias-aware answer the Body Map uses, so a
  // suggestion for "Bench Press" comes from Barbell Bench Press. It only feeds SUGGESTIONS: the row's own
  // `def` stays the exact match, because saving here edits that row and must never edit an aliased one.
  let aliases = new Map();
  try { if (db.ExerciseAlias) aliases = new Map((await db.ExerciseAlias.findAll({ raw: true })).map(a => [a.key, a.name])); } catch { /* none */ }
  const resolveName = makeResolver(defs, { published, aliases });
  const tidy = new Set();
  for (const g of review.groups || []) for (const s of g.spellings || []) tidy.add(s.name);
  for (const sg of review.suggestions || []) for (const g of sg.groups || []) for (const n of g.names || []) tidy.add(n);

  const rows = [];
  const covered = new Set();
  const make = (name, log, def) => {
    if (def) covered.add(def.id);
    const pub = published.get(lower(name)) || null;
    const primary = def ? list(def.primaryMuscles) : [];
    const secondary = def ? list(def.secondaryMuscles).filter(m => !primary.includes(m)) : [];
    const stretch = !!(def && def.category === 'recovery');
    const credited = stretch || primary.length > 0 || (pub && list(pub.primaryMuscles).length > 0);
    const n = notes.get(name) || null;
    const issues = [];
    if (!def) issues.push('not-in-library');
    if (!credited) issues.push('no-muscles');
    // A stretch is not counted in volume, so its per-side flag changes nothing: not an issue.
    if ((!def || !def.sides) && !stretch) issues.push('sides-unset');
    if (tidy.has(name)) issues.push('tidy');
    let src = !credited ? muscleSource(name, defs, published) : null;
    if (!credited && !src) {
      const r = resolveName(name);
      if (r && list(r.primaryMuscles).length && r.category !== 'recovery') src = { from: r.name, why: 'a known alias', def: r };
    }
    return {
      name,
      logged: !!log, sets: log ? log.sets : 0, last: log ? log.last : null,
      def: def ? {
        id: def.id, name: def.name, isCustom: !!def.isCustom, category: def.category, equipment: def.equipment,
        primary, secondary, sides: def.sides || null, poseKey: def.poseKey || null,
      } : null,
      perSideNotes: n ? n.perSide : 0,
      issues,
      suggest: {
        muscles: src ? { from: src.from, why: src.why, primary: list(src.def.primaryMuscles), secondary: list(src.def.secondaryMuscles), category: src.def.category || null } : null,
        sides: SIDES.suggest(name, n),
      },
    };
  };
  for (const log of logged) rows.push(make(log.name, log, idx.find(log.name)));
  for (const d of defs) if (!covered.has(d.id)) rows.push(make(d.name, null, d));
  return rows;
}

/** Validate one change; returns { ok, change } or { ok:false, error }. */
function cleanChange(c) {
  if (!c || typeof c !== 'object') return { ok: false, error: 'a change must be an object' };
  const name = String(c.name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!name) return { ok: false, error: 'a change has no name' };
  const out = { name };
  if (c.sides !== undefined) {
    if (c.sides === '' || c.sides === null) out.sides = null;
    else if (SIDES.SIDES.includes(c.sides)) out.sides = c.sides;
    else return { ok: false, error: `"${name}": per-side must be unilateral or bilateral` };
  }
  if (c.category !== undefined) {
    if (!CATEGORIES.includes(c.category)) return { ok: false, error: `"${name}": unknown category` };
    out.category = c.category;
  }
  if (c.poseKey !== undefined) {
    if (c.poseKey === '' || c.poseKey === null) out.poseKey = null;
    else if (POSE_KEYS.has(c.poseKey)) out.poseKey = c.poseKey;
    else return { ok: false, error: `"${name}": unknown figure` };
  }
  for (const k of ['primaryMuscles', 'secondaryMuscles']) {
    if (c[k] === undefined) continue;
    const n = M.normalize(c[k]);
    if (n.unknown.length) return { ok: false, error: `"${name}": the body map does not know ${n.unknown.join(', ')}` };
    out[k] = n.muscles;
  }
  if (out.primaryMuscles && out.secondaryMuscles) out.secondaryMuscles = out.secondaryMuscles.filter(m => !out.primaryMuscles.includes(m));
  if (Object.keys(out).length === 1) return { ok: false, error: `"${name}": nothing to change` };
  return { ok: true, change: out };
}

const show = (def) => def ? {
  category: def.category, sides: def.sides || null, poseKey: def.poseKey || null,
  primaryMuscles: list(def.primaryMuscles), secondaryMuscles: list(def.secondaryMuscles),
} : null;

async function applyChanges(db, body) {
  const raw = body && Array.isArray(body.changes) ? body.changes : null;
  if (!raw || !raw.length) return { ok: false, status: 400, error: 'send { changes: [...] }' };
  if (raw.length > MAX_CHANGES) return { ok: false, status: 400, error: `at most ${MAX_CHANGES} changes at once` };
  const changes = [];
  for (const c of raw) {
    const r = cleanChange(c);
    if (!r.ok) return { ok: false, status: 400, error: r.error };
    changes.push(r.change);
  }
  const defs = await db.ExerciseDefinition.findAll();
  const idx = indexDefs(defs);
  const plan = changes.map((c) => {
    const def = idx.find(c.name);
    const before = show(def);
    const after = { ...(before || { category: 'strength', sides: null, poseKey: null, primaryMuscles: [], secondaryMuscles: [] }) };
    for (const k of ['category', 'sides', 'poseKey', 'primaryMuscles', 'secondaryMuscles']) if (c[k] !== undefined) after[k] = c[k];
    // Muscles picked for a stretch put it back on the map as strength work, same as the Body Map form.
    if (c.primaryMuscles && c.primaryMuscles.length && after.category === 'recovery' && c.category === undefined) after.category = 'strength';
    return { name: def ? def.name : c.name, action: def ? 'update' : 'create', def, before, after, catalogue: !!(def && !def.isCustom) };
  });
  const preview = plan.map(({ name, action, before, after, catalogue }) => ({ name, action, before, after, catalogue }));
  if (!body.confirm) return { ok: true, preview: true, changes: preview };

  await db.sequelize.transaction(async (t) => {
    for (const p of plan) {
      const fields = {
        category: p.after.category, sides: p.after.sides, poseKey: p.after.poseKey,
        primaryMuscles: JSON.stringify(p.after.primaryMuscles), secondaryMuscles: JSON.stringify(p.after.secondaryMuscles),
      };
      if (p.def) await p.def.update(fields, { transaction: t });
      else {
        await db.ExerciseDefinition.create({
          name: p.name, equipment: 'none', instructions: null, videoUrl: null, isCustom: true, ...fields,
        }, { transaction: t });
      }
    }
  });
  return { ok: true, preview: false, saved: plan.length, changes: preview };
}

module.exports = function mountExerciseFix(app, { requireLogin, getDatabase }) {
  const dbFor = req => getDatabase(req.user.username);
  const api = fn => async (req, res) => {
    try {
      const r = await fn(dbFor(req), req);
      res.set('Cache-Control', 'private, no-store');
      res.status(r.ok ? 200 : (r.status || 400)).json(r);
    } catch (e) { console.error('[health] request failed:', safeError(e)); res.status(500).json({ ok: false, error: 'Something went wrong' }); }
  };

  app.get('/logs/exercises/fix', requireLogin, (req, res) => {
    res.render('exercises-fix', {
      title: 'Fix exercises', user: req.user, activeTab: 'logs',
      vocab: M.publicVocabulary(), categories: CATEGORIES, poses: PoseMap.keys(),
    });
  });
  app.get('/logs/api/exercises/fix', requireLogin, api(async (db) => ({ ok: true, rows: await buildRows(db) })));
  app.post('/logs/api/exercises/fix', requireLogin, sameOriginJson, api((db, req) => applyChanges(db, req.body)));
};

module.exports.buildRows = buildRows;
module.exports.applyChanges = applyChanges;
module.exports.cleanChange = cleanChange;
