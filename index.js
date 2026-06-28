const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { AuthClient } = require('@octopus-security/auth-client');
const axios = require('axios');
const app = express();
// Trust proxy for correct IP detection behind Cloudflare/NGINX
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;
const getDatabase = require('./database');

const auth = new AuthClient();
const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://octopus-auth:3002';

function getActiveTab(requestPath) {
    if (requestPath === '/') return 'dashboard';
    if (requestPath.startsWith('/tools') || requestPath.startsWith('/timers')) return 'tools';
    if (requestPath.startsWith('/exercises') || requestPath.startsWith('/library') || requestPath.startsWith('/exercise') || requestPath.startsWith('/workout') || requestPath.startsWith('/plan-maker')) return 'exercises';
    if (requestPath.startsWith('/stretch') || requestPath.startsWith('/routines')) return 'stretch';
    if (requestPath.startsWith('/nutrition') || requestPath.startsWith('/meals')) return 'nutrition';
    if (requestPath.startsWith('/weight')) return 'weight';
    if (requestPath.startsWith('/goals') || requestPath.startsWith('/planner') || requestPath.startsWith('/plans') || requestPath.startsWith('/accountability')) return 'goals';
    if (requestPath.startsWith('/competitions')) return 'competitions';
    if (requestPath.startsWith('/stats')) return 'stats';
    return '';
}

// ── Periodisation phase helper ────────────────────────────────────────────────
function getPeriodisationPhase(competitionDate) {
    const today = new Date();
    const compDate = new Date(competitionDate);
    const weeksOut = Math.ceil((compDate - today) / (7 * 24 * 60 * 60 * 1000));
    if (weeksOut < 0)  return { phase: 'Past',   color: '#555',     weeksOut };
    if (weeksOut <= 1) return { phase: 'Taper',  color: '#9b59b6',  weeksOut };
    if (weeksOut <= 4) return { phase: 'Peak',   color: '#e74c3c',  weeksOut };
    if (weeksOut <= 8) return { phase: 'Build',  color: '#e67e22',  weeksOut };
    return                    { phase: 'Base',   color: '#2ecc71',  weeksOut };
}


// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', './views');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: './data' }),
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use((req, res, next) => {
    res.locals.user = req.session?.user || null;
    res.locals.activeTab = getActiveTab(req.path);
    next();
});

// Mount API routes (before session-based routes)
const apiRouter = require('./api');
app.use('/api', apiRouter);

// Auth middleware
const requireLogin = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Routes

app.get('/login', (req, res) => {
    const siteKey = process.env.RECAPTCHA_SITE_KEY;
    console.log('RECAPTCHA_SITE_KEY for /login page:', siteKey);
    res.render('login', { title: 'Login', error: null, mode: 'login', siteKey });
});


app.post('/login', async (req, res) => {
    const { username, password, totpCode } = req.body;

    try {
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || '';
        const r = await axios.post(`${AUTH_URL}/api/auth/login`, { username, password, totpCode }, {
            timeout: 5000,
            headers: { 'X-Forwarded-For': clientIp },
        });
        if (r.data.success) {
            req.session.user = { username: r.data.username || username, token: r.data.token };
            const { sequelize, seedData } = getDatabase(req.session.user.username);
            await sequelize.sync();
            await seedData();
            return res.json({ ok: true });
        }
        res.status(401).json({ error: 'Credentials or 2FA incorrect' });
    } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
            return res.status(err.response.status).json({ error: 'Credentials or 2FA incorrect' });
        }
        console.error('Login error:', err.message);
        res.status(503).json({ error: 'Service unavailable' });
    }
});


app.get('/register', (req, res) => {
    res.render('login', { title: 'Register', error: null, mode: 'register', siteKey: process.env.RECAPTCHA_SITE_KEY });
});


app.post('/register', async (req, res) => {
    const { username, password, confirmPassword, inviteCode } = req.body;

    try {
        if (!username || !password || !confirmPassword) {
            return res.render('login', { title: 'Register', error: 'All fields required', mode: 'register', siteKey: process.env.RECAPTCHA_SITE_KEY });
        }

        if (password !== confirmPassword) {
            return res.render('login', { title: 'Register', error: 'Passwords do not match', mode: 'register', siteKey: process.env.RECAPTCHA_SITE_KEY });
        }

        const r = await auth.register(username, password, null, inviteCode);

        if (r.ok && r.data.success) {
            req.session.user = { username, token: r.data.token };
            const { sequelize, seedData } = getDatabase(username);
            await sequelize.sync();
            await seedData();
            res.redirect('/');
        } else {
            res.render('login', { title: 'Register', error: r.data.error || 'Registration failed', mode: 'register', siteKey: process.env.RECAPTCHA_SITE_KEY });
        }
    } catch (error) {
        console.error('Registration error:', error.message);
        res.render('login', { title: 'Register', error: 'Registration failed', mode: 'register', siteKey: process.env.RECAPTCHA_SITE_KEY });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// REST API endpoints for mobile app
app.post('/api/auth/register', async (req, res) => {
    try {
        const r = await auth.register(req.body.username, req.body.password, req.body.email, req.body.inviteCode);
        res.status(r.status).json(r.data);
    } catch (error) {
        res.status(503).json({ success: false, error: 'Auth service unavailable' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const r = await auth.login(req.body.username, req.body.password);
        res.status(r.status).json(r.data);
    } catch (error) {
        res.status(503).json({ success: false, error: 'Auth service unavailable' });
    }
});

// Dashboard
app.get('/', requireLogin, async (req, res) => {
    const { WeightEntry, Exercise, Meal, Goal, Competition, TrainingSession, WorkoutSession, WorkoutSet, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();

    try {
        const todayStr = new Date().toISOString().split('T')[0];

        const recentWeight = await WeightEntry.findOne({ order: [['date', 'DESC']] });
        const todayExercises = await Exercise.findAll({ where: { date: todayStr } });
        const todayMeals = await Meal.findAll({ where: { date: todayStr } });
        const activeGoals = await Goal.findAll({ where: { completed: false } });

        const todayCalories = todayMeals.reduce((sum, meal) => sum + (meal.calories || 0), 0);
        const todayExerciseMinutes = todayExercises.reduce((sum, ex) => sum + ex.duration, 0);

        // Fetch today's WorkoutSessions with their sets for the dashboard detail view
        const rawSessions = await WorkoutSession.findAll({
            where: { date: todayStr, status: 'finished' },
            order: [['startedAt', 'ASC']],
        });
        const todayWorkoutSessions = await Promise.all(rawSessions.map(async s => {
            const sets = await WorkoutSet.findAll({
                where: { sessionId: s.id },
                order: [['exerciseOrder', 'ASC'], ['setNumber', 'ASC']],
            });
            const byExercise = {};
            for (const set of sets) {
                if (!byExercise[set.exerciseOrder]) byExercise[set.exerciseOrder] = { name: set.exerciseName, sets: [] };
                byExercise[set.exerciseOrder].sets.push(set);
            }
            return { ...s.toJSON(), exercises: Object.values(byExercise) };
        }));

        // Upcoming competition widget
        const nextComp = await Competition.findOne({
            where: { isActive: true, date: { [Op.gte]: todayStr } },
            order: [['date', 'ASC']],
        });
        let competitionWidget = null;
        if (nextComp) {
            const phase = getPeriodisationPhase(nextComp.date);
            let regWarning = null;
            if (nextComp.registrationDeadline) {
                const regDays = Math.ceil((new Date(nextComp.registrationDeadline) - new Date()) / (24 * 60 * 60 * 1000));
                if (regDays > 0 && regDays <= 14) regWarning = regDays;
            }
            competitionWidget = { ...nextComp.toJSON(), phase, regWarning };
        }

        // Today's planned sessions
        const todaySessions = await TrainingSession.findAll({ where: { date: todayStr } });

        res.render('index', {
            title: 'Health Tracker Dashboard',
            user: req.session.user,
            recentWeight,
            todayExercises,
            todayMeals,
            activeGoals,
            todayCalories,
            todayExerciseMinutes,
            competitionWidget,
            todaySessions,
            todayWorkoutSessions,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading dashboard');
    }
});

app.get('/tools', requireLogin, (req, res) => {
    res.render('tools', { title: 'Tools', user: req.session.user });
});

// Weight tracking routes
app.get('/weight', requireLogin, async (req, res) => {
    const { WeightEntry } = getDatabase(req.session.user.username);
    const entries = await WeightEntry.findAll({
        order: [['date', 'DESC']],
    });
    res.render('weight', { title: 'Weight Tracking', entries, user: req.session.user });
});

app.post('/weight', requireLogin, async (req, res) => {
    const { WeightEntry } = getDatabase(req.session.user.username);
    await WeightEntry.create(req.body);
    res.redirect('/weight');
});

app.post('/weight/edit/:id', requireLogin, async (req, res) => {
    const { WeightEntry } = getDatabase(req.session.user.username);
    const { date, weight, unit, notes } = req.body;
    await WeightEntry.update(
        { date, weight, unit, notes },
        { where: { id: req.params.id } }
    );
    res.redirect('/weight');
});

app.post('/weight/delete/:id', requireLogin, async (req, res) => {
    const { WeightEntry } = getDatabase(req.session.user.username);
    await WeightEntry.destroy({ where: { id: req.params.id } });
    res.redirect('/weight');
});

// Exercise tracking routes
app.get('/exercise', requireLogin, async (req, res) => {
    const { Exercise } = getDatabase(req.session.user.username);
    const exercises = await Exercise.findAll({ 
        order: [['date', 'DESC']], 
        limit: 30 
    });
    res.render('exercise', { title: 'Exercise Tracking', exercises, user: req.session.user });
});

app.post('/exercise', requireLogin, async (req, res) => {
    const { Exercise } = getDatabase(req.session.user.username);
    await Exercise.create(req.body);
    res.redirect('/exercise');
});

app.get('/nutrition', requireLogin, async (req, res) => {
    const { Meal } = getDatabase(req.session.user.username);
    const meals = await Meal.findAll({
        order: [['date', 'DESC'], ['time', 'DESC']],
        limit: 30
    });
    res.render('meals', { title: 'Nutrition', meals, user: req.session.user });
});

app.post('/exercise/delete/:id', requireLogin, async (req, res) => {
    const { Exercise } = getDatabase(req.session.user.username);
    await Exercise.destroy({ where: { id: req.params.id } });
    res.redirect('/exercise');
});

// Meal/Food tracking routes
app.get('/meals', requireLogin, async (req, res) => {
    const { Meal } = getDatabase(req.session.user.username);
    const meals = await Meal.findAll({ 
        order: [['date', 'DESC'], ['time', 'DESC']], 
        limit: 30 
    });
    res.render('meals', { title: 'Food Tracking', meals, user: req.session.user });
});

app.post('/meals', requireLogin, async (req, res) => {
    const { Meal } = getDatabase(req.session.user.username);
    await Meal.create(req.body);
    res.redirect('/meals');
});

app.post('/meals/delete/:id', requireLogin, async (req, res) => {
    const { Meal } = getDatabase(req.session.user.username);
    await Meal.destroy({ where: { id: req.params.id } });
    res.redirect('/meals');
});

// Goals routes
app.get('/goals', requireLogin, async (req, res) => {
    const { Goal } = getDatabase(req.session.user.username);
    const goals = await Goal.findAll({ order: [['completed', 'ASC'], ['deadline', 'ASC']] });
    res.render('goals', { title: 'Goals', goals, user: req.session.user });
});

app.post('/goals', requireLogin, async (req, res) => {
    const { Goal } = getDatabase(req.session.user.username);
    await Goal.create(req.body);
    res.redirect('/goals');
});

app.post('/goals/toggle/:id', requireLogin, async (req, res) => {
    const { Goal } = getDatabase(req.session.user.username);
    const goal = await Goal.findByPk(req.params.id);
    goal.completed = !goal.completed;
    await goal.save();
    res.redirect('/goals');
});

app.post('/goals/delete/:id', requireLogin, async (req, res) => {
    const { Goal } = getDatabase(req.session.user.username);
    await Goal.destroy({ where: { id: req.params.id } });
    res.redirect('/goals');
});

// API endpoints for charts
app.get('/api/weight-data', requireLogin, async (req, res) => {
    const { WeightEntry } = getDatabase(req.session.user.username);
    const entries = await WeightEntry.findAll({ 
        order: [['date', 'ASC']], 
        limit: 90 
    });
    res.json(entries);
});

// User settings routes
app.get('/settings', requireLogin, (req, res) => {
    res.render('settings', { title: 'Account Settings', user: req.session.user, error: null, success: null });
});

app.post('/settings/change-password', requireLogin, async (req, res) => {
    // Password updates are managed by the centralized auth service.
    res.render('settings', {
        title: 'Account Settings',
        user: req.session.user,
        error: 'Password changes are handled by octopus-auth and are not available from this app yet.',
        success: null
    });
});

app.post('/settings/delete-account', requireLogin, async (req, res) => {
    res.render('settings', {
        title: 'Account Settings',
        user: req.session.user,
        error: 'Account deletion must be performed via octopus-auth and is not available from this app yet.',
        success: null
    });
});

// ── Routines (warmup / stretching / cooldown) ─────────────────────────────────

function parseRoutineItems(itemsText) {
    try {
        return JSON.parse(itemsText || '[]');
    } catch {
        return [];
    }
}

function mapRoutineForClient(routine) {
    return {
        ...routine.toJSON(),
        itemsList: parseRoutineItems(routine.items),
    };
}

app.get('/stretch', requireLogin, async (req, res) => {
    const { Routine, ExerciseDefinition, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();

    const all = await Routine.findAll({ order: [['type', 'ASC'], ['name', 'ASC']] });
    const routines = all.map(mapRoutineForClient);
    const allExercises = await ExerciseDefinition.findAll({ order: [['name', 'ASC']] });
    const exerciseLibrary = allExercises.map(e => ({
        id: e.id,
        name: e.name,
        category: e.category,
        equipment: e.equipment,
        instructions: e.instructions || null,
        videoUrl: e.videoUrl || null,
        defaultSets: e.defaultSets || null,
        defaultReps: e.defaultReps || null,
        defaultDuration: e.defaultDuration || null,
    }));

    res.render('stretch', {
        title: 'Stretch Builder',
        user: req.session.user,
        routines,
        exerciseLibrary,
    });
});

app.get('/stretch/api/routines', requireLogin, async (req, res) => {
    const { Routine, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();
    const routines = await Routine.findAll({ order: [['type', 'ASC'], ['name', 'ASC']] });
    res.json({ success: true, data: routines.map(mapRoutineForClient) });
});

app.post('/stretch/api/routines', requireLogin, async (req, res) => {
    const { Routine, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();

    const { name, type, notes, items } = req.body;
    if (!name || !type || !Array.isArray(items)) {
        return res.status(400).json({ success: false, message: 'name, type, and items are required' });
    }

    const routine = await Routine.create({
        name: name.trim(),
        type,
        notes: notes?.trim() || null,
        items: JSON.stringify(items),
    });

    res.json({ success: true, data: mapRoutineForClient(routine) });
});

app.delete('/stretch/api/routines/:id', requireLogin, async (req, res) => {
    const { Routine } = getDatabase(req.session.user.username);
    await Routine.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
});

app.get('/routines', requireLogin, async (req, res) => {
    res.redirect('/stretch');
});

app.post('/routines', requireLogin, async (req, res) => {
    const { Routine, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();
    const { name, type, notes } = req.body;
    await Routine.create({ name: name.trim(), type, notes: notes?.trim() || null, items: '[]' });
    res.redirect('/routines?success=1');
});

app.post('/routines/update/:id', requireLogin, async (req, res) => {
    const { Routine } = getDatabase(req.session.user.username);
    const r = await Routine.findByPk(req.params.id);
    if (!r) return res.redirect('/routines');
    const { name, type, notes } = req.body;
    await r.update({ name: name.trim(), type, notes: notes?.trim() || null });
    res.redirect('/routines');
});

app.post('/routines/delete/:id', requireLogin, async (req, res) => {
    const { Routine } = getDatabase(req.session.user.username);
    await Routine.destroy({ where: { id: req.params.id } });
    res.redirect('/routines');
});

app.post('/routines/:id/items', requireLogin, async (req, res) => {
    const { Routine, ExerciseDefinition } = getDatabase(req.session.user.username);
    const r = await Routine.findByPk(req.params.id);
    if (!r) return res.redirect('/routines');
    const items = JSON.parse(r.items || '[]');
    const { name, duration, reps, sets, notes, exerciseId, instructions, mediaUrl } = req.body;
    const exerciseIdNum = exerciseId ? parseInt(exerciseId) : null;
    const fromLibrary = exerciseIdNum ? await ExerciseDefinition.findByPk(exerciseIdNum) : null;
    const resolvedName = (name || '').trim() || fromLibrary?.name;
    if (!resolvedName) return res.redirect('/routines');
    items.push({
        name:     resolvedName,
        duration: duration ? parseInt(duration) : null,
        reps:     reps     ? parseInt(reps)     : null,
        sets:     sets     ? parseInt(sets)      : null,
        notes:    notes?.trim() || null,
        exerciseId: exerciseIdNum || fromLibrary?.id || null,
        instructions: (instructions || '').trim() || fromLibrary?.instructions || null,
        mediaUrl: (mediaUrl || '').trim() || fromLibrary?.videoUrl || null,
    });
    await r.update({ items: JSON.stringify(items) });
    res.redirect('/routines');
});

app.post('/routines/:id/items/update/:idx', requireLogin, async (req, res) => {
    const { Routine, ExerciseDefinition } = getDatabase(req.session.user.username);
    const r = await Routine.findByPk(req.params.id);
    if (!r) return res.redirect('/routines');
    const items = JSON.parse(r.items || '[]');
    const idx = parseInt(req.params.idx);
    if (idx >= 0 && idx < items.length) {
        const existing = items[idx] || {};
        const { name, duration, reps, sets, notes, exerciseId, instructions, mediaUrl } = req.body;
        const exerciseIdNum = exerciseId ? parseInt(exerciseId) : existing.exerciseId || null;
        const fromLibrary = exerciseIdNum ? await ExerciseDefinition.findByPk(exerciseIdNum) : null;
        const resolvedName = (name || '').trim() || fromLibrary?.name || existing.name;
        items[idx] = {
            name:     resolvedName,
            duration: duration ? parseInt(duration) : null,
            reps:     reps     ? parseInt(reps)     : null,
            sets:     sets     ? parseInt(sets)      : null,
            notes:    notes?.trim() || null,
            exerciseId: exerciseIdNum || null,
            instructions: (instructions || '').trim() || fromLibrary?.instructions || existing.instructions || null,
            mediaUrl: (mediaUrl || '').trim() || fromLibrary?.videoUrl || existing.mediaUrl || null,
        };
    }
    await r.update({ items: JSON.stringify(items) });
    res.redirect('/routines');
});

app.post('/routines/:id/items/delete/:idx', requireLogin, async (req, res) => {
    const { Routine } = getDatabase(req.session.user.username);
    const r = await Routine.findByPk(req.params.id);
    if (!r) return res.redirect('/routines');
    const items = JSON.parse(r.items || '[]');
    items.splice(parseInt(req.params.idx), 1);
    await r.update({ items: JSON.stringify(items) });
    res.redirect('/routines');
});

// ── Planner ───────────────────────────────────────────────────────────────────

const parseArr = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };

const SESSION_TYPES = {
    strength:     '💪 Strength',
    conditioning: '🏃 Conditioning',
    technique:    '🎯 Technique',
    recovery:     '🧘 Recovery',
    bjj:          '🥋 BJJ',
    muay_thai:    '🥊 Muay Thai',
    open_mat:     '🤸 Open Mat',
    gym_work:     '🏋️ Gym Work',
};

app.get('/planner', requireLogin, async (req, res) => {
    const { ScheduleProfile, TrainingSession, Competition, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();

    const schedule = await ScheduleProfile.findOne();
    const scheduleData = schedule ? {
        workDays:       parseArr(schedule.workDays),
        workShiftStart: schedule.workShiftStart || '',
        workShiftEnd:   schedule.workShiftEnd   || '',
        bjjDays:        parseArr(schedule.bjjDays),
        muayThaiDays:   parseArr(schedule.muayThaiDays),
        openMatDays:    parseArr(schedule.openMatDays),
    } : { workDays: [], workShiftStart: '', workShiftEnd: '', bjjDays: [], muayThaiDays: [], openMatDays: [] };

    const todayStr = new Date().toISOString().split('T')[0];
    const twoWeeksStr = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const upcomingSessions = await TrainingSession.findAll({
        where: { date: { [Op.between]: [todayStr, twoWeeksStr] } },
        order: [['date', 'ASC']],
    });
    const recentSessions = await TrainingSession.findAll({
        where: { date: { [Op.between]: [sevenDaysAgoStr, new Date(todayStr + 'T00:00:00').toISOString().split('T')[0]] } },
        order: [['date', 'DESC']],
    });
    const competitions = await Competition.findAll({
        where: { isActive: true, date: { [Op.gte]: todayStr } },
        order: [['date', 'ASC']],
    });

    res.render('planner', {
        title: 'Training Planner',
        user: req.session.user,
        scheduleData,
        upcomingSessions,
        recentSessions,
        competitions,
        sessionTypes: SESSION_TYPES,
        todayStr,
        success: req.query.success || null,
    });
});

app.post('/planner/schedule', requireLogin, async (req, res) => {
    const { ScheduleProfile, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();

    const workDays    = [].concat(req.body.workDays    || []).map(Number);
    const bjjDays     = [].concat(req.body.bjjDays     || []).map(Number);
    const muayThaiDays= [].concat(req.body.muayThaiDays|| []).map(Number);
    const openMatDays = [].concat(req.body.openMatDays || []).map(Number);
    const data = {
        workDays:       JSON.stringify(workDays),
        workShiftStart: req.body.workShiftStart || null,
        workShiftEnd:   req.body.workShiftEnd   || null,
        bjjDays:        JSON.stringify(bjjDays),
        muayThaiDays:   JSON.stringify(muayThaiDays),
        openMatDays:    JSON.stringify(openMatDays),
    };

    const existing = await ScheduleProfile.findOne();
    if (existing) await existing.update(data);
    else await ScheduleProfile.create(data);

    res.redirect('/planner?success=1');
});

app.post('/planner/session', requireLogin, async (req, res) => {
    const { TrainingSession, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();

    const { date, type, title, plannedDuration, notes, competitionId } = req.body;
    await TrainingSession.create({
        date,
        type,
        title:           title           || null,
        plannedDuration: plannedDuration ? parseInt(plannedDuration) : null,
        notes:           notes           || null,
        competitionId:   competitionId   ? parseInt(competitionId)   : null,
        status:          'planned',
    });
    res.redirect('/planner?success=1');
});

app.post('/planner/session/update/:id', requireLogin, async (req, res) => {
    const { TrainingSession } = getDatabase(req.session.user.username);
    const s = await TrainingSession.findByPk(req.params.id);
    if (!s) return res.redirect('/planner');

    const { status, actualDuration, effort, energy, notes, missedReason } = req.body;
    await s.update({
        status:         status         || s.status,
        actualDuration: actualDuration ? parseInt(actualDuration) : s.actualDuration,
        effort:         effort         ? parseInt(effort)         : s.effort,
        energy:         energy         ? parseInt(energy)         : s.energy,
        notes:          notes          !== undefined ? notes       : s.notes,
        missedReason:   missedReason   || s.missedReason,
    });
    res.redirect('/planner');
});

app.post('/planner/session/delete/:id', requireLogin, async (req, res) => {
    const { TrainingSession } = getDatabase(req.session.user.username);
    await TrainingSession.destroy({ where: { id: req.params.id } });
    res.redirect('/planner');
});

// ── Competitions ──────────────────────────────────────────────────────────────

const SPORT_LABELS = { muay_thai: '🥊 Muay Thai', bjj: '🥋 BJJ', other: '🏆 Other' };

app.get('/competitions', requireLogin, async (req, res) => {
    const { Competition, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();

    const all = await Competition.findAll({ order: [['date', 'ASC']] });
    const todayStr = new Date().toISOString().split('T')[0];

    const enriched = all.map(c => {
        const daysOut  = Math.ceil((new Date(c.date) - new Date()) / (24 * 60 * 60 * 1000));
        const phase    = getPeriodisationPhase(c.date);
        let regWarning = null;
        if (c.registrationDeadline) {
            const regDays = Math.ceil((new Date(c.registrationDeadline) - new Date()) / (24 * 60 * 60 * 1000));
            if (regDays > 0 && regDays <= 14) regWarning = regDays;
        }
        return { ...c.toJSON(), daysOut, phase, regWarning, isPast: daysOut < 0 };
    });

    res.render('competitions', {
        title: 'Competitions',
        user: req.session.user,
        competitions: enriched,
        sportLabels: SPORT_LABELS,
        todayStr,
    });
});

app.post('/competitions', requireLogin, async (req, res) => {
    const { Competition, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();

    const { name, sport, date, location, weightClass, registrationDeadline, notes } = req.body;
    await Competition.create({
        name, sport, date,
        location:             location             || null,
        weightClass:          weightClass          || null,
        registrationDeadline: registrationDeadline || null,
        notes:                notes                || null,
        isActive: true,
    });
    res.redirect('/competitions');
});

app.post('/competitions/delete/:id', requireLogin, async (req, res) => {
    const { Competition } = getDatabase(req.session.user.username);
    await Competition.destroy({ where: { id: req.params.id } });
    res.redirect('/competitions');
});

// ── Accountability ────────────────────────────────────────────────────────────

app.get('/accountability', requireLogin, async (req, res) => {
    const { TrainingSession, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();

    const today    = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 30-day heatmap
    const thirtyStr = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const heatmapSessions = await TrainingSession.findAll({
        where: { date: { [Op.gte]: thirtyStr } },
    });
    const heatmap = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const ds = d.toISOString().split('T')[0];
        const daySess = heatmapSessions.filter(s => s.date === ds);
        let status = 'empty';
        if (ds > todayStr)                                        status = 'future';
        else if (daySess.some(s => s.status === 'completed'))     status = 'completed';
        else if (daySess.some(s => s.status === 'partial'))       status = 'partial';
        else if (daySess.some(s => s.status === 'missed'))        status = 'missed';
        else if (daySess.some(s => s.status === 'planned'))       status = 'planned';
        heatmap.push({ date: ds, label: `${d.getMonth()+1}/${d.getDate()}`, status, count: daySess.length });
    }

    // Streak (consecutive completed/partial days going back from today)
    const allDone = await TrainingSession.findAll({
        where: { status: { [Op.in]: ['completed', 'partial'] } },
        attributes: ['date'],
    });
    const doneDates = new Set(allDone.map(s => s.date));
    let streak = 0;
    let check  = new Date(today);
    if (!doneDates.has(todayStr)) check.setDate(check.getDate() - 1);
    while (doneDates.has(check.toISOString().split('T')[0])) {
        streak++;
        check.setDate(check.getDate() - 1);
    }

    // This week stats
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const weekStr = startOfWeek.toISOString().split('T')[0];
    const weekSessions = await TrainingSession.findAll({
        where: { date: { [Op.between]: [weekStr, todayStr] } },
    });
    const weekCompleted = weekSessions.filter(s => ['completed','partial'].includes(s.status)).length;
    const weekTotal     = weekSessions.length;

    // Recent history (last 30 sessions)
    const recentSessions = await TrainingSession.findAll({
        order: [['date', 'DESC']],
        limit: 30,
    });

    res.render('accountability', {
        title: 'Accountability',
        user: req.session.user,
        heatmap,
        streak,
        weekCompleted,
        weekTotal,
        recentSessions,
        sessionTypes: SESSION_TYPES,
        todayStr,
    });
});

// ── Workout Logger ────────────────────────────────────────────────────────────

app.get('/workout', requireLogin, async (req, res) => {
    const { WorkoutSession, WorkoutSet, TrainingPlan, TrainingPlanAssignment, WorkoutTemplate, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();
    const recent = await WorkoutSession.findAll({ order: [['date','DESC'],['startedAt','DESC']], limit: 10 });
    const recentWithCounts = await Promise.all(recent.map(async s => {
        const sets = await WorkoutSet.findAll({ where: { sessionId: s.id } });
        const exCount = new Set(sets.map(x => x.exerciseOrder)).size;
        return { ...s.toJSON(), setCount: sets.length, exerciseCount: exCount };
    }));
    // Active plan today
    const assignment = await TrainingPlanAssignment.findOne({ where: { status: 'active' } });
    let todayPlan = null;
    if (assignment) {
        const plan = await TrainingPlan.findByPk(assignment.planId);
        if (plan) {
            const phases = JSON.parse(plan.phases || '[]');
            const weekNumber = Math.floor((new Date() - new Date(assignment.startDate)) / (7*24*60*60*1000)) + 1;
            const dayOfWeek  = new Date().getDay();
            let phase = phases[0];
            for (const p of phases) {
                const [s, e] = p.weeks.split('–').map(Number);
                if (weekNumber >= s && weekNumber <= e) { phase = p; break; }
            }
            todayPlan = { planName: plan.name, phase: phase?.name, session: phase?.weeklySchedule?.find(d => d.day === dayOfWeek) || null };
        }
    }
    const rawTemplates = await WorkoutTemplate.findAll({ order: [['name','ASC']] });
    const templates = rawTemplates.map(t => ({ ...t.toJSON(), exercises: JSON.parse(t.exercises || '[]') }));
    res.render('workout', { title: 'Workout Logger', user: req.session.user, recentWorkouts: recentWithCounts, todayPlan, templates });
});

// Workout AJAX endpoints (session-protected, used by workout.ejs)
app.post('/workout/api/session', requireLogin, async (req, res) => {
    const { WorkoutSession, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();
    const { type, title, date } = req.body;
    const session = await WorkoutSession.create({ type, title: title || null, date: date || new Date().toISOString().split('T')[0], startedAt: new Date(), status: 'active' });
    res.json({ success: true, data: session });
});

app.patch('/workout/api/session/:id', requireLogin, async (req, res) => {
    const { WorkoutSession } = getDatabase(req.session.user.username);
    const s = await WorkoutSession.findByPk(req.params.id);
    if (!s) return res.status(404).json({ success: false });
    if (req.body.status === 'finished') { s.finishedAt = new Date(); s.status = 'finished'; }
    if (req.body.effort   !== undefined) s.effort   = req.body.effort;
    if (req.body.duration !== undefined) s.duration = req.body.duration;
    if (req.body.notes    !== undefined) s.notes    = req.body.notes;
    await s.save();
    res.json({ success: true, data: s });
});

app.delete('/workout/api/session/:id', requireLogin, async (req, res) => {
    const { WorkoutSession, WorkoutSet } = getDatabase(req.session.user.username);
    await WorkoutSet.destroy({ where: { sessionId: req.params.id } });
    await WorkoutSession.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
});

app.get('/workout/api/session/:id', requireLogin, async (req, res) => {
    const { WorkoutSession, WorkoutSet } = getDatabase(req.session.user.username);
    const session = await WorkoutSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ success: false });
    const sets = await WorkoutSet.findAll({ where: { sessionId: req.params.id }, order: [['exerciseOrder','ASC'],['setNumber','ASC']] });
    res.json({ success: true, data: { ...session.toJSON(), sets } });
});

app.post('/workout/api/session/:id/set', requireLogin, async (req, res) => {
    const { WorkoutSet, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();
    const { exerciseName, exerciseId, exerciseOrder, setNumber, reps, weight, weightUnit, duration, rpe, notes } = req.body;
    const set = await WorkoutSet.create({
        sessionId: req.params.id, exerciseName, exerciseId: exerciseId || null,
        exerciseOrder: exerciseOrder || 0, setNumber: setNumber || 1,
        reps: reps || null, weight: weight || null, weightUnit: weightUnit || 'lbs',
        duration: duration || null, rpe: rpe || null, notes: notes || null,
    });
    res.json({ success: true, data: set });
});

app.delete('/workout/api/set/:id', requireLogin, async (req, res) => {
    const { WorkoutSet } = getDatabase(req.session.user.username);
    await WorkoutSet.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
});

app.get('/workout/api/exercises', requireLogin, async (req, res) => {
    const { ExerciseDefinition } = getDatabase(req.session.user.username);
    const { q, category } = req.query;
    let all = await ExerciseDefinition.findAll({ order: [['name','ASC']] });
    if (category) all = all.filter(e => e.category === category);
    if (q) all = all.filter(e => e.name.toLowerCase().includes(q.toLowerCase()));
    res.json({ success: true, data: all.map(e => ({ id: e.id, name: e.name, category: e.category, equipment: e.equipment, primaryMuscles: JSON.parse(e.primaryMuscles || '[]'), defaultSets: e.defaultSets, defaultReps: e.defaultReps })) });
});

// Workout templates API
app.get('/workout/api/templates', requireLogin, async (req, res) => {
    const { WorkoutTemplate, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();
    const templates = await WorkoutTemplate.findAll({ order: [['name','ASC']] });
    res.json({ success: true, data: templates.map(t => ({ ...t.toJSON(), exercises: JSON.parse(t.exercises || '[]') })) });
});

app.post('/workout/api/templates', requireLogin, async (req, res) => {
    const { WorkoutTemplate, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();
    const { name, type, description, exercises } = req.body;
    if (!name || !Array.isArray(exercises)) return res.status(400).json({ success: false, message: 'name and exercises required' });
    const t = await WorkoutTemplate.create({ name: name.trim(), type: type || 'strength', description: description?.trim() || null, exercises: JSON.stringify(exercises) });
    res.json({ success: true, data: { ...t.toJSON(), exercises } });
});

app.delete('/workout/api/templates/:id', requireLogin, async (req, res) => {
    const { WorkoutTemplate } = getDatabase(req.session.user.username);
    await WorkoutTemplate.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
});

// ── Exercise Library ──────────────────────────────────────────────────────────

app.get('/exercises', requireLogin, async (req, res) => {
    const { ExerciseDefinition, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();
    const all = await ExerciseDefinition.findAll({ order: [['category','ASC'],['name','ASC']] });
    const exercises = all.map(e => ({
        ...e.toJSON(),
        primaryMuscles:   JSON.parse(e.primaryMuscles   || '[]'),
        secondaryMuscles: JSON.parse(e.secondaryMuscles || '[]'),
    }));
    res.render('library', { title: 'Exercises', user: req.session.user, exercises });
});

app.get('/library', requireLogin, async (req, res) => {
    const { ExerciseDefinition, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();
    const all = await ExerciseDefinition.findAll({ order: [['category','ASC'],['name','ASC']] });
    const exercises = all.map(e => ({
        ...e.toJSON(),
        primaryMuscles:   JSON.parse(e.primaryMuscles   || '[]'),
        secondaryMuscles: JSON.parse(e.secondaryMuscles || '[]'),
    }));
    res.render('library', { title: 'Exercise Library', user: req.session.user, exercises });
});

// ── Exercise Plan Maker ───────────────────────────────────────────────────────

app.get('/plan-maker', requireLogin, async (req, res) => {
    const { ExerciseDefinition, ExercisePlan, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();
    const all = await ExerciseDefinition.findAll({ order: [['category','ASC'],['name','ASC']] });
    const exercises = all.map(e => ({
        ...e.toJSON(),
        primaryMuscles:   JSON.parse(e.primaryMuscles   || '[]'),
        secondaryMuscles: JSON.parse(e.secondaryMuscles || '[]'),
    }));
    const rawPlans = await ExercisePlan.findAll({ order: [['updatedAt','DESC']] });
    const plans = rawPlans.map(p => ({ ...p.toJSON(), items: JSON.parse(p.items || '[]') }));
    res.render('plan-maker', { title: 'Plan Maker', user: req.session.user, exercises, plans });
});

// ── Timers ────────────────────────────────────────────────────────────────────

app.get('/timers', requireLogin, (req, res) => {
    res.render('timers', { title: 'Timers', user: req.session.user });
});

// ── Training Plans ────────────────────────────────────────────────────────────

app.get('/plans', requireLogin, async (req, res) => {
    const { TrainingPlan, TrainingPlanAssignment, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();
    const plans = await TrainingPlan.findAll({ order: [['sport','ASC'],['name','ASC']] });
    const assignment = await TrainingPlanAssignment.findOne({ where: { status: 'active' } });
    let activePlan = null;
    let todaySession = null;
    if (assignment) {
        activePlan = plans.find(p => p.id === assignment.planId);
        if (activePlan) {
            const phases = JSON.parse(activePlan.phases || '[]');
            const weekNumber = Math.floor((new Date() - new Date(assignment.startDate)) / (7*24*60*60*1000)) + 1;
            const dayOfWeek = new Date().getDay();
            let phase = phases[0];
            for (const p of phases) {
                const [s, e] = p.weeks.split('–').map(Number);
                if (weekNumber >= s && weekNumber <= e) { phase = p; break; }
            }
            todaySession = { phase: phase?.name, weekNumber, session: phase?.weeklySchedule?.find(d => d.day === dayOfWeek) || null };
        }
    }
    const parsedPlans = plans.map(p => ({ ...p.toJSON(), phases: JSON.parse(p.phases || '[]') }));
    res.render('plans', { title: 'Training Plans', user: req.session.user, plans: parsedPlans, assignment, activePlan, todaySession });
});

app.post('/plans/assign', requireLogin, async (req, res) => {
    const { TrainingPlanAssignment, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();
    const { planId, startDate } = req.body;
    await TrainingPlanAssignment.update({ status: 'paused' }, { where: { status: 'active' } });
    await TrainingPlanAssignment.create({ planId, startDate: startDate || new Date().toISOString().split('T')[0], status: 'active' });
    res.redirect('/plans');
});

app.post('/plans/unassign', requireLogin, async (req, res) => {
    const { TrainingPlanAssignment } = getDatabase(req.session.user.username);
    await TrainingPlanAssignment.update({ status: 'paused' }, { where: { status: 'active' } });
    res.redirect('/plans');
});

app.get('/stats', requireLogin, (req, res) => {
    res.render('stats', { title: 'Stats & History', user: req.session.user });
});

// ─────────────────────────────────────────────────────────────────────────────

app.listen(port, () => {
    console.log(`Health Tracker running on port ${port}`);
});
