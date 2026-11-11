'use strict';
/**
 * Bounded cache for "is this SSO token valid" answers from octopus-auth.
 *
 * The hand-rolled Map this replaces never evicted and only remembered positive answers, so every
 * request carrying a dead or forged cookie cost an auth round trip, and the map grew without limit.
 *
 *  - Positive answers live `ttl`; a DEFINITE rejection (auth said valid:false, or answered 401/403)
 *    lives `negTtl` (short). Anything else — timeout, network error, 5xx, an odd body — is NEVER
 *    cached: an auth blip must not lock users out for the length of a TTL.
 *  - Bounded: LRU with `max` entries; expired entries are dropped when touched and on overflow.
 *  - Concurrent lookups of the same token share ONE request (in-flight dedupe).
 *
 * `call(token)` must resolve { valid, user } or throw (an error carrying .response.status when auth
 * answered with an HTTP status).
 */
function createVerifyCache({ call, ttl = 5 * 60 * 1000, negTtl = 30 * 1000, max = 2000, now = Date.now } = {}) {
  const cache = new Map();      // token -> { user|null, exp }
  const inflight = new Map();   // token -> Promise<user|null>

  function put(token, user, life) {
    cache.delete(token);
    cache.set(token, { user, exp: now() + life });
    while (cache.size > max) cache.delete(cache.keys().next().value);
  }

  async function lookup(token) {
    try {
      const data = await call(token);
      if (data && data.valid && data.user) { put(token, data.user, ttl); return data.user; }
      if (data && data.valid === false) put(token, null, negTtl);
      return null;
    } catch (e) {
      const status = e && e.response && e.response.status;
      if (status === 401 || status === 403) put(token, null, negTtl);
      return null;           // unreachable / 5xx / timeout: unauthenticated now, but not remembered
    }
  }

  async function verify(token) {
    const hit = cache.get(token);
    if (hit) {
      if (hit.exp > now()) { cache.delete(token); cache.set(token, hit); return hit.user; }
      cache.delete(token);
    }
    if (inflight.has(token)) return inflight.get(token);
    const p = lookup(token).finally(() => inflight.delete(token));
    inflight.set(token, p);
    return p;
  }
  verify.size = () => cache.size;
  return verify;
}
module.exports = { createVerifyCache };
