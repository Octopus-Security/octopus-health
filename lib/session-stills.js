'use strict';

/**
 * Still diagrams for a pose, drawn on the SERVER by the same engine the browser animates with
 * (public/stick-figure.js). They are what the page shows with no JavaScript and what the browser's
 * "Save as PDF" prints: an animation cannot go on paper, so a few key frames do.
 *
 * Output is SVG markup produced by the engine from our own pose files (a pose key is validated
 * against the files on disk before it is ever stored), so it contains no user text. The frame
 * label is returned separately for the template to escape.
 */

const fs = require('fs');
const path = require('path');
const SF = require('../public/stick-figure');

const POSES = path.join(__dirname, '..', 'public', 'poses');
const MAX_STILLS = 4;
const cache = new Map();

function load(key) {
  const file = path.join(POSES, key + '.json');
  if (!path.resolve(file).startsWith(POSES + path.sep)) return null; // belt and braces; keys are validated on save
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** [{ svg, label }] - up to MAX_STILLS key frames, evenly spread; [] for an unknown or invalid pose. */
function stillsFor(key) {
  if (!key) return [];
  if (cache.has(key)) return cache.get(key);
  let out = [];
  const data = load(key);
  if (data && SF.validate(data).length === 0) {
    const frames = SF.resolveFrames(data);
    const n = frames.length;
    const idx = n <= MAX_STILLS ? frames.map((_, i) => i) : Array.from({ length: MAX_STILLS }, (_, i) => Math.round(i * (n - 1) / (MAX_STILLS - 1)));
    out = [...new Set(idx)].map(i => ({ svg: SF.svgFor(data, i, 0), label: String(frames[i].label || '') }));
  }
  cache.set(key, out);
  return out;
}

module.exports = { stillsFor };
