'use strict';

// Save an exercise onto the signed-in account. A catalogue name is not
// overwritten. The same name, ignoring case, updates the row the person
// already added instead of making a second one.

async function saveCustom(ExerciseDefinition, exercise) {
  const seq = ExerciseDefinition.sequelize;
  const existing = await ExerciseDefinition.findOne({
    where: seq.where(seq.fn('lower', seq.col('name')), exercise.name.toLowerCase()),
  });
  if (existing && !existing.isCustom) {
    return { ok: false, status: 409, error: 'That name is already in the catalogue.' };
  }
  const fields = {
    name: exercise.name,
    category: exercise.category,
    equipment: exercise.equipment,
    primaryMuscles: JSON.stringify(exercise.primaryMuscles || []),
    secondaryMuscles: JSON.stringify(exercise.secondaryMuscles || []),
    isCustom: true,
  };
  if (exercise.instructions !== undefined) fields.instructions = exercise.instructions || null;
  if (exercise.videoUrl !== undefined) fields.videoUrl = exercise.videoUrl || null;
  if (exercise.poseKey !== undefined) fields.poseKey = exercise.poseKey || null;
  const created = !existing;
  if (created) {
    if (fields.instructions === undefined) fields.instructions = null;
    if (fields.videoUrl === undefined) fields.videoUrl = null;
    if (fields.poseKey === undefined) fields.poseKey = null;
  }
  const row = existing ? await existing.update(fields).then(() => existing) : await ExerciseDefinition.create(fields);
  return { ok: true, row, created };
}

// Copy an approved exercise onto an account when that name is not there yet.
// A catalogue row that already has muscles is left as it is.
async function addCatalogueCopy(ExerciseDefinition, exercise) {
  const seq = ExerciseDefinition.sequelize;
  const existing = await ExerciseDefinition.findOne({
    where: seq.where(seq.fn('lower', seq.col('name')), exercise.name.toLowerCase()),
  });
  const muscles = JSON.stringify(exercise.primaryMuscles || []);
  const secondary = JSON.stringify(exercise.secondaryMuscles || []);
  if (!existing) {
    const row = await ExerciseDefinition.create({
      name: exercise.name,
      category: exercise.category || 'strength',
      equipment: exercise.equipment || 'none',
      primaryMuscles: muscles,
      secondaryMuscles: secondary,
      instructions: exercise.instructions || null,
      videoUrl: exercise.videoUrl || null,
      poseKey: exercise.poseKey || null,
      isCustom: false,
    });
    return { ok: true, row, created: true };
  }
  const { normalize } = require('./muscles');
  if (!existing.isCustom && normalize(existing.primaryMuscles).muscles.length) {
    return { ok: true, row: existing, created: false, skipped: true };
  }
  await existing.update({
    category: exercise.category || existing.category,
    equipment: exercise.equipment || existing.equipment,
    primaryMuscles: muscles,
    secondaryMuscles: secondary,
    instructions: exercise.instructions || existing.instructions,
    videoUrl: exercise.videoUrl || existing.videoUrl,
    poseKey: exercise.poseKey || existing.poseKey,
    isCustom: false,
  });
  return { ok: true, row: existing, created: false };
}

module.exports = { saveCustom, addCatalogueCopy };
