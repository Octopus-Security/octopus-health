'use strict';

/**
 * public-plans.js - the READ side of shareable plans. No login. Mounted before the gates; never
 * reads req.user.
 *
 *   GET /p/sitemap.xml     PUBLIC plans only (opt-in; unlisted and private never appear)
 *   GET /p/:slugOrToken    one plan with every day's session inline, read live on each request
 *
 * Headers and visibility rules mirror public-sessions.js: unlisted = token only, noindex, no-store;
 * public = slug (token redirects), canonical, no-cache; private/unknown/deleted = 404.
 */

const P = require('./plans-store');
const { getSharedDatabase } = require('./sessions-db');
const { stillsFor } = require('../lib/session-stills');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function mount(app, { publicHost } = {}) {
  const base = (req) => (publicHost ? `https://${publicHost}` : `${req.protocol}://${req.get('host')}`);
  const baseHeaders = (res) => { res.set('Referrer-Policy', 'no-referrer'); res.set('X-Content-Type-Options', 'nosniff'); };
  const missing = (res) => { baseHeaders(res); res.set('Cache-Control', 'no-store'); return res.status(404).type('text/plain').send('Not found'); };

  app.get('/p/sitemap.xml', async (req, res) => {
    const h = await getSharedDatabase().ready();
    const rows = await P.listPublic(h);
    baseHeaders(res);
    res.set('Cache-Control', 'no-cache');
    res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + rows.map(r => `  <url><loc>${esc(`${base(req)}/p/${r.slug}`)}</loc></url>`).join('\n') + '\n</urlset>\n');
  });

  app.get('/p/:k', async (req, res) => {
    const h = await getSharedDatabase().ready();
    const row = await P.findShared(h, req.params.k);
    if (!row) return missing(res);
    if (row.visibility === 'public' && row.slug && req.params.k !== row.slug) { baseHeaders(res); return res.redirect(302, '/p/' + row.slug); }

    const plan = await P.planPublicView(h, row);
    const unlisted = plan.visibility === 'unlisted';
    baseHeaders(res);
    if (unlisted) { res.set('X-Robots-Tag', 'noindex, nofollow, noarchive'); res.set('Cache-Control', 'no-store'); }
    else res.set('Cache-Control', 'no-cache');
    res.render('public-plan', {
      title: plan.title, plan, unlisted,
      canonical: unlisted ? null : `${base(req)}/p/${plan.slug}`,
      stillsFor,
    });
  });
}

module.exports = mount;
