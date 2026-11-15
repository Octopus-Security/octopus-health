'use strict';

// What a person may store on an exercise they add. Muscles are canonical ids
// from lib/muscles.js. A word the map does not know is dropped, never guessed
// into a nearby muscle. Publication requires at least one primary muscle.

const M = require('./muscles');
const POSE_KEYS = new Set(require('../public/pose-map').keys());

const CATEGORIES = ['strength', 'conditioning', 'cardio', 'mma', 'bjj', 'muay_thai', 'recovery'];
const EQUIPMENT = ['barbell', 'dumbbell', 'landmine', 'plate', 'dip_belt', 'ab_straps', 'cable_machine', 'machine', 'bodyweight', 'bag', 'pads', 'cardio_machine', 'none'];

function clean(body, { requireMuscles = false } = {}) {
  const src = body || {};
  const name = String(src.name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!name) return { ok: false, status: 400, error: 'Name the exercise.' };
  const category = CATEGORIES.includes(src.category) ? src.category : null;
  const equipment = EQUIPMENT.includes(src.equipment) ? src.equipment : null;
  if (!category || !equipment) return { ok: false, status: 400, error: 'Choose a category and the equipment.' };
  const primaryNorm = M.normalize(src.primaryMuscles);
  const secondaryNorm = M.normalize(src.secondaryMuscles);
  const primaryMuscles = primaryNorm.muscles;
  const secondaryMuscles = secondaryNorm.muscles.filter((m) => !primaryMuscles.includes(m));
  if (requireMuscles && !primaryMuscles.length) {
    return { ok: false, status: 400, error: 'Pick at least one muscle the map knows. Nothing is guessed.' };
  }
  const has = (key) => Object.prototype.hasOwnProperty.call(src, key);
  // Omitted optional fields stay undefined so a later save (the body-map
  // publish button does not send a pose) does not wipe what was stored.
  let videoUrl;
  if (has('videoUrl')) {
    videoUrl = String(src.videoUrl || '').trim();
    if (videoUrl && !/^https?:\/\//i.test(videoUrl)) {
      return { ok: false, status: 400, error: 'The video link has to start with http:// or https://.' };
    }
    videoUrl = videoUrl.slice(0, 500) || null;
  }
  let poseKey;
  if (has('poseKey')) {
    poseKey = String(src.poseKey || '').trim();
    if (poseKey && !POSE_KEYS.has(poseKey)) poseKey = '';
    poseKey = poseKey || null;
  }
  let instructions;
  if (has('instructions')) instructions = String(src.instructions || '').replace(/\u0000/g, '').slice(0, 4000) || null;
  return {
    ok: true,
    exercise: {
      name,
      category,
      equipment,
      primaryMuscles,
      secondaryMuscles,
      instructions,
      videoUrl,
      poseKey,
    },
  };
}

module.exports = { clean, CATEGORIES, EQUIPMENT };
