# content/ — training, nutrition and MMA reading

Plain Markdown articles, one per file, each with a small front-matter block
(`title`, `category`, `summary`, and `discipline` for the MMA pieces).

## Why it is plain files and not in the database

This app had no article or reading-content structure before this directory.
Its only "content" is seed data in `database.js` — exercises, workout templates
and training plans — which is written into **every user's database on login**,
and `main` auto-deploys through Portainer. Workout templates are also keyed by
`day:location` slugs (`mon:home`), which the Workout page reads as the day's
plan, so six extra templates would have appeared in every account's logger.
Putting prose into those seeds would have changed production data for both
accounts as a side effect of adding reading material.

So this batch is **not loaded by the app** yet. It ships in the image (nothing
excludes it) but no route serves it, and `.md` is not in `build.js`'s hashed
extensions, so it does not move `/api/build`. Rendering it (e.g. a `/learn`
page reading `content/**/*.md`) is a separate, deliberate change.

`test/content.test.js` checks the shape: every workout (and calisthenics
routine) has the six required sections, every MMA piece and calisthenics ladder
has safety notes, every ladder rung has a "Move up when" standard and a
"Regression", calisthenics equipment beyond bar/dip bars/handles is marked
optional, every file has front matter, and
every link on `links.md` is either the root of a short list of canonical domains
or marked "⚠ verify".

## Batch 1 (2026-09-25)

**Workouts** (`workouts/`) — each has Goal, Equipment, Warm-up, The session, Cool-down, Progression:

| File | Session |
|---|---|
| `full-body-dumbbell-strength.md` | Full-body strength, dumbbells + bench |
| `home-bodyweight-and-bands.md` | Home strength, pull-up bar + bands |
| `jump-rope-conditioning-circuit.md` | 5-round rope + bodyweight intervals |
| `grappler-posterior-chain-and-grip.md` | Gym S&C for grapplers: hinge, back, grip |
| `zone-2-aerobic-base.md` | Steady conversational-pace aerobic work |
| `mobility-and-core-reset.md` | Recovery-day mobility and trunk control |

**Nutrition** (`nutrition/`):

| File | Piece |
|---|---|
| `building-a-plate-macros-explained.md` | Plate / macros explainer (hand-portion method) |
| `meal-prep-without-the-boredom.md` | Component meal prep, a 2-hour routine |
| `hydration-for-training.md` | Hydration: everyday checks, around training, over-drinking |
| `myth-eating-late-makes-you-fat.md` | Myth debunked: late eating and fat gain |

**MMA** (`mma/`) — each explains the why and ends with safety notes:

| File | Area |
|---|---|
| `striking-the-jab.md` | Striking |
| `grappling-frames-and-the-hip-escape.md` | Grappling |
| `conditioning-for-the-five-minute-round.md` | Conditioning |
| `fight-iq-managing-distance-and-rounds.md` | Fight IQ |

**Links:** `links.md` — training, nutrition and MMA reference sites.

## Batch 2 (2026-09-25): calisthenics

For the owner's kit: **a pull-up bar, dip bars and push-up handles**. Anything
else (a chair, a cushion, a backpack for load) is marked optional. **Assumption,
stated in `calisthenics/README.md`:** the push-up handles are treated as
parallettes-style handles, i.e. stable enough for L-sits, crow and tuck planche.
If they only work for push-ups, do the support skills on the dip bars instead.

`calisthenics/README.md` explains how progression works: the standards
(3 × target reps, or 3 × target holds, with clean form), what "clean" means,
moving up, regressing, stalls and deloads, and safety across every ladder.

**Progression ladders** (`calisthenics/`). Every numbered rung has Equipment,
How, Common faults, Move up when and Regression:

| File | Rungs |
|---|---|
| `pull-ups.md` | Dead hang → scap pull → flexed-arm hang → negative → feet-assisted → full → L-sit → archer → typewriter → one-arm progressions |
| `chin-ups.md` | Flexed-arm hang → negative → feet-assisted → full → pause → weighted (optional load) |
| `rows.md` | Steep incline → lower incline → inverted (bent knees, then straight) → feet-elevated → archer; bar-height and dip-station tipping caveats |
| `dips.md` | Support hold → negative → feet-assisted → full → weighted (optional) → Russian; bench-dip and Korean-dip notes |
| `push-ups-on-handles.md` | Incline (dip bars) → full → deficit → archer → pseudo-planche → one-arm progressions |
| `pike-and-handstand-push-ups.md` | Pike → elevated → deficit on handles → wall handstand → HSPU negative → partial → full → deficit HSPU |
| `core-on-bars.md` | Hanging knee raise → leg raise → toes-to-bar → windshield wiper; tuck → one-leg → full L-sit (V-sit noted) |
| `legs.md` | Squat → split → Bulgarian → shrimp → pistol; glute bridge → single-leg bridge → single-leg RDL → Nordic |
| `skills-and-statics.md` | Support holds → tuck front lever → back lever line → crow → tuck planche → muscle-up prerequisites → muscle-up |

**Routines** (`calisthenics/routines/`), in the same six-section format as the workouts:

| File | Routine |
|---|---|
| `beginner-full-body-3x-week.md` | Full body, 3 non-consecutive days a week |
| `intermediate-push-pull-legs.md` | Push / pull / legs, 6 or 3 days a week |
| `skill-day.md` | Low-volume straight-arm and balance skill practice |
| `grease-the-groove-20-min.md` | Sub-maximal mini-sets through the day, about 20 min total |

**Links:** `links.md` gained a Calisthenics section: the r/bodyweightfitness
Recommended Routine wiki (⚠ verify), and *Overcoming Gravity* (Steven Low),
named as a book with no URL.

## Needs human verification

No studies are cited and no statistics were invented. These are the claims and
links a person should check before this is shown to anyone:

- **Links marked ⚠ verify in `links.md`** (9): health.gov physical-activity guidelines (root only), WHO physical-activity fact-sheet path, Harvard Nutrition Source domain, ISSN domain, ABC (Unified Rules) domain, IMMAF domain, Global DRO domain, CDC HEADS UP path, r/bodyweightfitness Recommended Routine wiki path. Unmarked links are long-standing canonical domains linked at their root, but **none was fetched**: the session that wrote them could not reach any of them (its proxy refused every host), so a quick click-through of all 24 is still owed.
- **Nutrition figures used:** ~4 kcal/g protein and carbohydrate, ~9 kcal/g fat; ~1 kg sweat loss ≈ 1 L fluid; refrigerated leftovers "within a few days / three to four days" (defer to foodsafety.gov).
- **Hydration:** the statement that combat-sports bodies changed rules after deaths linked to extreme weight cuts — true in general, but phrased without naming an event; check before expanding it.
- **MMA rules:** 5-minute rounds with 1-minute rest, and the 10-point must system, describe professional MMA under the Unified Rules; amateur and non-US rules differ.
- **Hand-portion method** is described as "popularised by coaching programmes", not attributed to a specific source.
- **Calisthenics standards** (3 × 8–12 reps, 3 × 20–30 s holds, and the muscle-up prerequisites of 10 pull-ups / 5 chest-to-bar / 10 dips) are common coaching conventions chosen for this batch, not measured thresholds. The ladders say so.
- **The push-up handles assumption** (parallettes-style, stable enough for L-sit, crow and tuck planche) is not confirmed. Check the actual handles.
- **Bar and station suitability:** the ladders warn that doorway bars usually can't do levers, toes-to-bar or muscle-ups, and that light dip stations can tip when rowed from underneath. Whether the owner's specific bar and station can take these loads is unknown.
- **All workouts and routines** are general programming for healthy adults, written without a coach's review; the sets, reps and rest periods are reasonable defaults, not prescriptions.
