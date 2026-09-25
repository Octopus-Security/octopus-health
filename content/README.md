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

`test/content.test.js` checks the shape: every workout has the six required
sections, every MMA piece has safety notes, every file has front matter, and
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

## Needs human verification

No studies are cited and no statistics were invented. These are the claims and
links a person should check before this is shown to anyone:

- **Links marked ⚠ verify in `links.md`** (8): health.gov physical-activity guidelines (root only), WHO physical-activity fact-sheet path, Harvard Nutrition Source domain, ISSN domain, ABC (Unified Rules) domain, IMMAF domain, Global DRO domain, CDC HEADS UP path. Unmarked links are long-standing canonical domains linked at their root, but **none was fetched**: the session that wrote them could not reach any of them (its proxy refused every host), so a quick click-through of all 23 is still owed.
- **Nutrition figures used:** ~4 kcal/g protein and carbohydrate, ~9 kcal/g fat; ~1 kg sweat loss ≈ 1 L fluid; refrigerated leftovers "within a few days / three to four days" (defer to foodsafety.gov).
- **Hydration:** the statement that combat-sports bodies changed rules after deaths linked to extreme weight cuts — true in general, but phrased without naming an event; check before expanding it.
- **MMA rules:** 5-minute rounds with 1-minute rest, and the 10-point must system, describe professional MMA under the Unified Rules; amateur and non-US rules differ.
- **Hand-portion method** is described as "popularised by coaching programmes", not attributed to a specific source.
- **All workouts** are general programming for healthy adults, written without a coach's review; the sets, reps and rest periods are reasonable defaults, not prescriptions.
