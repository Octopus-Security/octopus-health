'use strict';

// Custom exercises: save on the signed-in account, and optionally ask an
// admin to add the same exercise to the shared catalogue. The admin page
// lists pending requests. Anyone else gets 404.

const fields = require('../lib/exercise-fields');
const { saveCustom, addCatalogueCopy } = require('../lib/exercise-save');
const catalogue = require('./catalogue-db');

const isAdmin = (req) => !!(req.user && req.user.role === 'admin');

function jsonError(res, status, error) {
  res.status(status).json({ success: false, error });
}

module.exports = (app, { requireLogin, getDatabase }) => {
  app.post('/library/api/exercises', requireLogin, async (req, res) => {
    try {
      const body = req.body || {};
      const publish = body.requestPublication === true || body.requestPublication === 'true';
      const clean = fields.clean(body, { requireMuscles: publish });
      if (!clean.ok) return jsonError(res, clean.status, clean.error);
      const { ExerciseDefinition } = getDatabase(req.user.username);
      const saved = await saveCustom(ExerciseDefinition, clean.exercise);
      if (!saved.ok) return jsonError(res, saved.status, saved.error);
      let publication = null;
      if (publish) publication = await catalogue.submit(req.user.username, clean.exercise);
      const row = saved.row;
      res.status(201).json({
        success: true,
        data: {
          ...row.toJSON(),
          primaryMuscles: clean.exercise.primaryMuscles,
          secondaryMuscles: clean.exercise.secondaryMuscles,
        },
        publication,
      });
    } catch (e) {
      console.error('save exercise failed:', e.message);
      jsonError(res, 500, 'could not save the exercise');
    }
  });

  app.get('/library/review', requireLogin, async (req, res) => {
    if (!isAdmin(req)) return res.status(404).send('Not found');
    let pending = [];
    try { pending = await catalogue.pendingList(); } catch (e) { console.error('review list failed:', e.message); }
    res.locals.activeTab = 'review';
    res.render('catalogue-review', { title: 'Catalogue review', user: req.user, pending });
  });

  app.post('/library/review/:id', requireLogin, async (req, res) => {
    if (!isAdmin(req)) return res.status(404).send('Not found');
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).send('Not found');
    const approve = req.body && (req.body.decision === 'approve');
    const note = req.body && req.body.note ? String(req.body.note).slice(0, 500) : '';
    try {
      const decided = await catalogue.decide(id, { approve, decidedBy: req.user.username, note });
      if (!decided) return res.status(404).send('Not found');
      if (approve && decided.exercise) {
        const { ExerciseDefinition } = getDatabase(req.user.username);
        await addCatalogueCopy(ExerciseDefinition, decided.exercise);
      }
    } catch (e) {
      console.error('review decision failed:', e.message);
      return res.status(500).send('Could not save that decision.');
    }
    res.redirect('/library/review');
  });
};
