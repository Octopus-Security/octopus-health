#!/usr/bin/env node
'use strict';
/**
 * audit-sessions.js — print what is actually in the workout log, by day.
 *
 * The chat is not evidence. Neith reported a ten-exercise Monday session
 * carrying Sunday's squats and rows, and separately reported a "review" built
 * from the conversation rather than from the database — so what the log
 * contains and what the chat claims have to be checked independently.
 *
 * Read-only. Nothing here writes, so it is safe to run against production.
 *
 *   docker exec octopus_health node api/audit-sessions.js            # last 7 days
 *   docker exec octopus_health node api/audit-sessions.js 2026-08-03 # one day
 *   docker exec octopus_health node api/audit-sessions.js --days 14
 */

const getDatabase = require('../database');
const SERVICE_USER = process.env.HEALTH_SERVICE_USER || 'psychopathy';

const arg = process.argv.slice(2);
const dayArg  = arg.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
const daysArg = Number((arg.find(a => a.startsWith('--days')) || '').split(/[= ]/)[1]
  || arg[arg.indexOf('--days') + 1]) || 7;

(async () => {
  const db = await getDatabase(SERVICE_USER);
  const { WorkoutSession, sequelize } = db;
  const { QueryTypes } = require('sequelize');

  const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const from = dayArg || new Date(Date.now() - (daysArg - 1) * 864e5)
    .toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const to = dayArg || todayET;

  const sessions = await sequelize.query(
    `SELECT id, date, type, title, createdAt FROM WorkoutSessions
      WHERE date BETWEEN :from AND :to ORDER BY date ASC, id ASC`,
    { replacements: { from, to }, type: QueryTypes.SELECT },
  );

  console.log(`Workout log for ${SERVICE_USER}, ${from} → ${to}  (today is ${todayET} ET)\n`);
  if (!sessions.length) return console.log('  nothing logged in that range');

  for (const s of sessions) {
    const sets = await sequelize.query(
      `SELECT exerciseName, exerciseOrder, setNumber, reps, weight, weightUnit, duration
         FROM WorkoutSets WHERE sessionId = :id
        ORDER BY exerciseOrder ASC, setNumber ASC`,
      { replacements: { id: s.id }, type: QueryTypes.SELECT },
    );

    // When the row was WRITTEN vs the day it is filed under. A gap between them
    // is the signature of a session logged for the wrong day.
    const wrote = s.createdAt ? String(s.createdAt).slice(0, 10) : '?';
    const flag  = wrote !== '?' && wrote !== s.date ? `   ⚠ written on ${wrote}` : '';
    console.log(`── ${s.date}  session #${s.id}  ${s.title || s.type}${flag}`);

    const byExercise = [];
    for (const r of sets) {
      let ex = byExercise.find(e => e.name === r.exerciseName);
      if (!ex) { ex = { name: r.exerciseName, sets: [] }; byExercise.push(ex); }
      ex.sets.push(r.duration && !r.reps
        ? `${r.duration}s`
        : (r.weight != null ? `${r.weight}${r.weightUnit || 'lbs'}×${r.reps}` : `${r.reps} reps`));
    }
    if (!byExercise.length) console.log('     (no sets — an empty session)');
    for (const e of byExercise) console.log(`     ${e.name.padEnd(28)} ${e.sets.join(' / ')}`);
    console.log('');
  }

  // Same exercise, same numbers, on more than one day: either a real repeat or a
  // copy that predates the dedupe guard.
  const dupes = await sequelize.query(
    `SELECT s.exerciseName, COUNT(DISTINCT ws.date) AS days, GROUP_CONCAT(DISTINCT ws.date) AS onDates
       FROM WorkoutSets s JOIN WorkoutSessions ws ON ws.id = s.sessionId
      WHERE ws.date BETWEEN :from AND :to
      GROUP BY s.exerciseName, s.reps, s.weight
     HAVING days > 1`,
    { replacements: { from, to }, type: QueryTypes.SELECT },
  );
  if (dupes.length) {
    console.log('Identical sets appearing on more than one day — check these are real repeats:');
    for (const d of dupes) console.log(`  ${d.exerciseName} — ${d.onDates}`);
  }
  process.exit(0);
})().catch(e => { console.error('audit failed:', e.message); process.exit(1); });
