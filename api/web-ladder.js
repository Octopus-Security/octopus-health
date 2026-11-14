'use strict';

// Browser designer for the collapsible ladder. No database: every plan is the
// numbers on the page. Login matches the other tools. Handlers answer JSON
// themselves because /ladder/api is not under /api/, so the app error handler
// would send an HTML page to fetch().

const ladder = require('../lib/ladder');

function mount(app, { requireLogin }) {
    app.get('/ladder', requireLogin, (req, res) => {
        const input = ladder.defaults();
        let plan;
        try {
            plan = ladder.plan(input);
        } catch (e) {
            plan = {
                ok: false,
                lines: [e.message || 'Could not build that ladder'],
                parts: [],
                svg: '',
                runs: input.runs,
                messages: [],
                warnings: [],
            };
        }
        res.render('ladder', {
            title: 'Agility ladder',
            user: req.user,
            input,
            plan,
        });
    });

    app.post('/ladder/api/plan', requireLogin, (req, res) => {
        try {
            res.json(ladder.plan(req.body || {}));
        } catch (e) {
            const message = e.message || 'Could not build that ladder';
            res.status(e.status || 400).json({
                ok: false,
                error: message,
                lines: [message],
                parts: [],
                svg: '',
            });
        }
    });

    app.post('/ladder/api/kit', requireLogin, (req, res) => {
        try {
            const zip = ladder.kitZip(req.body || {});
            res.set('Content-Type', 'application/zip');
            res.set('Content-Disposition', 'attachment; filename="agility-ladder.zip"');
            res.send(zip);
        } catch (e) {
            res.status(e.status || 400).json({ error: e.message || 'Could not build that kit' });
        }
    });
}

module.exports = mount;
