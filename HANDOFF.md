# HANDOFF (octopus-health)

## 2026-11-19 — Fix exercises, per-side flag, holds in the quick log

**Built (branch `feat/exercise-fixer`):** `/logs/exercises/fix` (bulk muscles, per-side, category and figure with
suggestions, preview then confirm, a figures view grouped by pose; linked from Exercises and the Body Map); the
`ExerciseDefinition.sides` column (additive) and `lib/sides.js`, applied in `lib/volume.js setFacts`; the volume
route matches a logged name to its library entry across case/punctuation/plurals; the quick-log parser reads timed
sets ("3x30 sec"), holds ("plank 30s") and more per-side wordings.

**Also fixed:** the two failures that were on main. `no-native-dialogs` (timer and tempo pages fell back to
`window.alert`/`confirm`; now the themed dialog or nothing, and a delete without a dialog is refused) and the LRU
eviction test, whose 10 ms grace window was shorter than opening the cache's handles on a slow machine.

**Verified (ran):** `npm test` 786/786 with borrowed node_modules. The page driven in headless Chromium against a
seeded account: accept suggestions, per-side, review, save; the Body Map's volume then maps every name but the one
with no suggestion; figures draw; no sideways scroll at 390px.

**Catalogue flags:** `SEED_SIDES` in database.js sets the flag on 32 one-sided and 72 two-sided catalogue exercises,
once per account (`exerciseSeedSidesV1`), only where the row's flag is empty. Lunges often logged as alternating
totals, Cossack squats and alternating push-ups are left for the owner.

**Stats pages** apply the flag to volume only (session volume, best-volume set, rep totals); weights and estimated
1RMs stay per side. The detail page says so for a unilateral exercise.

**Not verified:** a real account's log (the suggestions were checked against seeded names only).


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
