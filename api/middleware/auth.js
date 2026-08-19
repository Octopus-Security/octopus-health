const { createAuthMiddleware } = require('@octopus-security/auth-client');

const authenticateToken = createAuthMiddleware();

// AUTH_REMOTE_VERIFY is a security control, and an unsupported one is SILENT.
//
// Remote verification arrived in @octopus-security/auth-client 1.2.0. This
// service has no lockfile entry for the package and installs with `npm install`
// at BUILD time, so an image built before 1.2.0 ignores the variable entirely:
// Bearer routes keep verifying locally, keep missing the tokenEpoch that
// revocation bumps, and log nothing to say the control is off. The compose
// would look correct, `docker exec ... env` would show the variable set, and
// "sign out everywhere" still would not reach this service.
//
// So ask the middleware what it actually built rather than trusting the
// environment. It reports its own mode.
//
// A warning and not process.exit(1): auth refusing to boot over a half-finished
// RS256 migration turned a configuration problem into an estate-wide outage,
// and the lesson stuck. A stack that cannot see revocation is still worth more
// than a stack that is down.
if (/^(1|true|yes)$/i.test(process.env.AUTH_REMOTE_VERIFY || '') && !authenticateToken.remote) {
  console.error(
    '[auth] AUTH_REMOTE_VERIFY is set, but this build of @octopus-security/auth-client\n'
    + '       does not support it (needs >=1.2.0, and the compose asks for it).\n'
    + '       Bearer routes are verifying LOCALLY and CANNOT see revocation — a revoked\n'
    + '       session keeps working here until it expires, up to seven days.\n'
    + '       REBUILD this stack. A redeploy alone will not change the installed package.'
  );
} else if (authenticateToken.remote) {
  console.log('[auth] Bearer routes verify remotely against octopus-auth — revocation is visible.');
}

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
