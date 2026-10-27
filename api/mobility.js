'use strict';

/**
 * mobility.js - ready-made mobility / prep / injury-prevention routines, linked to
 * the joints and muscles the Body Map uses (personal-training roadmap phase 4).
 *
 *   GET  /mobility/api/routines          all routines + today's done flags (ET)
 *   GET  /mobility/api/joint/:id         drills for one joint
 *   GET  /mobility/api/muscle/:id        drills for one muscle
 *   POST /mobility/api/done  { routine, done?: true|false }   log (or undo) today
 *
 * The routines are code, not rows: nothing to seed, nothing to migrate. The only
 * state is "did I do routine R on ET date D", kept as a UserSetting row
 * `routineDone:<routine>:<date>` in the account's OWN sqlite file (database per
 * user, so no owner column). Additive, no schema change.
 *
 * Every item names joint ids and muscle ids from lib/muscles.js; the test fails
 * if one does not exist. `pose` is optional: items with no figure are text only.
 * `demo` is the library-style name StretchDemo/PoseMap resolves to a figure.
 */

const M = require('../lib/muscles');

const NOTE = 'Stretch to tension, not pain. If an Achilles, knee or groin hurts more the next morning, back off and get it checked.';

const item = (id, name, rx, joints, muscles, cue, demo) => ({ id, name, rx, joints, muscles, cue, demo: demo || name });

const ROUTINES = [
  {
    id: 'daily-10', name: 'Daily 10', minutes: 10, kind: 'daily',
    blurb: 'Hips, calves, Achilles, upper back and neck. Every day.',
    items: [
      item('hip-flexor-glute', 'Half-kneeling hip-flexor stretch with glute squeeze', '45 s each side', ['hip', 'lumbar_spine'], ['hip_flexors', 'glutes'],
        'Back knee down, squeeze the back-leg glute, ribs down, lean forward until you feel the front of the hip.', 'Couch Stretch'),
      item('calf-wall-straight', 'Calf wall stretch, straight knee', '30 s each side', ['ankle', 'knee'], ['calves'],
        'Hands on the wall, back leg straight, heel down.', 'Calf Stretch'),
      item('calf-wall-bent', 'Calf wall stretch, bent knee (soleus)', '30 s each side', ['ankle', 'knee'], ['calves'],
        'Same stance, soften the back knee and keep the heel down.', 'Calf Stretch'),
      item('split-squat-ktoes', 'Slow knees-over-toes split squat', '1 x 10 each side', ['knee', 'ankle', 'hip'], ['quads', 'calves'],
        'Slow, heel down, let the knee travel past the toes, pain-free range only.', 'Split Squat'),
      item('heel-drop', 'Eccentric heel drops off a step', '2 x 10, 3 s down', ['ankle'], ['calves'],
        'Rise on both feet, lower on one for 3 seconds. Achilles work: go easy at first.', 'Calf Raise'),
      item('open-book', 'Open-book rotation', '5 each side', ['thoracic_spine', 'shoulder'], ['traps', 'lats'],
        'Side-lying, knees stacked, open the top arm and follow it with your eyes.', 'Open Book'),
      item('neck-cars-iso', 'Neck circles + isometric hand presses', '10 s each direction', ['neck'], ['neck', 'traps'],
        'Slow circles, then press a hand into your head and hold without moving.', 'Neck Circle'),
    ],
  },
  {
    id: 'pre-training', name: 'Pre-training warm-up', minutes: 5, kind: 'warmup',
    blurb: 'All dynamic. Before any session.',
    items: [
      item('hip-cars', 'Hip CARs', '5 slow circles each side', ['hip'], ['hip_flexors', 'glutes', 'adductors'], 'Biggest pain-free circle, rest of the body still.', 'Quadruped Hip CARs'),
      item('shoulder-cars', 'Shoulder CARs', '5 slow circles each side', ['shoulder'], ['rotator_cuff', 'front_delts', 'rear_delts'], 'Reach long, make the biggest circle you own.', 'Shoulder CARs'),
      item('leg-swings', 'Leg swings', '10 each direction, each leg', ['hip'], ['hamstrings', 'hip_flexors', 'adductors'], 'Front-back then side-side, easy range first.', 'Hip Circle'),
      item('ankle-rocks', 'Ankle rocks', '10 each side', ['ankle', 'knee'], ['calves'], 'Knee over the toes, heel stays down.', 'Ankle Dorsiflexion'),
      item('band-pull-aparts', 'Band pull-aparts', '15', ['shoulder', 'thoracic_spine'], ['rear_delts', 'traps'], 'Arms straight, pull the band to your chest.', 'Band Pull-Apart'),
    ],
  },
  {
    id: 'injury-prevention', name: 'Injury-prevention strength', minutes: 15, kind: 'strength', perWeek: 2,
    blurb: 'About 15 minutes, twice a week (attached to training days A and C of the week plan).',
    items: [
      item('copenhagen', 'Copenhagen side plank', '2 x 20 s each side', ['hip', 'knee'], ['adductors'], 'Groin insurance. Bottom leg supported on a bench, short lever first.', 'Side Plank'),
      item('tib-raise', 'Tibialis raises', '2 x 15', ['ankle', 'knee'], ['calves'], 'Heels on the floor, back to a wall, lift the toes.'),
      item('band-er', 'Band external rotations', '2 x 15 each side', ['shoulder'], ['rotator_cuff', 'rear_delts'], 'Elbow at your side, rotate out, slow back.', 'Prone Shoulder ER'),
      item('face-pull', 'Face pulls', '2 x 15', ['shoulder', 'thoracic_spine'], ['rear_delts', 'traps', 'rotator_cuff'], 'Pull to the eyes, elbows high.', 'Resistance Band Face Pull'),
      item('sl-bridge', 'Single-leg bridge or hamstring walkouts', '2 x 8 each side', ['hip', 'knee'], ['hamstrings', 'glutes'], 'Slow lower. Hamstring insurance.', 'Glute Bridge'),
      item('finger-wrist', 'Band finger extensions + wrist curls', '2 x 15 each', ['wrist', 'elbow'], ['forearms'], 'Open against the band, then light wrist curls.'),
      item('side-plank', 'Side plank', '2 x 30 s each side', ['lumbar_spine'], ['obliques', 'glutes'], 'Straight line from ankle to ear.', 'Side Plank'),
      item('dead-bug', 'Dead bug', '2 x 8 each side', ['lumbar_spine', 'hip'], ['abs', 'hip_flexors'], 'Low back stays flat, move slowly.', 'Dead Bug'),
    ],
  },
  {
    id: 'sunday-flow', name: 'Sunday flow', minutes: 25, kind: 'flow',
    blurb: '20-30 minutes, slow and easy.',
    items: [
      item('9090', '90/90 hip switches', '10 switches', ['hip'], ['piriformis', 'glutes', 'adductors'], 'Sit tall, rotate both knees across without using your hands if you can.', '90/90'),
      item('pigeon', 'Pigeon', '60 s each side', ['hip'], ['glutes', 'piriformis', 'hip_flexors'], 'Fold forward over the front shin only as far as is comfortable.', 'Pigeon'),
      item('cossack', 'Cossack squat', '8 each side', ['hip', 'knee', 'ankle'], ['adductors', 'quads', 'glutes'], 'Sit into one hip, other leg straight, toes up.', 'Cossack'),
      item('pancake', 'Pancake', '90 s', ['hip', 'lumbar_spine'], ['adductors', 'hamstrings'], 'Legs wide, hinge forward from the hips.', 'Seated Fold'),
      item('childs-pose', "Child's pose", '60 s', ['lumbar_spine', 'shoulder', 'hip'], ['lats', 'lower_back'], 'Sink the hips back, breathe into the ribs.', "Child's Pose"),
      item('thread-needle', 'Thread the needle', '45 s each side', ['thoracic_spine', 'shoulder'], ['traps', 'rear_delts'], 'Slide one arm under the other, rotate through the upper back.', 'Thread The Needle'),
    ],
  },
  {
    id: 'run-pre', name: 'Pre-run', minutes: 4, kind: 'run',
    blurb: 'Dynamic, before a run.',
    items: [
      item('a-skips', 'A-skips', '2 x 20 m', ['hip', 'ankle'], ['hip_flexors', 'calves'], 'Tall, quick, knee up and foot down under you.', 'Run'),
      item('run-leg-swings', 'Leg swings', '10 each leg', ['hip'], ['hamstrings', 'hip_flexors'], 'Hold a wall, swing front to back.', 'Hip Circle'),
      item('ankle-pogo', 'Ankle pogo hops', '2 x 15', ['ankle', 'knee'], ['calves'], 'Stiff ankles, quick and quiet, stay light.', 'Jump Rope'),
    ],
  },
  {
    id: 'run-post', name: 'Post-run', minutes: 5, kind: 'run',
    blurb: 'Calves, hip flexors and hamstrings after a run.',
    items: [
      item('post-calf', 'Calf and soleus wall stretch', '30 s each leg, straight then bent', ['ankle', 'knee'], ['calves'], 'Heel down, straight knee then bent.', 'Calf Stretch'),
      item('post-hip-flexor', 'Hip-flexor stretch', '45 s each side', ['hip', 'lumbar_spine'], ['hip_flexors'], 'Half-kneeling, squeeze the glute.', 'Couch Stretch'),
      item('post-hamstring', 'Hamstring stretch', '45 s each side', ['hip', 'knee'], ['hamstrings'], 'Heel out in front, hinge from the hips.', 'Standing Hamstring Stretch'),
    ],
  },
];

const byId = new Map(ROUTINES.map(r => [r.id, r]));
const DAILY_ID = 'daily-10';

function itemsFor(kind, id) {
  const out = [];
  for (const r of ROUTINES) for (const it of r.items) {
    if ((kind === 'joint' ? it.joints : it.muscles).includes(id)) {
      out.push({ routineId: r.id, routine: r.name, ...it });
    }
  }
  return out;
}

/** Items are the single source; the page and Body Map get a plain copy. */
function publicRoutines() { return JSON.parse(JSON.stringify(ROUTINES)); }

// ── Done log ─────────────────────────────────────────────────────────────────

const etDate = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const doneKey = (routine, date) => `routineDone:${routine}:${date}`;

async function isDone(db, routine, date) {
  return !!(await db.UserSetting.findByPk(doneKey(routine, date)));
}

async function setDone(db, routine, done, date = etDate()) {
  if (!byId.has(routine)) { const e = new Error('unknown routine'); e.status = 404; throw e; }
  if (done === false) await db.UserSetting.destroy({ where: { key: doneKey(routine, date) } });
  else await db.UserSetting.upsert({ key: doneKey(routine, date), value: new Date().toISOString() });
  return { routine, date, done: done !== false };
}

async function doneToday(db, date = etDate()) {
  const rows = await db.UserSetting.findAll({ where: { key: ROUTINES.map(r => doneKey(r.id, date)) } });
  const have = new Set(rows.map(r => r.key));
  return Object.fromEntries(ROUTINES.map(r => [r.id, have.has(doneKey(r.id, date))]));
}

function mount(app, { requireLogin, getDatabase }) {
  const handler = (fn) => async (req, res) => {
    try {
      const db = getDatabase(req.user.username);
      await db.sequelize.sync();
      res.json({ success: true, ...(await fn(db, req)) });
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error('mobility:', e.message);
      res.status(status).json({ success: false, error: status === 500 ? 'failed' : e.message });
    }
  };
  app.get('/mobility/api/routines', requireLogin, handler(async (db) => ({
    note: NOTE, date: etDate(), routines: publicRoutines(), done: await doneToday(db),
  })));
  app.get('/mobility/api/:kind(joint|muscle)/:id', requireLogin, handler(async (db, req) => {
    const { kind, id } = req.params;
    if (!(kind === 'joint' ? M.isJoint(id) : M.isMuscle(id))) { const e = new Error(`unknown ${kind}`); e.status = 404; throw e; }
    return { note: NOTE, items: itemsFor(kind, id) };
  }));
  app.post('/mobility/api/done', requireLogin, handler(async (db, req) => {
    const b = req.body || {};
    return setDone(db, String(b.routine || ''), b.done);
  }));
}

module.exports = mount;
Object.assign(module.exports, { ROUTINES, NOTE, DAILY_ID, itemsFor, publicRoutines, etDate, doneKey, isDone, setDone, doneToday });
