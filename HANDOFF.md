# HANDOFF (octopus-health)

## 2026-11-10 — figures and the audit

This note is safe to publish: health is a public repo. It does not describe
the deploy machinery.

**Open: health #38** (`fix/exercise-figures`). 95 exercises re-figured, 42 new
poses. Fallback ratchet 57 → 16, implement ratchet 45 → 0. Carries, a one-arm
landmine row and a tandem walk were fixed after review. The branch reported
570/570. Known figure limits are in the PR body. Merging deploys this app.
Health #35, #36 and #37 (guards and scope) are on main.

**Exercise audit** (`docs/EXERCISE-AUDIT.md`), still open after the figure pass:

- 16 intentional fallbacks (lymph items, foot drills).
- 11 names ending in "Release", held back because joining them to the log would
  attach the wrong history.
- A wording pass on cues.
- Doses that have no source.
- The assistant that suggests workouts has not been checked for the submissions
  whose doses were removed.

`cpt-foundations` in octopus-school has no Exercise Technique lesson. That
lesson, when it is written, is the consumer of these figures. It is not this
repo's work.

The sections below are the older skill-tree handoff. They are still true of
that work. They are not the current figure state.

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
