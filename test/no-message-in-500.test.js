'use strict';
// A 500 answer never carries err.message (HIPAA map, sweep 2026-11-12): a database or validation error
// quotes the value it choked on, which here can be a person's health record. 4xx answers that return a
// deliberate validation message (e.status || 400) are not 500s and are untouched.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'test', 'public', 'data', '.git'].includes(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out); else if (f.name.endsWith('.js')) out.push(p);
  }
  return out;
}

// api/routes/service.js is the service-token API that cortex calls on behalf of Neith; cortex relays its
// error text to the person (and the model) so it can say what failed. It is a machine-to-machine
// surface behind INTERNAL_SECRET, left alone on purpose: tightening it needs cortex to stop depending
// on the text (HIPAA map follow-up).
const MACHINE_API = new Set(['api/routes/service.js']);

test('no handler sends err.message with a literal 500', () => {
  const bad = [];
  for (const file of walk(root)) {
    if (MACHINE_API.has(path.relative(root, file))) continue;
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (/status\(500\)\.(json|send)\(.*\b(err|e|error)\.message/.test(line)) bad.push(`${path.relative(root, file)}:${i + 1}`);
    });
  }
  assert.deepStrictEqual(bad, []);
});
