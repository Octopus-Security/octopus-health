const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const axios = require('axios');
const app = express();
// Trust proxy for correct IP detection behind Cloudflare/NGINX
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;
const getDatabase = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'octopus-shared-secret-change-in-production';
const AUTH_INTERNAL_URL = process.env.AUTH_SERVICE_URL || 'http://octopus-auth:3002';
const AUTH_EXTERNAL_URL = 'https://auth.octopustechnology.net';

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

// Helper to call auth service with fallback
async function callAuthService(endpoint, data, headers = {}) {
    try {
        const response = await axios.post(`${AUTH_INTERNAL_URL}${endpoint}`, data, {
            headers: { 'Content-Type': 'application/json', ...headers },
            timeout: 3000
        });
        return response;
    } catch (internalError) {
        console.log('Internal auth failed, trying external URL...');
        const response = await axios.post(`${AUTH_EXTERNAL_URL}${endpoint}`, data, {
            headers: { 'Content-Type': 'application/json', ...headers },
            timeout: 5000
        });
        return response;
    }
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

// JWT middleware for API routes
const requireApiAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1]; // Bearer <token>
    if (!token) {
        return res.status(401).json({ success: false, message: 'Invalid token format' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

// Routes

app.get('/login', (req, res) => {
    const siteKey = process.env.RECAPTCHA_SITE_KEY;
    console.log('RECAPTCHA_SITE_KEY for /login page:', siteKey);
    res.render('login', { title: 'Login', error: null, mode: 'login', siteKey });
});


app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        // Proxy to centralized auth service
        const authResponse = await callAuthService('/api/auth/login', {
            username,
            password
        });

        if (authResponse.data.success) {
            req.session.user = { username };
            const { sequelize } = getDatabase(username);
            await sequelize.sync();
            res.redirect('/');
        } else {
            res.render('login', { title: 'Login', error: authResponse.data.error || 'Login failed', mode: 'login', siteKey: process.env.RECAPTCHA_SITE_KEY });
        }
    } catch (error) {
        console.error('Login error:', error.response?.data || error.message);
        const errorMsg = error.response?.data?.error || 'Login failed';
        res.render('login', { title: 'Login', error: errorMsg, mode: 'login', siteKey: process.env.RECAPTCHA_SITE_KEY });
    }
});


app.get('/register', (req, res) => {
    res.render('login', { title: 'Register', error: null, mode: 'register', siteKey: process.env.RECAPTCHA_SITE_KEY });
});


app.post('/register', async (req, res) => {
    const { username, password, confirmPassword } = req.body;
    
    try {
        if (!username || !password || !confirmPassword) {
            return res.render('login', { title: 'Register', error: 'All fields required', mode: 'register', siteKey: process.env.RECAPTCHA_SITE_KEY });
        }
        
        if (password !== confirmPassword) {
            return res.render('login', { title: 'Register', error: 'Passwords do not match', mode: 'register', siteKey: process.env.RECAPTCHA_SITE_KEY });
        }
        
        if (password.length < 6) {
            return res.render('login', { title: 'Register', error: 'Password must be at least 6 characters', mode: 'register', siteKey: process.env.RECAPTCHA_SITE_KEY });
        }
        
        // Proxy registration to centralized auth service
        const authResponse = await callAuthService('/api/auth/register', {
            username,
            password
        });

        if (authResponse.data.success) {
            req.session.user = { username };
            const { sequelize } = getDatabase(username);
            await sequelize.sync();
            res.redirect('/');
        } else {
            res.render('login', { title: 'Register', error: authResponse.data.error || 'Registration failed', mode: 'register', siteKey: process.env.RECAPTCHA_SITE_KEY });
        }
    } catch (error) {
        console.error('Registration error:', error.response?.data || error.message);
        const errorMsg = error.response?.data?.error || 'Registration failed';
        res.render('login', { title: 'Register', error: errorMsg, mode: 'register', siteKey: process.env.RECAPTCHA_SITE_KEY });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// REST API endpoints for mobile app
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password required' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }
        
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Username already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ username, password: hashedPassword });
        
        // Initialize user's database
        const { sequelize } = getDatabase(username);
        await sequelize.sync();
        
        // Generate token
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({ success: true, token, message: 'User registered successfully' });
    } catch (error) {
        console.error('API registration error:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    console.log('API login attempt for username:', username);
    
    try {
        const user = await User.findOne({ where: { username } });
        
        if (!user) {
            console.log('User not found');
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            console.log('Invalid password');
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        // Ensure user's database is synced
        const { sequelize } = getDatabase(username);
        await sequelize.sync();
        
        // Generate token
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
        
        console.log('Login successful, token generated');
        res.json({ success: true, token, message: null });
    } catch (error) {
        console.error('API login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// Dashboard
app.get('/', requireLogin, async (req, res) => {
    const { WeightEntry, Exercise, Meal, Goal, Competition, TrainingSession, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();

    try {
        const todayStr = new Date().toISOString().split('T')[0];

        const recentWeight = await WeightEntry.findOne({ order: [['date', 'DESC']] });
        const todayExercises = await Exercise.findAll({ where: { date: todayStr } });
        const todayMeals = await Meal.findAll({ where: { date: todayStr } });
        const activeGoals = await Goal.findAll({ where: { completed: false } });

        const todayCalories = todayMeals.reduce((sum, meal) => sum + (meal.calories || 0), 0);
        const todayExerciseMinutes = todayExercises.reduce((sum, ex) => sum + ex.duration, 0);

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
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading dashboard');
    }
});

// Weight tracking routes
app.get('/weight', requireLogin, async (req, res) => {
    const { WeightEntry } = getDatabase(req.session.user.username);
    const entries = await WeightEntry.findAll({ 
        order: [['date', 'DESC']], 
        limit: 30 
    });
    res.render('weight', { title: 'Weight Tracking', entries, user: req.session.user });
});

app.post('/weight', requireLogin, async (req, res) => {
    const { WeightEntry } = getDatabase(req.session.user.username);
    await WeightEntry.create(req.body);
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
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    try {
        const user = await User.findOne({ where: { username: req.session.user.username } });
        
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.render('settings', { 
                title: 'Account Settings', 
                user: req.session.user, 
                error: 'Current password is incorrect', 
                success: null 
            });
        }
        
        if (newPassword !== confirmPassword) {
            return res.render('settings', { 
                title: 'Account Settings', 
                user: req.session.user, 
                error: 'New passwords do not match', 
                success: null 
            });
        }
        
        if (newPassword.length < 6) {
            return res.render('settings', { 
                title: 'Account Settings', 
                user: req.session.user, 
                error: 'Password must be at least 6 characters', 
                success: null 
            });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();
        
        res.render('settings', { 
            title: 'Account Settings', 
            user: req.session.user, 
            error: null, 
            success: 'Password changed successfully' 
        });
    } catch (error) {
        console.error('Password change error:', error);
        res.render('settings', { 
            title: 'Account Settings', 
            user: req.session.user, 
            error: 'Failed to change password', 
            success: null 
        });
    }
});

app.post('/settings/delete-account', requireLogin, async (req, res) => {
    const { password } = req.body;
    const username = req.session.user.username;
    
    try {
        const user = await User.findOne({ where: { username } });
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.render('settings', { 
                title: 'Account Settings', 
                user: req.session.user, 
                error: 'Incorrect password', 
                success: null 
            });
        }
        
        // Delete user database
        const dbPath = path.join(dataDir, `${username}_health.sqlite`);
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
        
        // Delete user from auth database
        await user.destroy();
        
        // Destroy session and redirect to login
        req.session.destroy(() => {
            res.redirect('/login');
        });
    } catch (error) {
        console.error('Account deletion error:', error);
        res.render('settings', { 
            title: 'Account Settings', 
            user: req.session.user, 
            error: 'Failed to delete account', 
            success: null 
        });
    }
});

// ── Routines (warmup / stretching / cooldown) ─────────────────────────────────

app.get('/routines', requireLogin, async (req, res) => {
    const { Routine, sequelize } = getDatabase(req.session.user.username);
    await sequelize.sync();
    const all = await Routine.findAll({ order: [['type', 'ASC'], ['name', 'ASC']] });
    const routines = all.map(r => ({ ...r.toJSON(), itemsList: JSON.parse(r.items || '[]') }));
    res.render('routines', { title: 'Routines', user: req.session.user, routines, success: req.query.success || null });
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
    const { Routine } = getDatabase(req.session.user.username);
    const r = await Routine.findByPk(req.params.id);
    if (!r) return res.redirect('/routines');
    const items = JSON.parse(r.items || '[]');
    const { name, duration, reps, sets, notes } = req.body;
    items.push({
        name:     name.trim(),
        duration: duration ? parseInt(duration) : null,
        reps:     reps     ? parseInt(reps)     : null,
        sets:     sets     ? parseInt(sets)      : null,
        notes:    notes?.trim() || null,
    });
    await r.update({ items: JSON.stringify(items) });
    res.redirect('/routines');
});

app.post('/routines/:id/items/update/:idx', requireLogin, async (req, res) => {
    const { Routine } = getDatabase(req.session.user.username);
    const r = await Routine.findByPk(req.params.id);
    if (!r) return res.redirect('/routines');
    const items = JSON.parse(r.items || '[]');
    const idx = parseInt(req.params.idx);
    if (idx >= 0 && idx < items.length) {
        const { name, duration, reps, sets, notes } = req.body;
        items[idx] = {
            name:     name.trim(),
            duration: duration ? parseInt(duration) : null,
            reps:     reps     ? parseInt(reps)     : null,
            sets:     sets     ? parseInt(sets)      : null,
            notes:    notes?.trim() || null,
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

app.listen(port, () => {
    console.log(`Health Tracker running on port ${port}`);
});
