'use strict';

// Landmine pivot. No database. The ball and the bar diameter come from the
// page, and the same numbers build the preview and the zip.

const landmine = require('../lib/landmine');

function sizes(body) {
    const src = body || {};
    return {
        bar: src.bar,
        ball: src.ball,
        printer: src.printer,
        bed: src.bed,
    };
}

function mount(app, { requireLogin }) {
    app.get('/landmine', requireLogin, (req, res) => {
        let plan;
        try {
            plan = landmine.plan({});
        } catch (e) {
            plan = { ok: false, lines: [e.message || 'Could not build the landmine'], parts: [], notes: [] };
        }
        res.render('landmine', {
            title: 'Landmine',
            user: req.user,
            plan,
            bars: landmine.BARS,
        });
    });

    app.post('/landmine/api/plan', requireLogin, (req, res) => {
        try {
            res.json(landmine.plan(sizes(req.body)));
        } catch (e) {
            res.status(e.status || 400).json({ ok: false, error: e.message || 'Could not plan that landmine', parts: [], notes: [] });
        }
    });

    app.post('/landmine/api/preview', requireLogin, (req, res) => {
        try {
            res.json(landmine.preview(sizes(req.body)));
        } catch (e) {
            res.status(e.status || 400).json({ ok: false, error: e.message || 'Could not build the preview', parts: [] });
        }
    });

    app.post('/landmine/api/kit', requireLogin, (req, res) => {
        try {
            const zip = landmine.kitZip(sizes(req.body));
            res.set('Content-Type', 'application/zip');
            res.set('Content-Disposition', 'attachment; filename="landmine.zip"');
            res.send(zip);
        } catch (e) {
            res.status(e.status || 400).json({ error: e.message || 'Could not build that landmine' });
        }
    });
}

module.exports = mount;
