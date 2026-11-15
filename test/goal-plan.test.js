'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const plan = require('../lib/goal-plan');

function flatNames(view) {
    const out = [];
    if (!view || !view.addon) return out;
    for (const ph of view.addon.phases) {
        for (const tr of ph.tracks) {
            for (const sess of tr.sessions) {
                for (const it of sess.items) {
                    out.push(it.name);
                    for (const drill of it.drills || []) out.push(drill.name);
                }
            }
        }
    }
    return out;
}

test('a progression splits on arrows and on Phase labels', () => {
    assert.deepEqual(
        plan.progressionSteps('wall holds → chest-to-wall → freestanding'),
        ['wall holds', 'chest-to-wall', 'freestanding'],
    );
    const phases = plan.progressionSteps('Phase 1 wall holds. Phase 2 freestanding.');
    assert.ok(phases.length >= 2, phases.join(' | '));
    assert.match(phases[0], /Phase 1/);
    assert.match(phases[1], /Phase 2/);
    assert.deepEqual(plan.progressionSteps('one sentence with no break'), []);
});

test('an add-on goal lists every phase, including later exercises and kick drills', () => {
    const map = plan.forGoals([
        { id: 1, title: 'Splits (front and side)', description: 'Add-on: short holds' },
        { id: 2, title: 'Head-height kick', description: 'Add-on: hip range' },
    ], [], '2026-11-14');
    const splits = flatNames(map[1]);
    assert.ok(splits.includes('Half-Kneeling Hip Flexor Stretch'), splits.join(', '));
    assert.ok(splits.includes('Frog Stretch'), splits.join(', '));
    const kicks = flatNames(map[2]);
    assert.ok(kicks.includes('Kick Chamber Hold') || kicks.includes('Front-to-Back Leg Swing'), kicks.join(', '));
    assert.equal(map[1].addon.phases[0].current, false);
    assert.match(map[1].addon.honesty, /splits/i);
});

test('the week of a linked add-on is the current phase', () => {
    const map = plan.forGoals(
        [{ id: 3, title: 'Other name', description: '' }],
        [{ goalId: 3, addonId: 'splits', status: 'active', startDate: '2026-11-14' }],
        '2026-11-14',
    );
    assert.equal(map[3].addon.phases[0].current, true);
    assert.ok(map[3].addon.phases.slice(1).every((ph) => ph.current === false));
    assert.ok(flatNames(map[3]).includes('Half-Kneeling Hip Flexor Stretch'));
});

test('Visible Abs does not borrow the add-on unless the description says it is one', () => {
    const map = plan.forGoals([
        { id: 4, title: 'Visible Abs', description: 'Rollouts, then a longer hold.', exerciseName: 'Ab Roller Rollout' },
        { id: 5, title: 'Visible abs', description: 'Add-on: Three core sessions a week.' },
    ], [], '2026-11-14');
    assert.equal(map[4].addon, null);
    assert.ok(!flatNames(map[4]).includes('Dead Bug'));
    assert.equal(map[4].skill, null);
    assert.ok(flatNames(map[5]).includes('Dead Bug'));
});

test('a freestanding handstand goal shows the earlier skills', () => {
    const map = plan.forGoals([
        { id: 6, title: 'Freestanding Handstand', progression: 'wall holds → chest-to-wall → freestanding' },
    ], [], '2026-11-14');
    assert.deepEqual(map[6].steps, ['wall holds', 'chest-to-wall', 'freestanding']);
    const names = map[6].skill.steps.map((step) => step.name);
    assert.ok(names.includes('Freestanding handstand'), names.join(', '));
    assert.ok(names.includes('Wall handstand hold'), names.join(', '));
    assert.ok(names.indexOf('Wall handstand hold') < names.indexOf('Freestanding handstand'));
});
