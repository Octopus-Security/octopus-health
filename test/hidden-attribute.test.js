'use strict';
/**
 * The `hidden` attribute must actually hide.
 *
 * The browser's own `[hidden]{display:none}` is a UA rule, so ANY author rule
 * setting `display` on the same element outranks it and the element stays on
 * screen. In octopus-science that single mistake produced three unrelated-looking
 * bugs at once — a placeholder stuck behind a molecule, an upload progress bar
 * that never went away, and three tab panels rendering stacked, which made the
 * tabs look like they did nothing. The user reported the last one and then
 * apologised for it, which is the worst outcome a bug can have.
 *
 * Nothing in this repo sets `display` on a hidden-toggled element today. This
 * asserts the guard is there anyway, so that adding one later cannot reopen it.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'public/theme.css'), 'utf8');

const rules = css => {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(m => [m[1].trim().replace(/\s+/g, ' '), m[2]]);
};

test('the hidden attribute outranks every display rule in the sheet', () => {
  const all = rules(CSS);

  const guard = all.find(([sel, body]) =>
    /(^|,)\s*\[hidden\]\s*($|,)/.test(sel) && /display\s*:\s*none\s*!important/.test(body));
  assert.ok(guard, 'public/theme.css must state [hidden]{display:none!important}');

  // Positive control: without a display rule anywhere, the assertion above
  // would be guarding nothing and would keep passing after it stopped working.
  const setsDisplay = all.filter(([sel, body]) =>
    !/\[hidden\]/.test(sel) && /(^|;)\s*display\s*:/.test(body));
  assert.ok(setsDisplay.length > 0, 'no rule sets display, so this test asserts nothing');

  // The one thing that would still beat the guard.
  const beatsGuard = setsDisplay.filter(([, body]) => /display\s*:[^;]*!important/.test(body));
  assert.deepStrictEqual(beatsGuard.map(r => r[0]), [],
    'an !important display outside [hidden] outranks the guard and can pin an element open');
});
