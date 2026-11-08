'use strict';

/**
 * The octopus-mma snapshot (scripts/snapshot-mma.mjs): format compatibility with health's engine,
 * the catalogue matching the files, and drift against mma main when a sibling checkout exists.
 * The drift check follows mma #6's equipment-ids idea: it is a check you run, skipped when there is
 * no sibling checkout, not a guarantee.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const SF = require('../public/stick-figure.js');
const cat = require('../lib/mma-moves.json');
const dir = path.join(root, 'public', 'poses', 'mma');

const PARTNER_MOVES = ['bjj-armbar', 'bjj-guard', 'bjj-mount', 'bjj-side-control', 'bjj-triangle-choke',
  'muay-thai-clinch-knee', 'muay-thai-long-guard', 'muay-thai-parry', 'wrestling-double-leg-takedown'];

test('every snapshotted pose passes health\'s own validator, two-figure ones included', () => {
  assert.ok(cat.moves.length >= 50);
  for (const m of cat.moves) {
    const raw = fs.readFileSync(path.join(root, 'public', 'poses', m.poseKey + '.json'), 'utf8');
    assert.deepStrictEqual(SF.validate(JSON.parse(raw)), [], m.id);
  }
});

test('the nine partner moves are in, and are the ones drawn with a second figure', () => {
  const have = cat.moves.filter(m => /"partner"/.test(fs.readFileSync(path.join(root, 'public', 'poses', m.poseKey + '.json'), 'utf8'))).map(m => m.id).sort();
  assert.deepStrictEqual(have, PARTNER_MOVES);
});

test('the BJJ techniques, whose text has no "Steps" heading, still carry their steps', () => {
  for (const id of PARTNER_MOVES.filter(i => i.startsWith('bjj-'))) {
    const m = cat.moves.find(x => x.id === id);
    assert.ok(m.steps.length >= 2 && m.keyPoints.length, id);
  }
});

test('catalogue and files agree, ids are unique, text is present', () => {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
  assert.deepStrictEqual(files, cat.moves.map(m => m.id).sort());
  assert.strictEqual(new Set(cat.moves.map(m => m.id)).size, cat.moves.length);
  for (const m of cat.moves) { assert.ok(m.title && m.summary && m.steps.length, m.id); assert.strictEqual(m.poseKey, 'mma/' + m.id); }
  assert.ok(cat.sourceCommit && /^[0-9a-f]{40}$/.test(cat.sourceCommit));
});

test('moves left out are listed with a reason, never dropped silently', () => {
  assert.ok(cat.skipped.length > 0);
  for (const s of cat.skipped) assert.ok(s.id && s.reason, JSON.stringify(s));
  // The switch kick is the only one left out: health's validator is right about it (see SESSIONS.md).
  assert.deepStrictEqual(cat.skipped.map(s => s.id), ['muay-thai-switch-kick']);
  const ids = new Set(cat.moves.map(m => m.id));
  for (const s of cat.skipped) assert.ok(!ids.has(s.id));
});

test('drift: the snapshot matches octopus-mma main (skipped without a sibling checkout)', (t) => {
  const mma = path.join(root, '..', 'octopus-mma');
  if (!fs.existsSync(path.join(mma, '.git'))) return t.skip('no sibling octopus-mma checkout');
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'snapshot-mma.mjs'), '--check'], { encoding: 'utf8' });
  if (/unknown revision|fatal/.test(r.stderr || '')) return t.skip('octopus-mma has no main branch here');
  assert.strictEqual(r.status, 0, r.stdout + r.stderr + '\nrun: node scripts/snapshot-mma.mjs');
});
