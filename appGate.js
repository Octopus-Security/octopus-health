'use strict';
// The one app gate instance, shared by the page routes (index.js) and the bearer
// API (api/middleware/auth.js) so both ask the same question with one cache.
const { createAppGate } = require('./appAccess');

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://octopus-auth:3002';

// May THIS signed-in account use health at all? Admins always pass, and with no
// override or default set the answer is "allowed" (see appAccess.js).
module.exports = createAppGate({
  authUrl:    AUTH_URL,
  slug:       process.env.APP_ACCESS_SLUG || 'health',
  upgradeUrl: process.env.UPGRADE_URL || '',
  appName:    'Health',
});
