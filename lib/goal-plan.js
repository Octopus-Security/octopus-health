'use strict';

// What a goal card can show besides the one progression paragraph:
// the arrow / phase steps already stored on the goal, the add-on phases and
// their exercises, and the skill-tree steps when the title is that skill.

const addons = require('../api/addons');
const skills = require('../api/skill-tree');

function norm(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function progressionSteps(text) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    let chunks = raw.split(/\s*(?=\bPhase\s+\d+\b)/i).map((s) => s.trim()).filter(Boolean);
    if (chunks.length < 2) chunks = [raw];
    const steps = [];
    for (const chunk of chunks) {
        if (chunk.includes('→') || chunk.includes('->')) {
            for (const bit of chunk.split(/\s*(?:→|->)\s*/)) {
                const t = bit.trim();
                if (t) steps.push(t);
            }
        } else if (chunks.length > 1) {
            steps.push(chunk);
        }
    }
    return steps.length > 1 ? steps : [];
}

function routineMap() {
    let list = [];
    try {
        list = require('../api/mobility').ROUTINES || [];
    } catch {
        list = [];
    }
    return new Map(list.map((r) => [r.id, r]));
}

function itemView(raw, routines) {
    if (raw && raw.routine !== undefined) {
        const found = routines.get(raw.routine);
        return {
            kind: 'routine',
            name: found ? found.name : raw.routine,
            detail: found && found.minutes ? found.minutes + ' min' : '',
            note: '',
            drills: ((found && found.items) || []).map((it) => ({ name: it.name, detail: it.rx || '' })),
        };
    }
    const detail = raw && raw.duration != null
        ? raw.sets + '×' + raw.duration + ' s'
        : (raw ? raw.sets + '×' + raw.reps : '');
    return {
        kind: 'exercise',
        name: raw ? raw.exercise : '',
        detail,
        note: (raw && raw.note) || '',
        drills: [],
    };
}

const WHERE = {
    training: 'on training days',
    rest: 'on rest days',
    any: 'any day',
    daily: 'every day',
};

function outlineAddon(addon, week) {
    const routines = routineMap();
    return {
        id: addon.id,
        title: addon.title,
        honesty: addon.honesty || '',
        week: week == null ? null : week,
        phases: addon.weeks.map((ph) => ({
            label: addons.phaseLabel(ph),
            focus: ph.focus,
            current: week != null && week >= ph.from && (ph.to === null || week <= ph.to),
            tracks: ph.tracks.map((tr) => ({
                times: tr.sessionsPerWeek === 1 ? 'Once a week' : tr.sessionsPerWeek + ' times a week',
                where: WHERE[tr.placement] || tr.placement,
                sessions: tr.sessions.map((sess, i) => ({
                    label: 'Session ' + String.fromCharCode(65 + i),
                    items: sess.map((raw) => itemView(raw, routines)),
                })),
            })),
        })),
    };
}

function namesOf(skill) {
    return [skill.name, ...(skill.aliases || [])].map(norm);
}

function matchQuery(tree, query) {
    if (!query || !String(query).trim()) return null;
    const found = skills.findSkill(tree, query);
    if (!found || found.candidates) return null;
    if (found.line) return { line: found.line };
    const q = norm(query);
    const names = namesOf(found.skill);
    const hit = names.some((n) => n === q || (n.split(' ').filter(Boolean).length >= 2 && (' ' + q + ' ').includes(' ' + n + ' ')));
    return hit ? { skill: found.skill } : null;
}

function skillView(tree, match) {
    if (!match) return null;
    let rows;
    let title;
    if (match.line) {
        title = skills.LINES[match.line] ? skills.LINES[match.line].title : match.line;
        rows = tree.skills.filter((s) => s.line === match.line);
    } else {
        title = match.skill.name;
        rows = skills.ancestorsInOrder(tree, match.skill.id).map((id) => tree.byId.get(id));
    }
    return {
        title,
        steps: rows.filter(Boolean).map((s) => ({
            name: s.name,
            how: s.how || '',
            detail: s.criterion ? skills.formatCriterion(s.criterion) : '',
        })),
    };
}

function addonFor(goal, row) {
    if (row && row.addonId) {
        const addon = addons.getAddon(row.addonId);
        if (addon) return { addon, start: row.startDate || null };
    }
    if (!String(goal.description || '').startsWith('Add-on:')) return null;
    const title = norm(goal.title);
    const addon = addons.CATALOGUE.find((a) => norm(a.title) === title);
    return addon ? { addon, start: null } : null;
}

function pickRows(rows) {
    const rank = { active: 0, paused: 1, done: 2 };
    const by = new Map();
    for (const row of rows || []) {
        if (!row || !row.goalId) continue;
        const prev = by.get(row.goalId);
        const r = rank[row.status] == null ? 9 : rank[row.status];
        const pr = prev ? (rank[prev.status] == null ? 9 : rank[prev.status]) : 99;
        if (!prev || r < pr) by.set(row.goalId, row);
    }
    return by;
}

function plain(goal) {
    if (goal && typeof goal.get === 'function') return goal.get({ plain: true });
    return goal || {};
}

function forGoals(goals, addonRows, today) {
    const tree = skills.loadTree();
    const by = pickRows(addonRows);
    const out = {};
    for (const goal of goals || []) {
        const g = plain(goal);
        const linked = addonFor(g, by.get(g.id));
        let week = null;
        if (linked && linked.start && today) {
            try { week = addons.weekIndex(linked.start, today); } catch { week = null; }
        }
        const skillHit = matchQuery(tree, g.title) || matchQuery(tree, g.exerciseName);
        out[g.id] = {
            steps: progressionSteps(g.progression),
            addon: linked ? outlineAddon(linked.addon, week) : null,
            skill: skillView(tree, skillHit),
        };
    }
    return out;
}

module.exports = { progressionSteps, forGoals, outlineAddon, matchQuery };
