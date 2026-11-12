'use strict';

/**
 * plans-store.js - shareable PLANS: a title, an intro and ordered weeks of days. A day points at one
 * of the SAME owner's sessions (by id) and/or carries free text ("rest", "easy 20 min run").
 *
 * Same three visibilities, token and slug rules as sessions (helpers reused from sessions-store).
 *
 * LIVE REFERENCES. A plan stores session ids, not copies. The public page reads the plan and every
 * referenced session on each request, so editing the plan or any session changes what the same link
 * shows. A deleted session leaves a placeholder day, never a 500.
 *
 * DECISION - a PRIVATE session inside a plan: the PLAN's visibility governs. A day that references
 * a private session still renders that session (title, intro, items; never its tailoring block) to
 * anyone who may open the plan. The session's own link stays 404. The editor says so. A plan may
 * only reference sessions owned by the plan's owner, checked on save AND again on every read.
 *
 * PRIVACY: planPublicView() is a whitelist. Neither the owner, ids, nor any session's `tailoring`
 * reach the template.
 */

const S = require('./sessions-store');

const MAX_WEEKS = 52;
const MAX_DAYS_PER_WEEK = 14;
const MAX_DAYS_TOTAL = 400;

const clip = (v, n) => String(v == null ? '' : v).replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const parse = (text, dflt) => { try { const v = JSON.parse(text); return v == null ? dflt : v; } catch { return dflt; } };
const bad = (msg, status = 400) => { const e = new Error(msg); e.status = status; return e; };
const notFound = () => bad('not found', 404);

function cleanDay(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const n = Number(raw.sessionId);
  const sessionId = Number.isInteger(n) && n > 0 ? n : null;
  const d = { label: clip(raw.label, 60), sessionId, note: clip(raw.note, 600) };
  return d.label || d.sessionId || d.note ? d : null;
}

function cleanWeeks(raw) {
  if (!Array.isArray(raw)) throw bad('weeks must be a list');
  let total = 0;
  const weeks = raw.slice(0, MAX_WEEKS).map((w) => {
    if (!w || typeof w !== 'object') return null;
    const days = (Array.isArray(w.days) ? w.days : []).slice(0, MAX_DAYS_PER_WEEK).map(cleanDay).filter(Boolean);
    total += days.length;
    return { title: clip(w.title, 80), days };
  }).filter(Boolean);
  if (total > MAX_DAYS_TOTAL) throw bad(`a plan holds at most ${MAX_DAYS_TOTAL} days`);
  return weeks;
}

const sessionIds = (weeks) => [...new Set(weeks.flatMap(w => w.days.map(d => d.sessionId).filter(Boolean)))];

/** Every referenced session must belong to `owner`. Missing and foreign are the same answer. */
async function assertOwnSessions(h, owner, weeks) {
  const ids = sessionIds(weeks);
  if (!ids.length) return;
  const rows = await h.SharedSession.findAll({ where: { owner, id: ids }, attributes: ['id'] });
  if (rows.length !== ids.length) throw bad('a day refers to a session that is not yours');
}

function ownerView(row) {
  return {
    id: row.id, title: row.title, intro: row.intro, weeks: parse(row.weeks, []),
    visibility: row.visibility, slug: row.slug || null, token: row.token,
    publishedAt: row.publishedAt, updatedAt: row.updatedAt, createdAt: row.createdAt,
  };
}

async function listOwned(h, owner) {
  return (await h.SharedPlan.findAll({ where: { owner }, order: [['updatedAt', 'DESC']] })).map(ownerView);
}

async function getOwned(h, owner, id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) throw notFound();
  const row = await h.SharedPlan.findOne({ where: { id: n, owner } });
  if (!row) throw notFound();
  return row;
}

async function create(h, owner, body) {
  const b = body || {};
  const weeks = b.weeks === undefined ? [] : cleanWeeks(b.weeks);
  await assertOwnSessions(h, owner, weeks);
  const row = await h.SharedPlan.create({
    owner, title: b.title !== undefined ? (clip(b.title, 120) || 'Untitled plan') : 'Untitled plan',
    intro: clip(b.intro, 2000), weeks: JSON.stringify(weeks), visibility: 'private', token: S.newToken(),
  });
  return ownerView(row);
}

async function update(h, owner, id, body) {
  const row = await getOwned(h, owner, id);
  const b = body || {};
  if (b.weeks !== undefined) { const w = cleanWeeks(b.weeks); await assertOwnSessions(h, owner, w); row.weeks = JSON.stringify(w); }
  if (b.title !== undefined) row.title = clip(b.title, 120) || 'Untitled plan';
  if (b.intro !== undefined) row.intro = clip(b.intro, 2000);
  await row.save();
  return ownerView(row);
}

async function remove(h, owner, id) {
  const row = await getOwned(h, owner, id);
  await row.destroy();
  return { id: row.id };
}

async function setVisibility(h, owner, id, visibility) {
  if (!S.VISIBILITIES.includes(visibility)) throw bad('visibility must be private, unlisted or public');
  const row = await getOwned(h, owner, id);
  row.visibility = visibility;
  if (visibility === 'public') { if (!row.slug) row.slug = S.slugify(row.title || 'plan'); row.publishedAt = row.publishedAt || new Date(); }
  if (visibility === 'private') row.publishedAt = null;
  await row.save();
  return ownerView(row);
}

async function rotateToken(h, owner, id) {
  const row = await getOwned(h, owner, id);
  row.token = S.newToken();
  await row.save();
  return ownerView(row);
}

async function findShared(h, slugOrToken) {
  const k = String(slugOrToken || '');
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(k)) return null;
  const { Op } = require('sequelize');
  return h.SharedPlan.findOne({
    where: { [Op.or]: [
      { slug: k, visibility: 'public' },
      { token: k, visibility: { [Op.in]: ['unlisted', 'public'] } },
    ] },
  });
}

const listPublic = (h) => h.SharedPlan.findAll({ where: { visibility: 'public' }, order: [['publishedAt', 'DESC']] });

/**
 * WHITELIST for a stranger: plan title/intro/visibility/slug and, per day, label, note and the
 * referenced session's title, intro and items (via sessions-store.publicView, re-projected to drop
 * its slug/visibility). Sessions are read now, live, and only if still owned by the plan's owner.
 */
async function planPublicView(h, row) {
  const weeks = parse(row.weeks, []);
  const ids = sessionIds(weeks);
  const rows = ids.length ? await h.SharedSession.findAll({ where: { owner: row.owner, id: ids } }) : [];
  const byId = new Map(rows.map(r => [r.id, S.publicView(r)]));
  return {
    title: row.title, intro: row.intro, visibility: row.visibility, slug: row.slug,
    weeks: weeks.map(w => ({
      title: w.title || '',
      days: w.days.map((d) => {
        const sv = d.sessionId ? byId.get(d.sessionId) : null;
        return {
          label: d.label || '', note: d.note || '',
          missing: !!d.sessionId && !sv,
          session: sv ? { title: sv.title, intro: sv.intro, items: sv.items } : null,
        };
      }),
    })),
  };
}

function cardView(row) {
  const weeks = parse(row.weeks, []);
  return { title: row.title, intro: String(row.intro || '').slice(0, 200), weekCount: weeks.length, slug: row.slug };
}

module.exports = {
  MAX_WEEKS, MAX_DAYS_PER_WEEK, MAX_DAYS_TOTAL, cleanWeeks, ownerView, cardView, planPublicView,
  listOwned, getOwned, create, update, remove, setVisibility, rotateToken, findShared, listPublic,
};
