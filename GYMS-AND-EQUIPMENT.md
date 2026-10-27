# Gyms and equipment — design

**Status: partly built 2026-10-27 (see "Built so far"). Written 2026-10-19.** Below
that section the document is still the design; where it says nothing exists in the code,
that is no longer true of the items listed there. Where it describes current behaviour it is marked
*today*, and those claims were verified by reading the source on that date.

## Built so far (2026-10-27, branch feat/gyms-equipment-health)

Differs from the design, deliberately; the code wins:

- **`content/equipment/catalogue.json` is the one equipment list** (stable ids, aliases,
  `provides`), read by `api/equipment.js`. The skill tree's tokens now derive from it;
  cortex reads it via `GET /api/service/equipment`; octopus-mma holds a drift-tested
  snapshot of the ids. `EquipmentModel`/`Movement` (load semantics, per-user custom
  models) are NOT built; an id is just a string.
- **`Gym` + `GymEquipment` tables** (additive, per-user file), seeded Home / Park / Work
  gym. A gym also has `active` + `pausedUntil` (ET): paused locations are skipped by
  plan suggestions and their days fall back to Home. Page: `/gyms`.
- **Plan fitting**: exercises declare needs by name rule (catalogue `exerciseRules`) or
  their own `requires`; `GET /api/service/gyms/plan` returns the day's template fitted to
  the location, listing substitutions and omissions. Stored templates are never edited.
- **Not built**: `WorkoutSet.gymEquipmentId` (deferred: adding a column to the hottest
  table is risk with no reader yet), equipment-scoped PRs, user-defined settings fields,
  gym sharing, custom per-user equipment.

## The bug that started it

A plate-loaded iso-lateral chest press was logged under one name, and the same
machine had been logged weeks earlier under another. Neither name was wrong —
each is what got said that day — but the resolver that exists to catch exactly
this (`api/exercise-names.js`) returned `new`, not `ambiguous`:

```
"Iso Lateral Chest Press"  -> new        candidates: []
"Wide Chest Press"         -> ambiguous  candidates: ['Wide Chest Press Machine']
```

So it asked nothing and silently started a second history. The base keys are
`iso lateral chest press` and `wide chest press`; neither contains the other on
a word boundary, and they are far past the edit-distance cutoff. The resolver is
working as written. The miss is that **it only knows names, and the thing being
named is a machine.**

## What is actually wrong

The unit of progression today is a string. `WorkoutSet.exerciseName`, free text,
with `PersonalRecord.exerciseName` a second bare string that carries no foreign
key (`database.js:892`, `database.js:956`).

That makes the weight column uninterpretable on its own:

- **135 on a plate-loaded iso-lateral machine** is 135 *per side*, plus a
  carriage, through a cam that changes the resistance curve across the stroke.
- **135 on a pin-stack machine** is whatever that manufacturer stamped on plate
  number nine.
- **135 on a barbell** is 135.

These are three different efforts. Today they can all land in one history and
compete for one personal record, and the heaviest number wins regardless of what
produced it. `detectPR` keys its entire lookup on the name
(`api/pr-detect.js:32`), so a lighter machine's genuine record is silently
suppressed by a heavier machine's — or the reverse.

**So the unit of progression is not the exercise. It is the movement and the
equipment together.** Everything below follows from that one sentence.

A second, product-level reason: a tracker that cannot say *which* machine cannot
answer "am I getting stronger on this machine", cannot follow someone to a
different gym without resetting their records or corrupting them, and cannot be
set up by a new user whose gym has different equipment. Those are the three
things people actually want from a strength log.

## The model

Four layers. The split matters because each layer changes at a different rate
and is owned by someone different.

```
Movement          what the body does           shared, seeded, rarely changes
  └─ EquipmentModel   a manufacturer's product    shared, seeded, grows slowly
       └─ Gym            a place you train         yours, you create it
            └─ GymEquipment  that machine, there   yours, you create it
                 └─ WorkoutSet   one set you did   yours, exists today
```

### 1. `Movement` — what the body does

"Horizontal press, wide grip." "Squat." "Vertical pull."

Shared catalogue. This is the layer that lets you ask *"how is my chest pressing
going"* across every piece of equipment, and it is the only honest way to compare
a machine press to a barbell press — you compare the trend, never the number.

### 2. `EquipmentModel` — a manufacturer's product

"Hammer Strength Iso-Lateral Wide Chest." Shared catalogue, identical for every
user in the world who has one.

This is where the **load semantics** live, and they are the point of the whole
layer:

| Field | Why it exists |
|---|---|
| `loadBasis` | `per_side` \| `total` \| `stack_pin` \| `bodyweight` \| `band`. Makes "each side" structural instead of a free-text note. |
| `startingResistance` | The carriage. Real machines print this on the placard — often a couple of pounds, sometimes much more. Without it, plate weight is not the weight moved. |
| `isoLateral` | Whether the two sides move independently, which decides whether a per-side number is even meaningful. |
| `increments` | Stack steps, or the plate denominations the machine accepts. Drives "what can I actually load next". |
| `movementId` | What it trains. |

### 3. `Gym` — a place

Yours. `name`, `isDefault`, optional location note. "Home garage" and "the hotel
one in March" are both gyms. Creating one is the whole of "setting up a new gym".

### 4. `GymEquipment` — that machine, at that gym

The instance. `gymId` + `equipmentModelId`, plus:

- `label` — what *you* call it. "The red wide chest press."
- `overrides` — this unit's deviations. Its plate inventory, or a starting
  resistance that changed when it was rebuilt.
- `settingsSchema` — see below. The customisation escape hatch.

### 5. The log

`WorkoutSet` gains **one nullable column**: `gymEquipmentId`.

That is the entire change to the hot path.

## Why both model and instance

Because the two questions are different, and a design that collapses them gets
one of them wrong:

- *"Am I stronger than last month?"* — wants the **model**. Your records should
  follow you to another branch with the same machine.
- *"Why did that feel heavier?"* — wants the **instance**. Two units of the same
  model are not the same after ten years of different maintenance.

**So PR scope is a user setting, defaulting to `model`.** Records follow you;
the instance is still recorded, so the question can be asked later. Scoping to
`instance` is available for people who want it, and `movement` for people who
want one number per lift and do not care what moved it.

This is the one decision in the design that should not be made for the user.
Make the default sane and the setting obvious.

## Customisation — the actual requirement

"Users customise it to their exact needs and machines" cannot be met by a bigger
fixed list, because gyms contain unbranded machines, home-made racks and
equipment older than the manufacturer's current catalogue. Four escape hatches,
increasing in power:

**(a) The catalogue is extensible per user.** Any user can define an
`EquipmentModel` the shared catalogue lacks. It lives in their own database with
`isCustom: true`, and behaves identically to a seeded one. This is the common
case, not the exception.

**(b) Per-instance overrides.** The model says the machine takes a 2 lb carriage;
this one was rebuilt and takes 7. `GymEquipment.overrides` wins over the model.

**(c) User-defined settings fields.** The important one, and **the only part of
this design with no precedent in the estate** — every existing "custom" feature
lets a user name an item that points at fixed, predefined behaviour, not declare
a new shape. This goes further, so it carries more risk and should land last.

A machine's adjustments cannot be anticipated — seat height, handle position,
pin hole, pad angle, foot plate. So the user *declares the fields*:

```json
{ "seat": { "type": "int", "label": "Seat height" },
  "handles": { "type": "enum", "values": ["narrow", "wide"] } }
```

and `WorkoutSet.settings` records the values. The payoff is a log that can say
*"you did 135 for 10 — but the seat was on 3 last time, not 5."* No fixed schema
can do that, and for a serious lifter it is the difference between a record and
a number.

**(d) Aliases in the catalogue, not just per account.** Today an alias is learned
one account at a time, by answering a question (`ExerciseAlias`, written at
`api/log-edit.js:202`). A catalogue entry ships with its own aliases —
`["iso lateral chest press", "wide chest press machine", "hammer wide chest"]` —
so **the naming bug at the top of this document is fixed for every user before
they ever hit it**, not re-learned per account. The per-account alias table stays
and still wins; the catalogue is the floor, not the ceiling.

## Where each layer lives

Follow the pattern already used by the skill tree, which solved this exact
problem: `content/calisthenics/skill-tree.json` is data, versioned, with an
`aliases` array per entry, and *the tables hold only what this user did*
(`database.js:967`).

So: **`content/equipment/catalogue.json`** — versioned, shipped with the image,
read-only, same for everyone. User-created movements and equipment models go in
the user's database. Nothing merges the two files; the read path unions them.

This matters for selling it. The catalogue can be corrected and extended by
shipping a new file, with no migration and no risk to anybody's training
history, because no user data points into it by value — only by id, and an id
that disappears degrades to the name that was logged alongside it.

## What to build on, instead of writing it again

**`octopus-kit/server/layout.js` already is the shared-catalogue-plus-user-items
pattern**, generalised out of two apps that each built it separately (a
customisable dashboard, and a renameable/switchable module registry). Its three
relevant exports:

- `resolve(registry, prefs, { custom })` — merges a built-in registry with a
  user's preferences *and* their own created items, keyed `custom:<id>` so a
  user-made row can sit in the same ordered list as a built-in without colliding.
- `normalisePrefs(registry, input, { allowCustom })` — untrusted client input to
  safe-to-store rows.
- `moduleGate` — a switched-off module's routes 404 rather than rendering empty.

That is the equipment list: `registry` is the shipped catalogue, `custom` is the
machines this user defined, `prefs` is their renaming and ordering. It is pure —
storage stays with the app, which suits the per-user SQLite file.

Two honest caveats. **No app has adopted kit yet**, so this would be its first
real consumer, and being first means finding its bugs. And kit's `custom` items
are *named items pointing at fixed behaviour*, which covers (a) and (b) above but
not (c) — the user-declared fields are an extension of the idiom, not a use of it.

The gym-sharing question should borrow the **shape** of the game-server
visibility enum (`private` / `members` / `whitelist` / `public`, checked per
viewer) but not its storage: there it is stuffed into a schemaless JSON blob on
an unrelated row to dodge a migration. A new feature should use real columns.

## Backward compatibility

Non-negotiable, and the design is shaped around it.

- **`WorkoutSet.exerciseName` stays, forever, exactly as typed.** It is not
  deprecated and not backfilled away. It is both the fallback when no equipment
  is attached and the record of what was actually said.
- **`gymEquipmentId` is nullable, and a null is permanently valid.** Bodyweight
  work has no equipment. A set logged from chat on a phone has no equipment. A
  user who never creates a gym must get exactly today's behaviour, forever.
- **Every new table is additive.** `sequelize.sync()` creates them; no migration
  entry needed. Confirmed idiom (`database.js:948`, `:967`).
- **The one new column on an existing table** goes through the established
  hand-written `migrate()` helper — raw `ALTER TABLE ... ADD COLUMN`, wrapped so
  a rerun is a no-op and only "duplicate column" is swallowed
  (`database.js:1170-1186`). That is the repo's only migration idiom and this
  change should not invent a second one.
- **No automatic backfill.** The app may *offer* — "47 sets named `Wide Chest
  Press Machine`; attach them to this machine?" — and must require a yes. Guessing
  retroactively is how a clean history becomes a wrong one.

## Personal records

`PersonalRecord` gains nullable `scopeKey` and `equipmentModelId`. `detectPR`
keys on the scope rather than the bare name. Existing rows have `scopeKey: null`,
meaning legacy global scope, and continue to be shown.

Two existing defects should be fixed as part of this work, because this change
makes both worse:

1. **Renaming an exercise orphans its PRs.** `renameExercise` updates
   `WorkoutSet` rows and writes an alias, but never touches `PersonalRecord`
   (`api/log-edit.js:185-210`). The old name's records are left behind as a
   phantom exercise. `rebuildPRs` does not clean this up — it only ever *creates*
   a record when one beats the existing best (`api/pr-detect.js:96-103`), so the
   stale rows survive a rebuild.
2. **Two different web write paths disagree about PRs.** `index.js:1161` adds a
   set and never calls `detectPR`; `api/routes/workout.js:128` adds a set and
   does. One of them should go.

## If this is sold

Two things are already true and shape the answer.

**Isolation is free here.** One SQLite file per user (`database.js:767-772`),
created and migrated lazily on first sight of a user (`index.js:159-166`). There
is no cross-tenant query to get wrong, because there is no shared table. Every
new table in this design lives in that same per-user file. Do not introduce an
owner column for any of it — mixing the two isolation styles inside one app is
how the subtle leaks happen.

**Feature-level entitlement does not exist yet.** Billing sells *whole apps*: a
bundle is a Stripe product carrying a list of app slugs, and access is a per-slug
row. Nothing anywhere gates a feature *within* an app. So "sell gyms as a tier"
is not a configuration — it is new mechanism, and this would be the first
feature to need it. The cheapest honest version is to drive kit's `moduleGate`
off an entitlement check instead of a user preference, which is a small change to
a thing that already exists, rather than a new billing concept.

Worth deciding deliberately rather than by default: **the free version is more
valuable with gyms in it.** The feature that makes someone's history worth
keeping is the feature that stops them leaving. The thing to charge for is more
plausibly the shared catalogue's depth, multi-gym, or sharing — not the ability
to say which machine you used.

## Phases

Each phase is shippable and leaves the app working.

1. **`Gym`, `GymEquipment`, and the nullable column.** No behaviour change —
   nothing reads the column yet. Proves the migration on real data.
2. **The catalogue**, with aliases, and the name resolver consulting it. This
   alone fixes the originating bug.
3. **Equipment-scoped PRs**, with the scope setting and the two defects above.
4. **User-defined settings fields.**
5. **Gym switching in the UI** — pick where you are, and the logger offers that
   gym's equipment first.

## What this explicitly does not do

- It does not touch the skill tree, benchmarks or fitness tests. Those are a
  separate namespace keyed by `skillId` / `item` and contain no exercise names at
  all (verified 2026-10-19).
- It does not make `WorkoutSet.exerciseId` load-bearing. That column is written
  but never read back as a query key anywhere, and there are no Sequelize
  associations declared in `database.js` at all. It is vestigial, and this design
  neither relies on it nor removes it.
- It does not change how bodyweight or conditioning work is logged.
- It does not convert this app to an owner column. Isolation here is one SQLite
  file per user (`database.js:767-772`); the file is the boundary and stays so.

## Open questions

- Should a `Gym` be shareable between accounts? Two people training at the same
  place would both benefit from one equipment list, and it is the single biggest
  reduction in setup effort for a new user at an already-known gym. But sharing
  is where the per-user-file isolation stops being free: a shared gym is the
  first object in this app that two databases would need to agree on, and the
  design above deliberately does not solve it. Decide it on its own, not as a
  footnote to phase 5.
- Is `Movement` worth shipping in phase 1, or does `EquipmentModel` alone carry
  phases 1–3? It probably does, and `Movement` could land with cross-equipment
  comparison later.
- How much of the catalogue is worth seeding by hand before the first sale, and
  how much should come from users submitting their own custom entries back.
