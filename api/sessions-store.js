'use strict';

/**
 * sessions-store.js - validation, snapshots, ownership and the PUBLIC projection for shareable
 * sessions. Pure rules first, then thin database functions taking the handle from sessions-db.js.
 *
 * Three visibilities:
 *   private   owner only. Default.
 *   unlisted  reachable only through its unguessable token link, noindex, listed nowhere.
 *   public    in the /s storefront and the sitemap, reachable by slug (or token).
 *
 * PRIVACY RULE: publicView() is a WHITELIST. It names the fields a stranger may see and copies
 * only those. `tailoring` (who it is for, goal, limits, equipment) and `owner` are not in it, and
 * must never be added. test/sessions.test.js plants a marker in every tailoring field and proves
 * it is absent from rendered output.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VISIBILITIES = ['private', 'unlisted', 'public'];
const ITEM_TYPES = ['exercise', 'routine', 'mma'];
const MAX_ITEMS = 40;
const TOKEN_BYTES = 24; // 192 bits, base64url -> 32 chars

const POSES_DIR = path.join(__dirname, '..', 'public', 'poses');
const POSE_KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

const newToken = () => crypto.randomBytes(TOKEN_BYTES).toString('base64url');

const clip = (v, n) => String(v == null ? '' : v).replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);

function slugify(title) {
  const base = String(title || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'session';
  return base + '-' + crypto.randomBytes(3).toString('hex');
}

/** A pose key is accepted only if it is well formed AND the file exists, so a typo cannot reach a URL. */
function poseKeyOrNull(k) {
  if (!k || typeof k !== 'string' || !POSE_KEY_RE.test(k)) return null;
  return fs.existsSync(path.join(POSES_DIR, k + '.json')) ? k : null;
}

/**
 * One item as saved. The display name, pose key, cues and instructions are SNAPSHOTS taken when the
 * owner saves: a later rename or fix in the library cannot change (or break) a link already sent.
 * The cost is that a library fix does not reach old sessions until they are re-saved with the
 * item re-picked.
 */
function cleanItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = ITEM_TYPES.includes(raw.type) ? raw.type : null;
  const name = clip(raw.name, 120);
  if (!type || !name) return null;
  const cues = (Array.isArray(raw.cues) ? raw.cues : []).map(c => clip(c, 240)).filter(Boolean).slice(0, 10);
  return {
    type,
    ref: clip(raw.ref, 120),
    name,
    poseKey: poseKeyOrNull(raw.poseKey),
    cues,
    instructions: clip(raw.instructions, 1500),
    dose: clip(raw.dose, 80),   // the owner's own sets / reps / time text
    note: clip(raw.note, 600),  // SHOWN to whoever has the link
  };
}

const TAILORING_FIELDS = { forName: 80, goal: 300, limitsNote: 600, equipmentNote: 300 };

function cleanTailoring(raw) {
  const t = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const [k, n] of Object.entries(TAILORING_FIELDS)) out[k] = clip(t[k], n);
  const ids = (v, n) => (Array.isArray(v) ? v : []).map(x => clip(x, 40)).filter(Boolean).slice(0, n);
  out.focus = ids(t.focus, 12);
  out.limits = ids(t.limits, 12);
  out.equipment = ids(t.equipment, 60);
  return out;
}

function cleanInput(body) {
  const b = body || {};
  const out = {};
  if (b.title !== undefined) out.title = clip(b.title, 120) || 'Untitled session';
  if (b.intro !== undefined) out.intro = clip(b.intro, 2000);
  if (b.items !== undefined) {
    if (!Array.isArray(b.items)) { const e = new Error('items must be a list'); e.status = 400; throw e; }
    out.items = b.items.slice(0, MAX_ITEMS).map(cleanItem).filter(Boolean);
  }
  if (b.tailoring !== undefined) out.tailoring = cleanTailoring(b.tailoring);
  return out;
}

const parse = (text, dflt) => { try { const v = JSON.parse(text); return v == null ? dflt : v; } catch { return dflt; } };

/** Everything the OWNER sees (editor and list). Includes tailoring and the token. */
function ownerView(row) {
  return {
    id: row.id, title: row.title, intro: row.intro,
    items: parse(row.items, []), tailoring: cleanTailoring(parse(row.tailoring, {})),
    visibility: row.visibility, slug: row.slug || null, token: row.token,
    publishedAt: row.publishedAt, updatedAt: row.updatedAt, createdAt: row.createdAt,
  };
}

/**
 * WHITELIST of what a stranger may see. No owner, no id, no tailoring, no timestamps beyond
 * what a page needs. Do not spread `row` into this.
 */
function publicView(row) {
  const items = parse(row.items, []).map(i => ({
    type: i.type, name: i.name, poseKey: i.poseKey || null, cues: i.cues || [],
    instructions: i.instructions || '', dose: i.dose || '', note: i.note || '',
  }));
  return { title: row.title, intro: row.intro, items, visibility: row.visibility, slug: row.slug };
}

/** Storefront card: smaller still. */
function cardView(row) {
  const items = parse(row.items, []);
  return { title: row.title, intro: String(row.intro || '').slice(0, 200), itemCount: items.length, slug: row.slug };
}

// ── database functions ───────────────────────────────────────────────────────

const notFound = () => { const e = new Error('not found'); e.status = 404; return e; };

/** The owner's rows only. A foreign id is indistinguishable from a missing one. */
async function listOwned(h, owner) {
  const rows = await h.SharedSession.findAll({ where: { owner }, order: [['updatedAt', 'DESC']] });
  return rows.map(ownerView);
}

async function getOwned(h, owner, id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) throw notFound();
  const row = await h.SharedSession.findOne({ where: { id: n, owner } });
  if (!row) throw notFound();
  return row;
}

async function create(h, owner, body) {
  const d = cleanInput(body);
  const row = await h.SharedSession.create({
    owner, title: d.title || 'Untitled session', intro: d.intro || '',
    items: JSON.stringify(d.items || []), tailoring: JSON.stringify(d.tailoring || cleanTailoring({})),
    visibility: 'private', token: newToken(),
  });
  return ownerView(row);
}

async function update(h, owner, id, body) {
  const row = await getOwned(h, owner, id);
  const d = cleanInput(body);
  if (d.title !== undefined) row.title = d.title;
  if (d.intro !== undefined) row.intro = d.intro;
  if (d.items !== undefined) row.items = JSON.stringify(d.items);
  if (d.tailoring !== undefined) row.tailoring = JSON.stringify(d.tailoring);
  await row.save();
  return ownerView(row);
}

async function remove(h, owner, id) {
  const row = await getOwned(h, owner, id);
  await row.destroy();
  return { id: row.id };
}

async function setVisibility(h, owner, id, visibility) {
  if (!VISIBILITIES.includes(visibility)) { const e = new Error('visibility must be private, unlisted or public'); e.status = 400; throw e; }
  const row = await getOwned(h, owner, id);
  row.visibility = visibility;
  if (visibility === 'public') {
    if (!row.slug) row.slug = slugify(row.title);
    row.publishedAt = row.publishedAt || new Date();
  }
  if (visibility === 'private') row.publishedAt = null; // link stops resolving at once: lookups require non-private
  await row.save();
  return ownerView(row);
}

/** Replace the link secret: the old link dies immediately. */
async function rotateToken(h, owner, id) {
  const row = await getOwned(h, owner, id);
  row.token = newToken();
  await row.save();
  return ownerView(row);
}

/** PUBLIC lookup: a non-private row by slug (public only) or token (unlisted or public). */
async function findShared(h, slugOrToken) {
  const k = String(slugOrToken || '');
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(k)) return null;
  const { Op } = require('sequelize');
  return h.SharedSession.findOne({
    where: { [Op.or]: [
      { slug: k, visibility: 'public' },
      { token: k, visibility: { [Op.in]: ['unlisted', 'public'] } },
    ] },
  });
}

async function listPublic(h) {
  return h.SharedSession.findAll({ where: { visibility: 'public' }, order: [['publishedAt', 'DESC']] });
}

module.exports = {
  VISIBILITIES, ITEM_TYPES, MAX_ITEMS, TOKEN_BYTES, newToken, slugify, poseKeyOrNull,
  cleanItem, cleanTailoring, cleanInput, ownerView, publicView, cardView,
  listOwned, getOwned, create, update, remove, setVisibility, rotateToken, findShared, listPublic,
};
