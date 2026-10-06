# HANDOFF (octopus-health)

## Done (branch claude/skill-tree)
Skill tree (data in `content/calisthenics/skill-tree.json`), per-user attempts and
equipment, fitness-test catalogue with history/trends, treadmill progressive and
12-minute test page with generated audio, weekly benchmarks (seeded defaults,
editable, always in the weekly plan), reminder decision API for cortex. See README.

## Verified (ran)
`npm test` green (189 tests) using borrowed node_modules (express/ejs/sequelize/
sqlite3 from sibling repos via NODE_PATH, auth-client faked outside the repo).
Playwright Chromium, 390px: treadmill page loads, timer advances under a faked
clock (stage 1 at 11 s, stage 2 at 71 s, pause holds, stop reports the last
completed stage), no horizontal overflow on /tests/treadmill, /skills, /tests,
/benchmarks, /tools.

## NOT verified
Real audio output and speechSynthesis voices (headless has none; only the
scheduling code and the WAV bytes are tested). A real deploy. Real SSO.

## Facts that were expensive
- `req.is('application/json')` is null for body-less requests (DELETE); the JSON
  guard reads the header instead.
- A bare-digit benchmark query is an ID only; name matching on "6" would hit
  "Squats in 60 s".
- The reminder check must not create a database file for an account that never
  used health (the sweep runs for every linked chat user).
- Tuck/L-sit equipment uses "handles|dip-bars" (either).

## Next
Render the content ladders as pages; per-skill charts; a pull-up-bar-aware
starter plan variant for users with a bar (the plan already follows equipment).
