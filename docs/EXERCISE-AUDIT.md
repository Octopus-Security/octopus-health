# Exercise and animation audit

A read-only audit of every exercise, mobility item and stick-figure animation in the app, and the guards that now keep the same problems from coming back. Line numbers are against the commit this audit was taken on (`3fbbd6c`) and will drift; the guards, not the numbers, are the durable part.

The aim: the app can be shown to real customers by a personal trainer, so content has to stay inside a trainer's scope (movement instruction, general programming). No diagnosis, treatment, rehabilitation or medical claims, and nothing a beginner could hurt themselves on without a coach.

## What was checked

- 413 library exercises (`database.js`, `SEED_EXERCISES`), 154 mobility items in 20 routines (`api/mobility.js`, `ROUTINES`), 70 skill-tree skills, 54 martial-arts technique snapshots (`lib/mma-moves.json`), and the dose rows in the workout templates and stretch plans.
- 182 health pose files plus the technique snapshots. All pass `validate()` in `public/stick-figure.js` (joint ranges, bone lengths, floor, bounds). So the figure findings below are semantic (wrong movement for the name), not geometric.
- Exercise to figure is by regex on the name in `public/pose-map.js` (first match wins), then by category fallback. Skill-tree and mobility items carry no pose field; mobility uses a `demo` name run through the same rules.
- Mechanical findings: 10 high, 118 medium, 42 low. The headline items are below. Numbers refer to the finding id used in `test/helpers/exercise-ratchet.js`.

## Findings

### Scope and safety

1. Lymph-drainage routine (`api/mobility.js:382`, `database.js:467`, ids `lh-*`): self-treatment wording tied to one person's situation, directional "move fluid" instructions, and sources noted as not checked. Out of a trainer's scope.
2. Martial submissions listed as ordinary sets-and-reps exercises (`database.js:300-312`: armbar, triangle, rear naked choke, guillotine, kimura, americana, omoplata, bow and arrow, D'Arce, heel hook, straight ankle lock, cross collar choke, clock choke). Joint locks and chokes with a default dose and finishing cues. Unsafe without a coach and a partner.
3. Shin Conditioning on Bag (`database.js:277`): a physiological claim ("micro-trauma for bone density") with no source.
4. Neck Bridge (`database.js:93`), Wrestler's Bridge, Inversion Drill (`database.js:154`), Granby and Back Roll (`database.js:153`, `159`): loaded-neck or inverted work with a default dose and a progression, without conservative cues.
5. Treatment wording in names: "Lumbar Decompression Hang" (`database.js:368`) and the "Injury-prevention strength" routine (`api/mobility.js:74`). The banned-word regex matches both; the old test only covered newly added exercises, so they slipped through.
6. Jefferson Curl (`database.js:135`): loaded spinal flexion presented to general clients.

### Wrong figure, dead link

7. Quick-log aliases (`api/workout-parse.js:557`): 10 of 12 aliases pointed at names that do not exist in the library ("Bench Press" vs "Barbell Bench Press", and so on). The old test used a made-up library, which is why it passed.
8. Clamshell uses the open-book (arm rotation) figure (`public/pose-map.js:26`).
9. Rear Delt Fly and Band Pull-Apart use the front-view chest-fly figure with a dumbbell (`public/pose-map.js:169`).
10. Static holds and hangs (Wall Sit, Spanish Squat, Scapular Pull-up, Towel Hang, Flexed-Arm Hang, Tuck L-sit, Pseudo-Planche Lean, Tibialis Raise, wrist curls) show the moving category squat. A `null` rule only suppresses a wrong name match; `views/library.ejs:291` still falls to the category figure for non-martial categories.
11. Scapular Push-up shows the full push-up (elbows bend; the exercise keeps them locked).
12. Prone Shoulder ER stretch cue presses into internal rotation, and the same figure serves the external-rotation strengthening drills.
13. Reverse Tabletop and Crab Reach use the crab-walk figure (`public/pose-map.js:35-38`); Landmine Anti-Rotation (a brace) uses the wood-chop figure; Landmine Split Jerk uses a plain overhead press.

### Medium

14. Implement mismatch (38 library exercises) and missing implement (7): barbell exercises showing a dumbbell, dumbbell presses showing a barbell, cable and machine items showing dumbbells, all landmine items showing a ball or barbell.
15. 36 library exercises and 22 mobility demos have no name rule and show the category figure.
16. Body Map: `full_body` resolves to nothing (`lib/muscles.js:125`), so burpee, get-up, rowing and martial combinations never appear on any muscle. `balance` and `cardio` are qualities, not regions, and resolve to nothing on purpose.
17. 22 exercises whose figure highlights a region that is not the muscle the entry claims.
18. Near-duplicate entries and shared videos (for example the three dumbbell-row variants).
19. Names that disagree with content (a "Finger Extension Stretch" that is a strengthening drill; "Barbell Pendulum Squat", a machine movement).
20. Unsourced benefit claims in cues ("targets outer chest", "maximizes tricep involvement", "reduces wrist strain", "builds striking power").
21. Contradiction: Standing Crossover IT Band Stretch claims the IT band as primary while the IT band foam-roll cue says the band itself is not what is worked.
22. All default doses are unsourced. A carry's dose unit is ambiguous.

### Low

23. Three orphan poses used by no exercise; a typo in one cue.
24. 97 poses are shared by two or more items. Fine for variants of one movement, wrong for the cases above.

## Status of the figure findings (#8-#15)

Fixed on branch `fix/exercise-figures`: #8 to #13 (Clamshell, Rear Delt Fly, Band Pull-Apart, Scapular Push-up, the external-rotation drills, Reverse Tabletop, Crab Reach, the landmine items, the lunges), #10 (every static hold and hang now has its own figure) and #14 (implement mismatches: `IMPLEMENT` is empty). #15: the category-fallback list went from 57 to 16, all of them either the lymphatic routine (no figure on purpose) or three foot drills the stick figure has no segments to show. The Prone Shoulder ER Stretch keeps its figure; the cue-wording half of #12 is copy, not a figure, and is not changed here.

## Guards

All in `test/exercise-guards.test.js`, as **ratchets**: known offenders live in `test/helpers/exercise-ratchet.js`, each with a reason and the finding id above. The suite passes today, fails on any new offender, and fails on a known entry that has since been fixed and not removed, so the lists only shrink.

| Guard | What it checks | Ratchet list |
|---|---|---|
| Pose table | `docs/exercise-pose-table.md`, generated by `node scripts/pose-table.mjs`, lists every exercise and mobility item with its resolved figure and whether a rule or the fallback produced it. The test fails when the committed table is stale, so any pose or rule change shows in the PR diff as the exercises whose figure changed. | none (it is a diff) |
| Fallback | A non-martial item on the category fallback fails unless allowlisted with a reason. | `FALLBACK` |
| Implement vs equipment | The implement a figure holds must match the item's equipment. | `IMPLEMENT` |
| Aliases | Every quick-log alias target must resolve in the real seed library. | `ALIAS` |
| Banned claims | The repo's banned-word regex (`test/helpers/banned.js`) applied to every exercise name and cue, routine name and blurb, mobility item, template, plan and skill. | `CLAIMS` |
| Body Map tags | Every muscle or joint tag used must resolve to something in `lib/muscles.js`. | `MUSCLE_TAGS` |

## Viewing the figures

- `node scripts/pose-gallery.cjs [poseKeyRegex] [cellPx] [out.html]` writes a contact sheet: every pose, each key frame plus the midpoint to the next, with the exercises that use it. It needs no new dependencies.
- `node scripts/pose-shot.cjs /abs/path/sheet.html out.png` screenshots it. This needs Playwright, which is not a dependency of this repo: resolve it from another checkout via `NODE_PATH`, and set `CHROMIUM_PATH` if its own browser download is not installed.

A figure that animates correctly can still be the wrong movement for the name; the validator cannot catch that. The pose table plus the contact sheet is the review path: change a rule, read the table diff, look at the sheet for the figures involved.
