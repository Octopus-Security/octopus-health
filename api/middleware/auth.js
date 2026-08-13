const { createAuthMiddleware } = require('@octopus-security/auth-client');

const authenticateToken = createAuthMiddleware();

/**
 * Either an SSO session or a Bearer token.
 *
 * index.js verifies the `octopus_sso` cookie against octopus-auth on EVERY
 * request, and mounts that middleware before the API router — so a browser
 * arrives here already authenticated. `createAuthMiddleware()` then ignored all
 * of that, because it only ever reads `Authorization`, and answered 401.
 *
 * The pages fetch with `credentials:'include'` and no Authorization header, so
 * every call from /stats, /exercises and the plan editor failed, and each page
 * rendered its own empty state: "No PRs yet — they auto-detect when you log
 * sets", over a database holding 44 sessions, 503 sets and 75 personal records.
 * That is the worst shape this failure can take. Nothing errored, nothing was
 * logged, and the app calmly reported the opposite of the truth — which reads
 * as "the Discord bot never wrote anything" rather than "the page was not
 * allowed to ask".
 *
 * Trusting req.user here is not a new trust: it is set ONLY after that cookie
 * has been verified remotely against octopus-auth, and a client cannot put it
 * there by sending a header. It is the same object the page routes gate on.
 *
 * Bearer still works and is still checked properly — mobile and service callers
 * carry no cookie, and fall through to the token gate unchanged.
 */
const requireUser = (req, res, next) =>
  (req.user && req.user.username) ? next() : authenticateToken(req, res, next);

module.exports = { authenticateToken, requireUser };
