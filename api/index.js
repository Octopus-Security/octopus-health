const express = require('express');
const router = express.Router();

// Import route modules
const authRouter    = require('./routes/auth');
const healthRouter  = require('./routes/health');
const workoutRouter = require('./routes/workout');
const serviceRouter = require('./routes/service');

function requireServiceToken(req, res, next) {
  const expected = process.env.HEALTH_SERVICE_TOKEN;
  if (!expected) return res.status(500).json({ error: 'HEALTH_SERVICE_TOKEN not configured' });
  if (req.get('X-Service-Token') !== expected) return res.status(401).json({ error: 'invalid token' });
  next();
}

// Mount routes
router.use('/auth',    authRouter);
router.use('/health',  healthRouter);
router.use('/workout', workoutRouter);
// Gated at the MOUNT as well as per-route. Every route inside already calls
// requireToken, which is belt without braces: this router reads X-Service-User
// to pick whose database to open, so a route added later that forgets the check
// would let an unauthenticated caller name any account. Doing it here means
// forgetting is impossible rather than merely unlikely — the same reasoning
// octopus-ops/MULTI-USER.md gives for resolving the account at the door.
router.use('/service', requireServiceToken, serviceRouter);

module.exports = router;
