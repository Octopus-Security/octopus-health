const express = require('express');
const getDatabase = require('../../database');
const { requireUser } = require('../middleware/auth');
const { detectPR, rebuildPRs, bestPerExercise } = require('../pr-detect');

const router = express.Router();
router.use(requireUser);

// ── Exercise library ──────────────────────────────────────────────────────────

router.get('/exercises', async (req, res) => {
    try {
        const { ExerciseDefinition, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const { category, equipment, muscle, q } = req.query;
        const all = await ExerciseDefinition.findAll({ order: [['name', 'ASC']] });
        let exercises = all.map(e => ({
            ...e.toJSON(),
            primaryMuscles:   JSON.parse(e.primaryMuscles   || '[]'),
            secondaryMuscles: JSON.parse(e.secondaryMuscles || '[]'),
        }));
        if (category)  exercises = exercises.filter(e => e.category  === category);
        if (equipment) exercises = exercises.filter(e => e.equipment === equipment);
        if (muscle)    exercises = exercises.filter(e => e.primaryMuscles.includes(muscle) || e.secondaryMuscles.includes(muscle));
        if (q)         exercises = exercises.filter(e => e.name.toLowerCase().includes(q.toLowerCase()));
        res.json({ success: true, data: exercises });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/exercises', async (req, res) => {
    try {
        const { ExerciseDefinition, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const { name, category, equipment, primaryMuscles, secondaryMuscles, instructions, videoUrl } = req.body;
        if (!name || !category || !equipment) return res.status(400).json({ success: false, error: 'name, category, equipment required' });
        const ex = await ExerciseDefinition.create({
            name, category, equipment,
            primaryMuscles:   JSON.stringify(primaryMuscles   || []),
            secondaryMuscles: JSON.stringify(secondaryMuscles || []),
            instructions, videoUrl, isCustom: true,
        });
        res.status(201).json({ success: true, data: ex });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── Workout sessions ──────────────────────────────────────────────────────────

router.get('/sessions', async (req, res) => {
    try {
        const { WorkoutSession, WorkoutSet, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const { limit = 20, offset = 0 } = req.query;
        const sessions = await WorkoutSession.findAll({
            order: [['date', 'DESC'], ['startedAt', 'DESC']],
            limit: parseInt(limit), offset: parseInt(offset),
        });
        const result = await Promise.all(sessions.map(async s => {
            const sets = await WorkoutSet.findAll({ where: { sessionId: s.id }, order: [['exerciseOrder','ASC'],['setNumber','ASC']] });
            const exerciseCount = new Set(sets.map(st => st.exerciseOrder)).size;
            return { ...s.toJSON(), setCount: sets.length, exerciseCount };
        }));
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/sessions', async (req, res) => {
    try {
        const { WorkoutSession, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const { date, type, title, notes } = req.body;
        if (!date || !type) return res.status(400).json({ success: false, error: 'date and type required' });
        const session = await WorkoutSession.create({ date, type, title, notes, startedAt: new Date(), status: 'active' });
        res.status(201).json({ success: true, data: session });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/sessions/:id', async (req, res) => {
    try {
        const { WorkoutSession, WorkoutSet, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const session = await WorkoutSession.findByPk(req.params.id);
        if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
        const sets = await WorkoutSet.findAll({ where: { sessionId: session.id }, order: [['exerciseOrder','ASC'],['setNumber','ASC']] });
        res.json({ success: true, data: { ...session.toJSON(), sets } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/sessions/:id', async (req, res) => {
    try {
        const { WorkoutSession, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const session = await WorkoutSession.findByPk(req.params.id);
        if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
        const fields = ['type','title','notes','effort','duration','status','finishedAt'];
        for (const f of fields) if (req.body[f] !== undefined) session[f] = req.body[f];
        if (req.body.status === 'finished' && !session.finishedAt) session.finishedAt = new Date();
        await session.save();
        res.json({ success: true, data: session });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/sessions/:id', async (req, res) => {
    try {
        const { WorkoutSession, WorkoutSet, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        await WorkoutSet.destroy({ where: { sessionId: req.params.id } });
        await WorkoutSession.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── Sets ──────────────────────────────────────────────────────────────────────

router.post('/sessions/:id/sets', async (req, res) => {
    try {
        const { WorkoutSet, WorkoutSession, PersonalRecord, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const { exerciseName, exerciseId, exerciseOrder, setNumber, reps, weight, weightUnit, duration, distance, distanceUnit, rpe, notes } = req.body;
        if (!exerciseName) return res.status(400).json({ success: false, error: 'exerciseName required' });
        const set = await WorkoutSet.create({
            sessionId: req.params.id, exerciseName, exerciseId, exerciseOrder: exerciseOrder || 0,
            setNumber: setNumber || 1, reps, weight, weightUnit: weightUnit || 'lbs',
            duration, distance, distanceUnit, rpe, notes,
        });

        // Auto-PR detection — shared with the service path, which for months
        // did not do it at all. See api/pr-detect.js.
        let newPR = null;
        try {
            const session = await WorkoutSession.findByPk(req.params.id);
            const sessionDate = session?.date || new Date().toISOString().slice(0, 10);
            newPR = await detectPR({ PersonalRecord },
                { exerciseName, reps, weight, weightUnit, duration, distance, distanceUnit },
                sessionDate);
        } catch (_) { /* don't fail the set save over PR logic */ }

        res.status(201).json({ success: true, data: set, newPR });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/sets/:id', async (req, res) => {
    try {
        const { WorkoutSet, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const set = await WorkoutSet.findByPk(req.params.id);
        if (!set) return res.status(404).json({ success: false, error: 'Set not found' });
        const fields = ['reps','weight','weightUnit','duration','distance','distanceUnit','rpe','notes'];
        for (const f of fields) if (req.body[f] !== undefined) set[f] = req.body[f];
        await set.save();
        res.json({ success: true, data: set });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/sets/:id', async (req, res) => {
    try {
        const { WorkoutSet, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        await WorkoutSet.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── Training plans ────────────────────────────────────────────────────────────

router.get('/plans', async (req, res) => {
    try {
        const { TrainingPlan, TrainingPlanAssignment, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const plans = await TrainingPlan.findAll({ order: [['sport','ASC'],['name','ASC']] });
        const active = await TrainingPlanAssignment.findOne({ where: { status: 'active' }, order: [['createdAt','DESC']] });
        res.json({ success: true, data: plans, activeAssignment: active });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/plans/assign', async (req, res) => {
    try {
        const { TrainingPlanAssignment, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const { planId, startDate } = req.body;
        if (!planId || !startDate) return res.status(400).json({ success: false, error: 'planId and startDate required' });
        await TrainingPlanAssignment.update({ status: 'paused' }, { where: { status: 'active' } });
        const assignment = await TrainingPlanAssignment.create({ planId, startDate, status: 'active' });
        res.status(201).json({ success: true, data: assignment });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /plans/start  { sport?, compDate }  — pick the plan that fits the weeks
// until the comp, back-date the start so the taper lands on comp week, and make it
// the active assignment. One call for "I have a comp on <date>".
router.post('/plans/start', async (req, res) => {
    try {
        const { TrainingPlan, TrainingPlanAssignment, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const { sport = 'bjj', compDate } = req.body;
        if (!compDate) return res.status(400).json({ success: false, error: 'compDate required (YYYY-MM-DD)' });
        const { weeksUntil, selectPlan, alignedStartDate } = require('../plan-select');
        const rows = await TrainingPlan.findAll({ where: { sport } });
        if (!rows.length) return res.status(404).json({ success: false, error: `No ${sport} plans available` });
        const weeks = weeksUntil(compDate);
        const plan = selectPlan(rows.map(r => r.toJSON()), weeks);
        const startDate = alignedStartDate(compDate, plan.durationWeeks);
        await TrainingPlanAssignment.update({ status: 'paused' }, { where: { status: 'active' } });
        const assignment = await TrainingPlanAssignment.create({ planId: plan.id, startDate, status: 'active' });
        res.status(201).json({ success: true, data: {
            plan: plan.name, durationWeeks: plan.durationWeeks, weeksUntil: weeks,
            startDate, compDate, assignment,
        } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/plans/today', async (req, res) => {
    try {
        const { TrainingPlan, TrainingPlanAssignment, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const assignment = await TrainingPlanAssignment.findOne({ where: { status: 'active' } });
        if (!assignment) return res.json({ success: true, data: null });
        const plan = await TrainingPlan.findByPk(assignment.planId);
        if (!plan) return res.json({ success: true, data: null });
        const phases = JSON.parse(plan.phases || '[]');
        const start = new Date(assignment.startDate);
        const today = new Date();
        const weekNumber = Math.floor((today - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
        const dayOfWeek = today.getDay();
        // Find current phase
        let currentPhase = phases[0];
        for (const phase of phases) {
            const [startW, endW] = phase.weeks.split('–').map(Number);
            if (weekNumber >= startW && weekNumber <= endW) { currentPhase = phase; break; }
        }
        const todaySession = currentPhase?.weeklySchedule?.find(d => d.day === dayOfWeek) || null;
        res.json({ success: true, data: { plan: plan.name, phase: currentPhase?.name, weekNumber, todaySession, assignment } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── Exercise Plans ────────────────────────────────────────────────────────────

router.get('/exercise-plans', async (req, res) => {
    try {
        const { ExercisePlan, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const plans = await ExercisePlan.findAll({ order: [['updatedAt', 'DESC']] });
        res.json({ success: true, data: plans.map(p => ({ ...p.toJSON(), items: JSON.parse(p.items || '[]') })) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/exercise-plans', async (req, res) => {
    try {
        const { ExercisePlan, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const { name, type, description, items } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'name required' });
        const plan = await ExercisePlan.create({
            name: name.trim(),
            type: type || 'mobility',
            description: description?.trim() || null,
            items: JSON.stringify(Array.isArray(items) ? items : []),
        });
        res.status(201).json({ success: true, data: { ...plan.toJSON(), items: JSON.parse(plan.items) } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/exercise-plans/:id', async (req, res) => {
    try {
        const { ExercisePlan, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const plan = await ExercisePlan.findByPk(req.params.id);
        if (!plan) return res.status(404).json({ success: false, error: 'Not found' });
        await plan.destroy();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── Exercise history & stats ───────────────────────────────────────────────────

// GET /workout/exercise-history?exercise=<name>&limit=200
router.get('/exercise-history', async (req, res) => {
    try {
        const { WorkoutSet, WorkoutSession, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const { exercise, limit = 200 } = req.query;
        if (!exercise) return res.status(400).json({ success: false, error: 'exercise required' });

        const sets = await WorkoutSet.findAll({
            where: { exerciseName: exercise },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
        });

        const sessionIds = [...new Set(sets.map(s => s.sessionId))];
        const sessions = await WorkoutSession.findAll({ where: { id: sessionIds } });
        const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s.toJSON()]));

        const entries = sets.map(s => ({
            ...s.toJSON(),
            sessionDate: sessionMap[s.sessionId]?.date || null,
            sessionType: sessionMap[s.sessionId]?.type || null,
        }));

        const withWeight   = entries.filter(e => e.weight   != null);
        const withDuration = entries.filter(e => e.duration != null);
        const withReps     = entries.filter(e => e.reps     != null && e.weight == null);

        const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

        const stats = {
            totalSets: entries.length,
            lastDate:  entries[0]?.sessionDate || null,
            pr: {
                maxWeight:   withWeight.length   ? Math.max(...withWeight.map(e => e.weight))     : null,
                minDuration: withDuration.length ? Math.min(...withDuration.map(e => e.duration)) : null,
                maxReps:     withReps.length     ? Math.max(...withReps.map(e => e.reps))         : null,
            },
            averages: {
                weight:   avg(withWeight.map(e => e.weight)),
                duration: avg(withDuration.map(e => e.duration)),
                reps:     avg(withReps.map(e => e.reps)),
            },
            weightUnit:   withWeight[0]?.weightUnit   || 'lbs',
            distanceUnit: entries.find(e => e.distanceUnit)?.distanceUnit || null,
        };

        res.json({ success: true, data: entries, stats });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /workout/prs  — best PR per exercise (most recent win per exercise)
router.get('/prs', async (req, res) => {
    try {
        const { PersonalRecord, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const all = await PersonalRecord.findAll({ order: [['date', 'DESC']] });
        res.json({ success: true, data: bestPerExercise(all.map(pr => pr.toJSON())) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /workout/prs  — manually add a PR
router.post('/prs', async (req, res) => {
    try {
        const { PersonalRecord, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const { exerciseName, weight, weightUnit, reps, durationSecs, date, notes } = req.body;
        if (!exerciseName || !date) return res.status(400).json({ success: false, error: 'exerciseName and date required' });
        const pr = await PersonalRecord.create({ exerciseName, weight, weightUnit: weightUnit || 'lbs', reps, durationSecs, date, notes });
        res.status(201).json({ success: true, data: pr });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /workout/prs/:id
router.delete('/prs/:id', async (req, res) => {
    try {
        const { PersonalRecord, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        await PersonalRecord.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /workout/exercise-names — distinct exercise names from logged sets (for autocomplete)
// POST /workout/prs/rebuild — derive PRs from every set already logged.
//
// Sets logged through the service path (i.e. by talking to Neith) never ran PR
// detection, so an account can hold months of training and show "No PRs yet".
// Fixing the write path only helps future sets; this recovers what is already
// there. Existing PRs are respected, so it is safe to run repeatedly.
router.post('/prs/rebuild', async (req, res) => {
    try {
        const db = getDatabase(req.user.username);
        await db.sequelize.sync();
        const { scanned, created } = await rebuildPRs(db);
        res.json({
            success: true,
            scanned,
            created: created.length,
            prs: created.map(p => ({ exerciseName: p.exerciseName, weight: p.weight, reps: p.reps, durationSecs: p.durationSecs, date: p.date })),
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/exercise-names', async (req, res) => {
    try {
        const { WorkoutSet, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const { Op } = require('sequelize');
        const { q } = req.query;
        const where = q ? { exerciseName: { [Op.like]: `%${q}%` } } : {};
        const rows = await WorkoutSet.findAll({
            where,
            attributes: ['exerciseName'],
            group: ['exerciseName'],
            order: [['exerciseName', 'ASC']],
        });
        res.json({ success: true, data: rows.map(r => r.exerciseName) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
