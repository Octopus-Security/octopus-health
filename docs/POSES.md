# Writing a stick-figure animation

Each exercise card shows an animated figure from `public/poses/<key>.json`.
Which key an exercise gets is decided by `public/pose-map.js` (rules on the name,
then the category). The engine is `public/stick-figure.js`; its header comment is
the format reference and `validate()` in it is the rule book.

## The rule that matters: the figure is a rigid skeleton

A pose is **angles**, never joint coordinates. Every joint is computed from its
parent with a fixed bone length, so limbs cannot detach or stretch. The old
format stored an x/y per joint and Cat-Cow drew its arms off the body; that
cannot be written any more.

## Format

```json
{
  "version": 2,
  "title": "Squat",
  "view": "side",
  "anchor": { "joint": "ankleL", "x": 50, "y": 90 },
  "pins": ["handL", "handR"],
  "hold": "dumbbell",
  "props": [{ "type": "bar", "x1": 20, "y1": -4, "x2": 80, "y2": -4 }],
  "grounded": true,
  "highlight": ["kneeL", "hipL"],
  "frames": [
    { "duration": 1100, "label": "Stand", "pose": { "torso": 180, "head": 180, "upperArmL": 0, "forearmL": 0, "upperArmR": 0, "forearmR": 0, "thighL": 0, "shinL": 0, "footL": 90, "thighR": 0, "shinR": 0, "footR": 90 } },
    { "duration": 900, "label": "Bottom", "pose": { "torso": 140, "thighL": 85, "shinL": -30, "thighR": 85, "shinR": -30 } }
  ]
}
```

- **Frame 0 has all twelve angles**; later frames list only what changes. The last
  frame loops back to the first, so a two-frame file is a full rep.
- `duration` 150–10000 ms is the time spent moving *from* this frame to the next.
  `ease`: `ease-in-out` (default), `linear`, `ease-in`, `ease-out`.
- `hold` (ms, default 20% of `duration`, capped at 180) is how long the figure rests
  on this key pose *before* it moves on. Playback is real time, so a key reads as a
  key instead of the figure flicking through it. `"hold": 0` marks a **pass-through**
  key (a circle, a stride): with no ease set, the moves on either side of it do not
  slow to a stop there, so continuous motion stays continuous.
- The move from the last frame back to the first is just another move. It takes the
  short way round and is eased like the rest, so a loop has no seam.
- Every move takes the **shortest way round** for each angle. Write angles so the
  step between two keys is at most 180° (the validator rejects more): what you write
  is what plays.

### Static poses (holds)

A pose that is held still (plank, side plank, dead hang, wall sit, hollow hold, a held
stretch) declares `"static": true` and has **exactly one frame**. It is exempt from the
must-move rule, shows that pose exactly as written (no limb ever changes), and the player
adds only a subtle breathing bob of the whole figure (under 1 unit, ~4 s, nothing for
`prefers-reduced-motion`). Do not invent a second "pose" to satisfy the must-move rule:
that distorts the hold into something nobody does. Keep motion only where the exercise
really moves: a stretch that is rocked into and out of, or a plank *with* shoulder taps,
is not static.

```json
{ "version": 2, "title": "Plank", "static": true, "view": "side",
  "frames": [ { "label": "Straight line", "anchor": { "joint": "toeL", "x": 5, "y": 91.5 }, "pose": { "...all twelve angles..." } } ] }
```
- `highlight`: what to colour red (`kneeL`, `hipL`, `shoulderR`, `elbowL`, `ankleL`,
  `hand`, `spine`, `neck`) — the working muscles. Per frame overrides it.

### Angles

Absolute degrees, `direction = (sin a, cos a)` with y pointing **down**:

| angle | points |
|---|---|
| `0` | straight down |
| `90` | forward (the way the figure faces — right) |
| `180` | straight up |
| `-90` | backward |

Write values continuously: going from 170 to 190 is fine, but 170 to −170
spins the limb all the way round (the validator rejects a jump over 200°).
The loop from the last frame back to the first takes the short way round, so a
full circle can be written 0 → 90 → 180 → 270 → 360.

Segments: `torso` (pelvis→neck, 30 long), `head` (neck→head centre, 10),
`upperArmL/R` (15), `forearmL/R` (14), `thighL/R` (20), `shinL/R` (20),
`footL/R` (ankle→toe, 7). Optional `arch` (−45…45) bends the drawn spine without
moving joints: **+ rounds the back** (cat, hollow body, crunch), **− arches it**
(cow, cobra, bridge).

**Side view** (default): faces right, `L` is the near (bright) side and `R` the
far (dark) side. **Front view** (`"view": "front"`): faces the viewer; `L` limbs
hang on screen-right, and +90 is screen-right for every limb. So arms out to the
sides are `upperArmL: 90, upperArmR: -90`, and feet point outwards with
`footL: 90, footR: -90`.

### Placing the body: anchor, pins, root

- **`anchor`** `{joint, x, y}`: that joint stays planted there and the pelvis is
  derived from it. This is how feet stay on the floor *during* a move, not only at
  the keyframes. Joints: `hip neck head shoulderL/R elbowL/R handL/R hipL/R
  kneeL/R ankleL/R toeL/R`. Put it on the animation, or on a frame when the
  planted point changes (a burpee goes feet → hands → feet).
- **`pins`** `["handL","handR","ankleL","ankleR"]`: a second contact. The pinned
  hand or ankle moves in a straight line between its keyframe positions, and the
  elbow or knee is solved to reach it. Anchor the toes and pin the hands for a
  push-up. A pin only holds still if **both keyframes put it in the same place**,
  so work the keyframe angles out until they do.
- **`root`** `{x,y}`: place the pelvis directly. Use this for jumps and anything
  that is not touching the ground through one fixed point.

### Floor and frame

- The floor is **y = 92**. A standing ankle sits at y=90. On the floor means
  hands, knees and ankles at y≈89–91; a body lying flat has its hip at y≈87.
  Floor checks use the drawn edge (a joint plus half its stroke, or the head's
  radius of 7), so "on the floor" is generous and "through the floor" is
  a real overlap.
- A body lying full length is about 94 units long, so centre the hip at x≈50.
- Everything stays within x 1–99 and above y −19.5 (the head radius is 7), which leaves room for arms overhead and a pull-up bar at y≈−8.
- `"air": true` on a frame that is airborne (jumps). `"grounded": false` on an
  animation where the figure is supported off the floor (pull-up bar, dip bars).

### Equipment

- `hold`: `dumbbell`, `barbell`, `kettlebell`, `ball`. These are drawn at the
  hands and move with them.
- `props` are fixed scenery: `bar {x1,y1,x2,y2}`, `box {x,y,w,h}` (a bench, a
  seat, a plyo box), `ball {x,y,r}`, `roller {x,y,r}`, `wall {x}`.

## Reference positions (side view, each checked against the validator 2026-10-25)

| Position | Values |
|---|---|
| Standing | anchor `ankleL (50,90)`; torso 180, head 180, arms 0/0, thighs 0, shins 0, feet 90 |
| Squat bottom | torso 140, head 150, thighs 85, shins −30 (same anchor) |
| Push-up top | anchor `toeL (10,91.5)`, pins both hands; torso 108, head 112, arms 0/0, thighs −72, shins −72, feet −10 |
| Push-up bottom | torso 92, head 100, upperArms −83, forearms 55, thighs −88, shins −88 |
| Quadruped | anchor `kneeL (30,89.5)`, pins both hands; torso 104, head 150, arms 0/0, thighs 0, shins −90, feet −72 |
| Supine (on back) | root `(52,87)`; torso −90, head −88, arms 90/90 (along the body), thighs 90, shins 90, feet 180 (toes up) |
| Prone (face down) | root `(50,87)`; torso 90, head 92, arms −90/−90 (along the body), thighs −90, shins −90, feet −60 |
| Seated, legs long | root `(30,87)`; torso 180, head 180, arms 0/0, thighs 90, shins 90, feet 180 |
| Guard / stance (striking) | see `jab-cross.json` |

The face looks 90° forward of the head segment, so supine faces up and prone
faces down without anything extra.

## Joint limits (side view): the validator's numbers

- knee: `thigh − shin` from **−5** to 165 (positive is bent)
- elbow: `forearm − upperArm` from **−5** to 165
- ankle: `foot − shin` from 15 to 140 (90 is neutral)
- hip: `180 − torso + thigh` from −60 to 178 (0 standing, 90 sitting)
- neck: `head − torso` within ±70
- and every animation must move, unless it is `"static": true`: at least one angle changes by 10° or more.

**The hinge rule (hard).** A knee flexes only so the shin goes *behind* the thigh; an
elbow only so the forearm goes *forward* of the upper arm; at most 5° of hyperextension
either way. Angles are in the figure's own frame (+90 is the way it faces) and mirroring
(`faceRight: false`) only flips the drawing, so facing and mirroring are already
accounted for. It is checked at every keyframe **and** at seven points along every move,
because a pose can be legal at both ends and bend the wrong way between them (a limb
swung the long way round, or a pinned limb solved with the wrong bend). Pins always bend
the anatomical way: the IK takes the sign from the limb, never from the keyframe. Front
view is exempt: a knee bends into the screen there and a 2D drawing cannot show it.

## Checking your work

```sh
node scripts/poses.mjs squat lunge          # the rule book; exits 1 on problems
node scripts/poses.mjs --sheet /tmp/s.html squat lunge
node scripts/poses.mjs --sheet /tmp/s.html --size 260 --moments 8 squat   # big cells + frames from the middle of a tween
chrome-headless-shell --no-sandbox --window-size=1500,900 --screenshot=/tmp/s.png file:///tmp/s.html
# or:
firefox --headless --no-remote --profile /tmp/ffp --window-size 1400,900 \
  --screenshot /tmp/s.png file:///tmp/s.html
node --test test/stick-figure.test.js
```

**Look at the sheet.** The validator proves the figure is connected, inside its
joint limits and on the floor. It cannot tell you that it looks like a Romanian
deadlift. Each keyframe is shown with a faded midpoint after it.

## Asking another model to write one

Paste this file, `public/poses/squat.json`, `push-up.json` and `cat-cow.json` as
examples, and the key and a one-line description of the movement. Have it run
`node scripts/poses.mjs <key>` and fix every error before it hands the file back.
