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
- Everything stays within x 1–99 and y −9 or lower (the head radius is 7).
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

- knee: `thigh − shin` from −10 to 165 (positive is bent)
- elbow: `forearm − upperArm` from −10 to 165
- ankle: `foot − shin` from 15 to 140 (90 is neutral)
- hip: `180 − torso + thigh` from −60 to 178 (0 standing, 90 sitting)
- neck: `head − torso` within ±70
- and every animation must move: at least one angle changes by 10° or more.

## Checking your work

```sh
node scripts/poses.mjs squat lunge          # the rule book; exits 1 on problems
node scripts/poses.mjs --sheet /tmp/s.html squat lunge
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
