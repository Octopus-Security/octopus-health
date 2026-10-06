'use strict';

/**
 * week-plan.js — a three-day-a-week plan drawn from the skill tree, with the
 * user's benchmarks added by benchmarks.buildWeek (so no plan built here can
 * omit them).
 *
 * Each training day is a list of LINE slots. A slot becomes the user's FRONTIER
 * skill in that line: the first skill (tree order) that is unlocked, not yet
 * achieved, and allowed by their equipment. So the plan moves as they progress
 * and never asks a bar-less user for pull-ups. A line with nothing available
 * simply contributes no block.
 *
 * `focus` biases the week (push, pull, skills, endurance, legs, core): it adds
 * the focus lines to every training day. `balanced` adds nothing.
 *
 * The prose of each exercise stays in content/calisthenics (blocks link to it);
 * this file only chooses and orders.
 */

const T = require('./skill-tree');
const B = require('./benchmarks');

const ROUTINES = {
  fullBody: 'content/calisthenics/routines/beginner-full-body-3x-week.md',
  skillDay: 'content/calisthenics/routines/skill-day.md',
  greaseTheGroove: 'content/calisthenics/routines/grease-the-groove-20-min.md',
};

// Day A / B / C slots. Strength first, skill work while fresh.
const DAY_SLOTS = [
  ['push', 'legs', 'core', 'handstand'],
  ['dips', 'hinge', 'lsit', 'planche'],
  ['push', 'legs', 'core', 'mobility'],
];

const FOCUS_LINES = {
  push: ['push', 'handstand'],
  pull: ['pull', 'rows'],
  skills: ['handstand', 'planche', 'lsit', 'levers'],
  legs: ['legs', 'hinge'],
  core: ['core', 'lsit'],
  endurance: [],
  balanced: [],
};

function frontier(tree, st, have, line) {
  const inLine = tree.skills.filter(s => s.line === line);
  return inLine.find(s => st.get(s.id).status === 'unlocked' && T.missingEquipment(s, have).length === 0) || null;
}

function block(tree, st, have, s) {
  return {
    skillId: s.id, name: s.name, line: s.line,
    sets: s.criterion.sets,
    target: T.formatCriterion(s.criterion),
    instruction: `${s.criterion.sets} sets, working toward ${T.formatCriterion(s.criterion)}`,
    how: s.how,
    ref: s.ref ? `content/calisthenics/${s.ref.file}` : null,
  };
}

/**
 * @param ctx {tree, st, have, focus, benchmarks, lastByItem, date, benchmarkDay}
 */
function buildPlan(ctx) {
  const { tree, st, have, focus = 'balanced', benchmarks, lastByItem, date, benchmarkDay } = ctx;
  const extra = FOCUS_LINES[focus] || [];
  const warmup = tree.byId.get('wrist-prep');
  const trainingBlocks = di => {
    const lines = [...DAY_SLOTS[di % DAY_SLOTS.length]];
    // Focus lines are added to every day, de-duplicated against the day's own.
    for (const l of extra) if (!lines.includes(l)) lines.push(l);
    const blocks = [];
    const used = new Set();
    for (const l of lines) {
      const s = frontier(tree, st, have, l);
      if (s && !used.has(s.id)) { used.add(s.id); blocks.push(block(tree, st, have, s)); }
    }
    if (focus === 'endurance') {
      blocks.push({ skillId: null, name: 'Easy treadmill session', line: 'endurance', sets: 1, target: '15-30 min at an easy, conversational pace',
        instruction: 'One steady treadmill session at a pace where you can talk. Add a few minutes a week.', how: 'Not a test: no speed targets.', ref: null });
    }
    if (warmup && !blocks.some(b => b.skillId === 'wrist-prep')) blocks.unshift(block(tree, st, have, warmup));
    return blocks;
  };
  const week = B.buildWeek({ date, benchmarks, lastByItem, benchmarkDay, trainingBlocks });
  return {
    ...week, focus,
    routines: ROUTINES,
    note: 'Three training days plus benchmark day. Warm up the wrists first. Stop sets 1-2 reps short of failure; the standards are coaching conventions, not tests. Rest days between training days.',
  };
}

module.exports = { buildPlan, frontier, ROUTINES, DAY_SLOTS };
