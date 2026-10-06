'use strict';

/**
 * skill-tree.js — the calisthenics skill tree: data in, decisions out. Pure.
 *
 * ── Where the data lives ─────────────────────────────────────────────────────
 * `content/calisthenics/skill-tree.json` is the ONE copy of the tree. A skill
 * that already has a rung in a progression ladder (`content/calisthenics/*.md`)
 * carries `ref: {file, rung}` and a one-line how-to; the full cues, faults and
 * regressions stay in the markdown and are never retyped here. Skills with no
 * ladder rung (wrist prep, the freestanding handstand work, planche lean...)
 * have `ref: null` and their own short how-to. `test/skill-tree.test.js` fails
 * if a ref points at a rung that does not exist, if a prerequisite id is
 * unknown, or if the graph has a cycle.
 *
 * ── How a skill unlocks ──────────────────────────────────────────────────────
 * ACHIEVED  = the user has logged at least one attempt with result "succeeded".
 *             The user's word is the criterion check: nothing here can see a
 *             rep. The criterion (e.g. 3 x 10) is shown, and a "succeeded" with
 *             numbers below it is still accepted but the reply says so.
 * UNLOCKED  = every skill in `requires` is achieved (roots are unlocked from
 *             the start). Unlocked and not yet achieved = "available".
 * LOCKED    = at least one prerequisite is not achieved.
 * Status is DERIVED from the attempts on every read, never stored, so deleting
 * a wrong attempt re-locks what depended on it with nothing to repair.
 *
 * ── Equipment ────────────────────────────────────────────────────────────────
 * `equipment` is a list of requirements, all needed (AND). An entry may be
 * "a|b" meaning either. "none" (floor, body) is always available. The user's
 * own list is a per-account setting, never a constant for one person.
 * A user who has never set one is assumed to have a floor, a wall and a chair
 * (DEFAULT_EQUIPMENT); anything else - handles, a bar, dip bars - must be said.
 * Random picks prefer skills the equipment allows and only fall back to
 * others, labelled, when nothing allowed is left.
 */

const fs   = require('fs');
const path = require('path');

const TREE_PATH   = path.join(__dirname, '..', 'content', 'calisthenics', 'skill-tree.json');
const CONTENT_DIR = path.join(__dirname, '..', 'content', 'calisthenics');

const KNOWN_EQUIPMENT   = ['wall', 'chair', 'handles', 'dip-bars', 'bar', 'rings'];
const DEFAULT_EQUIPMENT = ['wall', 'chair'];

const EQUIPMENT_ALIASES = {
  'handles': 'handles', 'push-up handles': 'handles', 'pushup handles': 'handles', 'push up handles': 'handles',
  'parallettes': 'handles', 'parallette': 'handles', 'push-up bars': 'handles', 'pushup bars': 'handles',
  'bar': 'bar', 'pull-up bar': 'bar', 'pullup bar': 'bar', 'pull up bar': 'bar', 'chin-up bar': 'bar', 'chinup bar': 'bar',
  'dip bars': 'dip-bars', 'dip bar': 'dip-bars', 'dip-bars': 'dip-bars', 'dip station': 'dip-bars', 'parallel bars': 'dip-bars', 'dip stand': 'dip-bars',
  'wall': 'wall', 'chair': 'chair', 'box': 'chair', 'bench': 'chair', 'step': 'chair',
  'rings': 'rings', 'gymnastic rings': 'rings',
};

const LINES = {
  handstand: { title: 'Handstand and handstand push-ups', aliases: ['handstand', 'handstands', 'pike', 'pike push-ups', 'hspu line', 'overhead pressing'] },
  push:      { title: 'Push-ups',          aliases: ['push-ups', 'push ups', 'pushups', 'push', 'chest'] },
  planche:   { title: 'Planche line',      aliases: ['planche', 'planche line', 'crow'] },
  dips:      { title: 'Dips and support',  aliases: ['dips', 'dip line', 'support'] },
  lsit:      { title: 'L-sit line',        aliases: ['l-sit line', 'l sit line', 'l-sits'] },
  core:      { title: 'Core',              aliases: ['core', 'abs', 'hollow'] },
  legs:      { title: 'Squat line',        aliases: ['legs', 'squats', 'squat line', 'leg line'] },
  hinge:     { title: 'Hinge line',        aliases: ['hinge', 'hamstrings', 'glutes', 'posterior chain'] },
  pull:      { title: 'Pull-ups',          aliases: ['pull-ups', 'pull ups', 'pullups', 'pull', 'pulling', 'back'] },
  rows:      { title: 'Rows',              aliases: ['rows', 'row line', 'inverted rows'] },
  levers:    { title: 'Levers',            aliases: ['levers', 'lever', 'front lever line', 'back lever line'] },
  mobility:  { title: 'Mobility',          aliases: ['mobility', 'flexibility', 'stretching'] },
};

// ── Loading and validation ───────────────────────────────────────────────────

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Parse "### 5. Title" headings out of a ladder file. */
function ladderRungs(file) {
  const text = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
  const out = new Map();
  for (const m of text.matchAll(/^###\s+(\d+)\.\s+(.+)$/gm)) out.set(Number(m[1]), m[2].trim());
  return out;
}

/** @returns {string[]} problems; empty when the tree is sound. */
function validate(raw) {
  const problems = [];
  const ids = new Set();
  const rungCache = new Map();
  for (const s of raw.skills) {
    if (ids.has(s.id)) problems.push(`duplicate id ${s.id}`);
    ids.add(s.id);
  }
  for (const s of raw.skills) {
    for (const f of ['id', 'name', 'line', 'how', 'criterion', 'requires', 'equipment']) {
      if (s[f] === undefined) problems.push(`${s.id}: missing ${f}`);
    }
    if (!LINES[s.line]) problems.push(`${s.id}: unknown line ${s.line}`);
    if (!s.criterion || !s.criterion.sets || !(s.criterion.reps || s.criterion.hold)) problems.push(`${s.id}: criterion needs sets and reps or hold`);
    for (const r of s.requires || []) if (!ids.has(r)) problems.push(`${s.id}: unknown prerequisite ${r}`);
    for (const e of s.equipment || []) {
      for (const alt of e.split('|')) if (!KNOWN_EQUIPMENT.includes(alt)) problems.push(`${s.id}: unknown equipment ${alt}`);
    }
    if (s.ref) {
      if (!rungCache.has(s.ref.file)) {
        try { rungCache.set(s.ref.file, ladderRungs(s.ref.file)); } catch { rungCache.set(s.ref.file, null); }
      }
      const rungs = rungCache.get(s.ref.file);
      if (!rungs) problems.push(`${s.id}: ref file ${s.ref.file} not found`);
      else if (!rungs.has(s.ref.rung)) problems.push(`${s.id}: ${s.ref.file} has no rung ${s.ref.rung}`);
    }
  }
  // Cycle check (depth-first, three colours).
  const byId = new Map(raw.skills.map(s => [s.id, s]));
  const colour = new Map();
  const visit = id => {
    if (colour.get(id) === 2) return;
    if (colour.get(id) === 1) { problems.push(`cycle through ${id}`); return; }
    colour.set(id, 1);
    for (const r of byId.get(id)?.requires || []) if (byId.has(r)) visit(r);
    colour.set(id, 2);
  };
  for (const s of raw.skills) visit(s.id);
  return problems;
}

let _cached = null;
function loadTree() {
  if (_cached) return _cached;
  const raw = JSON.parse(fs.readFileSync(TREE_PATH, 'utf8'));
  const problems = validate(raw);
  if (problems.length) throw new Error('skill-tree.json is invalid: ' + problems.join('; '));
  const byId = new Map(raw.skills.map(s => [s.id, s]));
  const children = new Map(raw.skills.map(s => [s.id, []]));
  for (const s of raw.skills) for (const r of s.requires) children.get(r).push(s.id);
  // depth = longest chain of prerequisites ending here; roots are 1. It is how
  // "near your level" is measured, so no author has to maintain a tier number.
  const depth = new Map();
  const d = id => {
    if (depth.has(id)) return depth.get(id);
    const v = 1 + Math.max(0, ...byId.get(id).requires.map(d));
    depth.set(id, v);
    return v;
  };
  raw.skills.forEach(s => d(s.id));
  _cached = { skills: raw.skills, byId, children, depth, validate: () => validate(raw) };
  return _cached;
}

// ── Equipment ────────────────────────────────────────────────────────────────

/** Accepts free text or tokens; returns canonical tokens or throws listing the unknown. */
function normalizeEquipment(list) {
  const arr = Array.isArray(list) ? list : String(list || '').split(/[,;]|\band\b/);
  const out = new Set(), unknown = [];
  for (const raw of arr) {
    const k = String(raw).trim().toLowerCase().replace(/^(a|an|the|my)\s+/, '');
    if (!k || k === 'none') continue;
    const tok = EQUIPMENT_ALIASES[k] || EQUIPMENT_ALIASES[k.replace(/s$/, '')] || (KNOWN_EQUIPMENT.includes(k) ? k : null);
    if (tok) out.add(tok); else unknown.push(raw);
  }
  if (unknown.length) {
    const e = new Error(`Unknown equipment: ${unknown.join(', ')}. Known: ${KNOWN_EQUIPMENT.join(', ')}.`);
    e.status = 400;
    throw e;
  }
  return [...out];
}

/** Stored list (or null when never set) -> the Set the tree is checked against. */
function effectiveEquipment(stored) {
  return new Set(['none', ...(Array.isArray(stored) ? stored : DEFAULT_EQUIPMENT)]);
}

function missingEquipment(skill, have) {
  const missing = [];
  for (const need of skill.equipment || []) {
    if (!need.split('|').some(a => have.has(a))) missing.push(need.replace('|', ' or '));
  }
  return missing;
}

// ── Status ───────────────────────────────────────────────────────────────────

/**
 * @param attempts rows {skillId, date, result:'succeeded'|'not_yet', reps, seconds, createdAt?}
 * @returns Map id -> {status, achievedAt, attempts, lastAttempt, bestReps, bestSeconds}
 */
function statusMap(tree, attempts) {
  const per = new Map(tree.skills.map(s => [s.id, { attempts: 0, achievedAt: null, lastAttempt: null, bestReps: null, bestSeconds: null }]));
  for (const a of attempts) {
    const p = per.get(a.skillId);
    if (!p) continue;
    p.attempts++;
    if (!p.lastAttempt || String(a.date) >= String(p.lastAttempt.date)) p.lastAttempt = a;
    if (a.result === 'succeeded' && (!p.achievedAt || String(a.date) < p.achievedAt)) p.achievedAt = String(a.date);
    if (a.reps != null && (p.bestReps == null || a.reps > p.bestReps)) p.bestReps = a.reps;
    if (a.seconds != null && (p.bestSeconds == null || a.seconds > p.bestSeconds)) p.bestSeconds = a.seconds;
  }
  for (const s of tree.skills) {
    const p = per.get(s.id);
    p.status = p.achievedAt ? 'achieved' : (s.requires.every(r => per.get(r).achievedAt) ? 'unlocked' : 'locked');
  }
  return per;
}

const levelOf = (tree, st) => Math.max(0, ...tree.skills.filter(s => st.get(s.id).status === 'achieved').map(s => tree.depth.get(s.id)));

/** Skills that this one's achievement would make unlocked (all other prereqs already met). */
function newlyUnlockedBy(tree, st, skillId) {
  return (tree.children.get(skillId) || [])
    .map(id => tree.byId.get(id))
    .filter(c => st.get(c.id).status !== 'achieved' && c.requires.every(r => r === skillId || st.get(r).achievedAt));
}

// ── Formatting ───────────────────────────────────────────────────────────────

function formatCriterion(c) {
  const amount = c.hold ? `${c.hold} s` : `${c.reps}`;
  return `${c.sets} × ${amount}${c.perSide ? ' each side' : ''}${c.note ? ` (${c.note})` : ''}`;
}

/** Plain-JSON view of a skill for the API: criterion text, content link, status. */
function describeSkill(tree, st, have, s) {
  const p = st.get(s.id);
  return {
    id: s.id, name: s.name, line: s.line, status: p.status,
    equipment: s.equipment, equipmentOk: missingEquipment(s, have).length === 0,
    missingEquipment: missingEquipment(s, have),
    how: s.how, criterion: s.criterion, criterionText: formatCriterion(s.criterion),
    requires: s.requires, requiresNames: s.requires.map(r => tree.byId.get(r).name),
    unlocks: (tree.children.get(s.id) || []), caveat: s.caveat || null, longTerm: !!s.longTerm,
    ref: s.ref ? { file: s.ref.file, rung: s.ref.rung, path: `content/calisthenics/${s.ref.file}` } : null,
    depth: tree.depth.get(s.id),
    achievedAt: p.achievedAt, attempts: p.attempts, bestReps: p.bestReps, bestSeconds: p.bestSeconds,
    last: p.lastAttempt ? { date: p.lastAttempt.date, result: p.lastAttempt.result, reps: p.lastAttempt.reps, seconds: p.lastAttempt.seconds } : null,
  };
}

// ── Finding a skill or line from words ───────────────────────────────────────

/**
 * @returns {{skill?:object, line?:string, candidates?:object[]}|null}
 * Exact id / name / alias first, then a line (its title or alias), then a
 * fuzzy token match. More than one equally good fuzzy match is returned as
 * candidates so the bot asks rather than picking one silently.
 */
function findSkill(tree, query) {
  const q = norm(query);
  if (!q) return null;
  const exact = tree.skills.filter(s => s.id === String(query).trim().toLowerCase() || norm(s.id) === q || norm(s.name) === q || (s.aliases || []).some(a => norm(a) === q));
  if (exact.length === 1) return { skill: exact[0] };
  if (exact.length > 1) return { candidates: exact };
  for (const [line, meta] of Object.entries(LINES)) {
    if (norm(meta.title) === q || line === q || meta.aliases.some(a => norm(a) === q)) return { line };
  }
  const qt = new Set(q.split(' '));
  const scored = tree.skills.map(s => {
    const names = [s.name, ...(s.aliases || [])].map(norm);
    let best = 0;
    for (const n of names) {
      if (n.includes(q) || q.includes(n)) best = Math.max(best, 0.8);
      const nt = n.split(' ');
      const hit = nt.filter(t => qt.has(t)).length;
      best = Math.max(best, hit / Math.max(nt.length, qt.size));
    }
    return { s, best };
  }).filter(x => x.best >= 0.5).sort((a, b) => b.best - a.best);
  if (!scored.length) return null;
  const top = scored.filter(x => x.best === scored[0].best);
  return top.length === 1 ? { skill: top[0].s } : { candidates: top.slice(0, 5).map(x => x.s) };
}

// ── Progression view ─────────────────────────────────────────────────────────

/** Every prerequisite of `id` (transitively), in an order where each comes after its own prerequisites. */
function ancestorsInOrder(tree, id) {
  const seen = new Set(), order = [];
  const walk = x => {
    if (seen.has(x)) return;
    seen.add(x);
    for (const r of tree.byId.get(x).requires) walk(r);
    order.push(x);
  };
  walk(id);
  return order; // ends with id itself
}

/**
 * The route to a skill with the user's position on it. `position` is the first
 * step on the route that is not yet achieved and is unlocked - "work on this".
 */
function progressionTo(tree, st, have, id) {
  const route = ancestorsInOrder(tree, id).map(x => describeSkill(tree, st, have, tree.byId.get(x)));
  const position = route.find(s => s.status === 'unlocked') || null;
  const target = route[route.length - 1];
  return {
    target, route, position,
    next: (tree.children.get(id) || []).map(x => describeSkill(tree, st, have, tree.byId.get(x))),
    done: target.status === 'achieved',
  };
}

function progressionLine(tree, st, have, line) {
  const skills = tree.skills.filter(s => s.line === line).map(s => describeSkill(tree, st, have, s));
  return { line, title: LINES[line].title, skills, position: skills.find(s => s.status === 'unlocked' && s.equipmentOk) || skills.find(s => s.status === 'unlocked') || null };
}

// ── Random picks ─────────────────────────────────────────────────────────────

function pickWeighted(items, weightOf, rng = Math.random) {
  const ws = items.map(weightOf);
  const total = ws.reduce((a, b) => a + b, 0);
  if (!items.length || total <= 0) return null;
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r < 0) return items[i]; }
  return items[items.length - 1];
}

/**
 * "A new skill to work towards".
 * Pool: every unlocked, not-achieved skill (weight 4), plus locked skills that
 * are exactly one step beyond the unlocked ones - every missing prerequisite is
 * itself unlocked (weight 1) - so a goal can sit a little ahead of today. Skills
 * the user's equipment allows are used if there are any; otherwise the pool is
 * widened and each pick carries what it needs.
 */
function randomNew(tree, st, have, rng = Math.random) {
  const unlocked = tree.skills.filter(s => st.get(s.id).status === 'unlocked');
  const oneAhead = tree.skills.filter(s => st.get(s.id).status === 'locked'
    && s.requires.filter(r => !st.get(r).achievedAt).every(r => st.get(r).status === 'unlocked'));
  const pool = [...unlocked.map(s => ({ s, w: 4 })), ...oneAhead.map(s => ({ s, w: 1 }))];
  return finishPick(tree, st, have, pool, rng);
}

/**
 * "A skill I can learn today": strictly unlocked, and near the user's level -
 * depth within one of the deepest thing they have achieved. Skills at the
 * frontier (depth level+1) weigh 3, the same depth 2, anything shallower 1
 * (a quick revisit), anything deeper is not offered.
 */
function randomToday(tree, st, have, rng = Math.random) {
  const level = levelOf(tree, st);
  let cands = tree.skills.filter(s => st.get(s.id).status === 'unlocked' && tree.depth.get(s.id) <= level + 1);
  if (!cands.length) cands = tree.skills.filter(s => st.get(s.id).status === 'unlocked');
  const pool = cands.map(s => {
    const dd = tree.depth.get(s.id);
    return { s, w: dd >= level + 1 ? 3 : dd >= level ? 2 : 1 };
  });
  return finishPick(tree, st, have, pool, rng);
}

function finishPick(tree, st, have, pool, rng) {
  const allowed = pool.filter(x => missingEquipment(x.s, have).length === 0);
  const usable = allowed.length ? allowed : pool;
  const pick = pickWeighted(usable, x => x.w, rng);
  if (!pick) return null;
  const view = describeSkill(tree, st, have, pick.s);
  view.missingPrerequisites = pick.s.requires.filter(r => !st.get(r).achievedAt).map(r => tree.byId.get(r).name);
  return { skill: view, equipmentFallback: !allowed.length, poolSize: usable.length };
}

// ── Summary ──────────────────────────────────────────────────────────────────

function summary(tree, st, have) {
  const by = status => tree.skills.filter(s => st.get(s.id).status === status);
  const view = s => describeSkill(tree, st, have, s);
  const achieved = by('achieved').sort((a, b) => st.get(a.id).achievedAt.localeCompare(st.get(b.id).achievedAt)).map(view);
  const unlocked = by('unlocked').map(view);
  return {
    total: tree.skills.length, achieved,
    inProgress: unlocked.filter(s => s.attempts > 0),
    available: unlocked.filter(s => s.attempts === 0),
    lockedCount: by('locked').length, level: levelOf(tree, st),
  };
}

module.exports = {
  KNOWN_EQUIPMENT, DEFAULT_EQUIPMENT, LINES,
  loadTree, validate, normalizeEquipment, effectiveEquipment, missingEquipment,
  statusMap, newlyUnlockedBy, levelOf, formatCriterion, describeSkill,
  findSkill, progressionTo, progressionLine, ancestorsInOrder,
  pickWeighted, randomNew, randomToday, summary, ladderRungs,
};
