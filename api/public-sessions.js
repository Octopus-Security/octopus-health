'use strict';

/**
 * public-sessions.js - the READ side of shareable sessions. No login, no cookies needed.
 *
 *   GET /s                    storefront: PUBLIC sessions only
 *   GET /s/sitemap.xml        public sessions (health has no other sitemap)
 *   GET /s/:slugOrToken       one session: public by slug or token, unlisted by token only
 *
 * Mounted in index.js BEFORE the login and app-access gates, and these handlers never read
 * req.user: what a stranger sees cannot depend on who is signed in, which also means the owner
 * previews exactly what a recipient sees.
 *
 * What is served is sessions-store.publicView(), a whitelist. The private tailoring block, the
 * owner and the ids are never passed to a template.
 *
 * A private (or deleted, or unknown) session is a 404 with no hint which. Setting a session back
 * to private therefore kills its link at once: lookups require a non-private row, and nothing
 * here is cached (no-store for unlisted, no-cache for public).
 */

const S = require('./sessions-store');
const { getSharedDatabase } = require('./sessions-db');
const { stillsFor } = require('../lib/session-stills');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function mount(app, { publicHost } = {}) {
  const base = (req) => (publicHost ? `https://${publicHost}` : `${req.protocol}://${req.get('host')}`);
  const baseHeaders = (res) => {
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Content-Type-Options', 'nosniff');
  };
  const missing = (res) => { baseHeaders(res); res.set('Cache-Control', 'no-store'); return res.status(404).type('text/plain').send('Not found'); };

  app.get('/s', async (req, res) => {
    const h = await getSharedDatabase().ready();
    const rows = await S.listPublic(h);
    baseHeaders(res);
    res.set('Cache-Control', 'no-cache');
    res.render('public-sessions', { title: 'Sessions', sessions: rows.map(S.cardView), canonical: base(req) + '/s' });
  });

  app.get('/s/sitemap.xml', async (req, res) => {
    const h = await getSharedDatabase().ready();
    const rows = await S.listPublic(h);
    baseHeaders(res);
    res.set('Cache-Control', 'no-cache');
    const urls = [base(req) + '/s', ...rows.map(r => `${base(req)}/s/${r.slug}`)];
    res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join('\n') + '\n</urlset>\n');
  });

  app.get('/s/:k', async (req, res) => {
    const h = await getSharedDatabase().ready();
    const row = await S.findShared(h, req.params.k);
    if (!row) return missing(res);
    // A public session reached by its token goes to its public address.
    if (row.visibility === 'public' && row.slug && req.params.k !== row.slug) { baseHeaders(res); return res.redirect(302, '/s/' + row.slug); }

    const s = S.publicView(row);
    const unlisted = s.visibility === 'unlisted';
    baseHeaders(res);
    if (unlisted) { res.set('X-Robots-Tag', 'noindex, nofollow, noarchive'); res.set('Cache-Control', 'no-store'); }
    else res.set('Cache-Control', 'no-cache');
    res.render('public-session', {
      title: s.title, s, unlisted,
      canonical: unlisted ? null : `${base(req)}/s/${s.slug}`,
      stills: s.items.map(i => stillsFor(i.poseKey)),
    });
  });
}

module.exports = mount;
