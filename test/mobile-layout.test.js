'use strict';
// Guards the mobile layout rules (octopus-kit docs/layout.md "Layout & text rules"),
// the collapsing nav, and the shadow-boxing / shrimp poses.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const css = read('public', 'theme.css');
const rule = (sel) => { const m = css.match(new RegExp('(?:^|\\n)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}')); assert.ok(m, 'missing rule ' + sel); return m[1]; };

test('html and body both paint the background; body clips sideways overflow and uses dvh', () => {
  assert.match(rule('html'), /background: #0d0d0d/);
  const body = rule('body');
  assert.match(body, /background: #0d0d0d/);
  assert.match(body, /overflow-x: clip/);
  assert.match(body, /min-height: 100dvh/);
  assert.match(body, /overflow-wrap: break-word/);
  assert.doesNotMatch(css, /word-break:\s*break-all/);
});

test('form controls cannot be wider than their container and selects truncate', () => {
  const ctl = rule('input, select, textarea');
  assert.match(ctl, /max-width: 100%/);
  assert.match(ctl, /min-width: 0/);
  assert.match(rule('select'), /text-overflow: ellipsis/);
  assert.match(css, /\.ds-preset-row > \*/);
  assert.match(read('public', 'daily-stretches.css'), /#ds-preset \{[^}]*min-width: 0[^}]*max-width: 100%/);
});

test('pre scrolls inside itself, media is capped, inline code wraps a long token', () => {
  assert.match(rule('pre'), /overflow-x: auto/);
  assert.match(rule('img, video, svg'), /max-width: 100%/);
  assert.match(rule('code, kbd'), /overflow-wrap: anywhere/);
});

test('every page has viewport-fit=cover', () => {
  for (const f of fs.readdirSync(path.join(root, 'views')).filter((f) => f.endsWith('.ejs'))) {
    const t = read('views', f);
    if (/name="viewport"/.test(t)) assert.match(t, /viewport-fit=cover/, f);
  }
});

test('the daily card head gap is padding, and the builder buttons use the shared button row', () => {
  assert.match(read('public', 'daily-stretches.css'), /\.ds-head \{[^}]*padding-bottom: var\(--space-3\)/);
  assert.match(read('views', 'stretch.ejs'), /<div class="btn-row"><a href="\/body" class="btn">Body map<\/a>/);
  assert.match(css, /\.btn-row > \.btn[^{]*\{[^}]*width: 100%/);
});

test('nav: accessible menu button, no-JS checkbox fallback, grouped links, logout last', () => {
  const nav = read('views', 'partials', 'nav.ejs');
  assert.match(nav, /aria-expanded="false" aria-controls="nav-panel"/);
  assert.match(nav, /type="checkbox" id="nav-check"/);
  assert.match(nav, /Escape/);
  assert.match(nav, /aria-current="page"/);
  for (const g of ['Training', 'Body', 'Other']) assert.match(nav, new RegExp("label: '" + g + "'"));
  assert.ok(nav.indexOf('href="/logout"') > nav.indexOf('nav-grid'), 'logout after the groups');
  assert.match(css, /\.nav-check:checked ~ \.nav-panel \{ display: flex; \}/);
  assert.match(css, /grid-template-columns: 1fr 1fr/);
  assert.match(css, /min-height: var\(--tap\)/);
});

test('nav renders every link and marks the active one', async () => {
  const ejs = require('ejs');
  const html = await ejs.renderFile(path.join(root, 'views', 'partials', 'nav.ejs'), { activeTab: 'stretch', user: { username: 'x' } });
  assert.strictEqual((html.match(/<a href="\/[a-z-]*"/g) || []).length, 15 + 1 + 1); // 15 links (Today added 2026-10-26) + title + logout
  assert.match(html, /<a href="\/stretch" class="active" aria-current="page">Stretch<\/a>/);
  assert.match(html, /class="nav-current"[^>]*>Stretch</);
});

test('Shadow Boxing has its own pose with real punches; footwork keeps the old one', () => {
  const PM = require('../public/pose-map.js');
  const SF = require('../public/stick-figure.js');
  assert.strictEqual(PM.keyFor('Shadow Boxing', 'muay_thai'), 'shadow-boxing');
  assert.strictEqual(PM.keyFor('Muay Thai Footwork — Triangle', 'muay_thai'), 'fight-stance');
  const data = JSON.parse(read('public', 'poses', 'shadow-boxing.json'));
  assert.deepStrictEqual(SF.validate(data), []);
  const labels = data.frames.map((f) => f.label);
  for (const l of ['Jab', 'Cross', 'Lead hook', 'Rear uppercut', 'Slip', 'Step']) assert.ok(labels.includes(l), l);
  const resolved = SF.resolveFrames(data);
  const at = (l) => resolved[labels.indexOf(l)].pose;
  const jab = at('Jab'), cross = at('Cross');
  assert.ok(Math.abs(jab.forearmL - jab.upperArmL) <= 3, 'jab arm fully extended');
  assert.ok(Math.abs(cross.forearmR - cross.upperArmR) <= 3, 'cross arm fully extended');
  assert.ok(data.frames.find((f) => f.label === 'Jab').highlight.includes('elbowL'));
  assert.ok(data.frames.find((f) => f.label === 'Cross').highlight.includes('elbowR'));
});

test('Hip escape pose is valid and lifts the hips', () => {
  const SF = require('../public/stick-figure.js');
  const data = JSON.parse(read('public', 'poses', 'shrimp.json'));
  assert.deepStrictEqual(SF.validate(data), []);
  const f = SF.resolveFrames(data);
  assert.ok(f[1].pose.root.y < f[0].pose.root.y - 8, 'bridge lifts the hips');
  assert.ok(f[2].pose.root.x < f[0].pose.root.x - 8, 'hips slide back toward the head');
});
