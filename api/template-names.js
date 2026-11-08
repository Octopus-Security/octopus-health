'use strict';

/**
 * A human name for a workout template. Plans are stored under a slug ("fri:gym"), and
 * a template saved without a label (or whose label IS the slug) used to be listed as
 * that slug. The label wins when there is a real one; otherwise the slug is spelled out.
 */

const DAY_NAMES = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };
const SLUG = /^(sun|mon|tue|wed|thu|fri|sat):([a-z][a-z0-9_-]{0,23})$/;

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/** "fri:gym" -> "Friday (Gym)"; "mon:work-gym" -> "Monday (Work gym)"; anything else unchanged. */
function prettySlug(name) {
  const m = SLUG.exec(String(name || ''));
  if (!m) return String(name || '');
  return `${DAY_NAMES[m[1]]} (${cap(m[2].replace(/[-_]+/g, ' '))})`;
}

/** `meta` is the parsed description object (or null). */
function displayName(name, meta) {
  const label = meta && typeof meta.label === 'string' ? meta.label.trim() : '';
  if (label && label !== name) return label;
  return prettySlug(name);
}

module.exports = { displayName, prettySlug, DAY_NAMES };
