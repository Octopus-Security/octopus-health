'use strict';

// Jump-rope handles. No database: the two parts are fixed, and the page only
// previews and downloads them. Login matches the other tools.

const rope = require('../lib/rope');

function mount(app, { requireLogin }) {
    app.get('/rope', requireLogin, (req, res) => {
        let plan;
        try {
            plan = rope.plan();
        } catch (e) {
            plan = { ok: false, lines: [e.message || 'Could not build the handles'], parts: [] };
        }
        res.render('rope', { title: 'Jump-rope handles', user: req.user, plan });
    });

    app.post('/rope/api/preview', requireLogin, (req, res) => {
        try {
            res.json(rope.preview());
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message || 'Could not build the preview', parts: [] });
        }
    });

    app.post('/rope/api/kit', requireLogin, (req, res) => {
        try {
            const zip = rope.kitZip();
            res.set('Content-Type', 'application/zip');
            res.set('Content-Disposition', 'attachment; filename="jump-rope-handles.zip"');
            res.send(zip);
        } catch (e) {
            res.status(400).json({ error: e.message || 'Could not build that kit' });
        }
    });
}

module.exports = mount;
