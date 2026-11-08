'use strict';

/**
 * body-map.js - the clickable body diagram and the JSON behind it.
 * Mounted from index.js with the app's own requireLogin, so it sits behind the
 * same sign-in and app-access gate as /workout/api/exercises, and every handler
 * opens getDatabase(req.user.username) and nothing else: one account's custom
 * exercises can never appear for another (each account is its own sqlite file).
 *
 *   GET /body                                   the page
 *   GET /body/api/exercises?muscle=<id>         stretches + exercises for a muscle
 *   GET /body/api/exercises?joint=<id>          ... for a joint (muscles that cross it)
 *
 * Internal to the browser only. There is deliberately no service-token endpoint
 * for other apps yet (octopus-mma will get one later).
 */

const M = require('../lib/muscles');
const GEOMETRY = require('../lib/body-geometry.json');

module.exports = (app, { requireLogin, getDatabase }) => {
  app.get('/body', requireLogin, (req, res) => {
    res.render('body', {
      title: 'Body Map',
      user: req.user,
      vocab: M.publicVocabulary(),
      geometry: GEOMETRY,
    });
  });

  app.get('/body/api/exercises', requireLogin, async (req, res) => {
    const { muscle, joint } = req.query;
    if (!!muscle === !!joint) {
      return res.status(400).json({ success: false, error: 'give exactly one of muscle or joint' });
    }
    const kind = muscle ? 'muscle' : 'joint';
    const id = String(muscle || joint);
    if (kind === 'muscle' ? !M.isMuscle(id) : !M.isJoint(id)) {
      return res.status(404).json({ success: false, error: `unknown ${kind}` });
    }

    const { ExerciseDefinition, sequelize } = getDatabase(req.user.username);
    await sequelize.sync();
    const rows = await ExerciseDefinition.findAll({ order: [['name', 'ASC']] });
    const found = M.exercisesFor(kind, id, rows);
    const def = kind === 'muscle' ? M.MUSCLES[id] : M.JOINTS[id];
    res.json({
      success: true,
      target: {
        kind, id, name: def.name,
        ...(kind === 'joint' ? { muscles: M.musclesForJoint(id) } : { joints: M.jointsForMuscle(id) }),
      },
      ...found,
    });
  });
};
