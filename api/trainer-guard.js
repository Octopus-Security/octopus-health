'use strict';

/**
 * trainer-guard.js - who may AUTHOR shareable sessions and plans: role `trainer` or `admin`
 * (admin implies trainer; trainer implies nothing else). Everyone else gets 404, not 403.
 *
 * ROLE FRESHNESS. The role in req.user comes from index.js's verify cache (5 minutes, remote
 * /api/auth/verify; the JWT claim is never trusted, auth re-reads User.role on each verify). That
 * is too long for a revoked trainer, so every authoring request re-asks auth through a SECOND,
 * short cache (`verifyFresh`, ROLE_CACHE_MS, default 30 s) and uses ITS role. Revoking `trainer`
 * in auth therefore stops authoring within ~30 s. If auth cannot be reached, the answer is null
 * and the request is refused (fail closed). Public pages never go through this guard.
 */

const isTrainerRole = (role) => role === 'trainer' || role === 'admin';

function trainerGuard(verifyFresh) {
  if (typeof verifyFresh !== 'function') throw new Error('trainerGuard needs a fresh verify function');
  return async (req, res, next) => {
    try {
      const u = req.user && req.user.token ? await verifyFresh(req.user.token) : null;
      if (u && u.username === req.user.username && isTrainerRole(u.role)) {
        req.user.role = u.role; // the fresh role, so the nav and later checks agree
        return next();
      }
    } catch { /* fall through: refuse */ }
    res.status(404).type('text/plain').send('Not found');
  };
}

module.exports = { trainerGuard, isTrainerRole };
