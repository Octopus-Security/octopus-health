const express = require('express');
const getDatabase = require('../../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

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
        const { WorkoutSet, sequelize } = getDatabase(req.user.username);
        await sequelize.sync();
        const { exerciseName, exerciseId, exerciseOrder, setNumber, reps, weight, weightUnit, duration, distance, distanceUnit, rpe, notes } = req.body;
        if (!exerciseName) return res.status(400).json({ success: false, error: 'exerciseName required' });
        const set = await WorkoutSet.create({
            sessionId: req.params.id, exerciseName, exerciseId, exerciseOrder: exerciseOrder || 0,
            setNumber: setNumber || 1, reps, weight, weightUnit: weightUnit || 'lbs',
            duration, distance, distanceUnit, rpe, notes,
        });
        res.status(201).json({ success: true, data: set });
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

module.exports = router;
