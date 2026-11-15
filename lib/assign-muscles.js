'use strict';

// Turn a logged name into an exercise that has muscles, on THIS account only.
// The caller passes the row whose name matches, if there is one. A catalogue
// row that already has muscles is left alone. A stretch mark is only for a
// name the person added, or a name that is not in the library yet.

const M = require('./muscles');

function plan(existing, body) {
  const src = body || {};
  const name = String(src.name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!name) return { ok: false, status: 400, error: 'Name the exercise.' };
  if (src.as === 'stretch') {
    if (existing && !existing.isCustom) {
      return { ok: false, status: 409, error: 'A catalogue exercise stays as it is.' };
    }
    return { ok: true, name, create: !existing, stretch: true, fields: { category: 'recovery', primaryMuscles: [], secondaryMuscles: [] } };
  }
  const primaryMuscles = M.normalize(src.primaryMuscles).muscles;
  const secondaryMuscles = M.normalize(src.secondaryMuscles).muscles.filter((m) => !primaryMuscles.includes(m));
  if (!primaryMuscles.length) {
    return { ok: false, status: 400, error: 'Pick at least one muscle the map knows. Nothing is guessed.' };
  }
  if (existing && !existing.isCustom && M.normalize(existing.primaryMuscles).muscles.length) {
    return { ok: false, status: 409, error: 'That catalogue exercise already has muscles.' };
  }
  return { ok: true, name, create: !existing, stretch: false, fields: { primaryMuscles, secondaryMuscles } };
}

function pack(row, fields) {
  return {
    id: row.id,
    name: row.name,
    category: fields.category || row.category,
    equipment: row.equipment,
    primaryMuscles: fields.primaryMuscles,
    secondaryMuscles: fields.secondaryMuscles,
    isCustom: !!row.isCustom,
  };
}

async function apply(ExerciseDefinition, body) {
  const name = String((body && body.name) || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!name) return { ok: false, status: 400, error: 'Name the exercise.' };
  const seq = ExerciseDefinition.sequelize;
  const byName = await ExerciseDefinition.findOne({
    where: seq.where(seq.fn('lower', seq.col('name')), name.toLowerCase()),
  });
  let existing = byName;
  const id = body && body.exerciseId != null ? Number(body.exerciseId) : null;
  if (Number.isInteger(id)) {
    const byId = await ExerciseDefinition.findByPk(id);
    if (byId && String(byId.name).toLowerCase() === name.toLowerCase()) existing = byId;
  }
  const decided = plan(existing, { ...body, name });
  if (!decided.ok) return decided;
  const stored = {
    primaryMuscles: JSON.stringify(decided.fields.primaryMuscles),
    secondaryMuscles: JSON.stringify(decided.fields.secondaryMuscles),
  };
  if (decided.stretch) stored.category = 'recovery';
  if (!existing) {
    const row = await ExerciseDefinition.create({
      name,
      category: decided.stretch ? 'recovery' : 'strength',
      equipment: 'none',
      instructions: null,
      videoUrl: null,
      poseKey: null,
      isCustom: true,
      ...stored,
    });
    return { ok: true, created: true, exercise: pack(row, decided.fields) };
  }
  // A stretch the person added can be put back on the map by picking muscles.
  // A catalogue recovery row stays a stretch.
  if (!decided.stretch && existing.isCustom && existing.category === 'recovery') stored.category = 'strength';
  await existing.update(stored);
  return { ok: true, created: false, exercise: pack(existing, decided.fields) };
}

module.exports = { plan, apply };
