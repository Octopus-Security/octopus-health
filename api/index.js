const express = require('express');
const router = express.Router();

// Import route modules
const authRouter    = require('./routes/auth');
const healthRouter  = require('./routes/health');
const workoutRouter = require('./routes/workout');

// Mount routes
router.use('/auth',    authRouter);
router.use('/health',  healthRouter);
router.use('/workout', workoutRouter);

module.exports = router;
