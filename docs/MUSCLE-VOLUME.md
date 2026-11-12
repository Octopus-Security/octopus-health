# Muscle volume: how it is measured and how to consume it

Page: `/volume` (linked from Body Map). Data: `GET /volume/api/windows`, behind the signed-in
user's own session (SSO cookie, app-access gate). It opens only that user's own database; there is
no service-token variant yet (a cortex or octopus-coach consumer needs one added the way
`api/routes/service.js` does it, with `X-Service-User`).

## Maths (code: `lib/volume.js`, pure)

- A set credits its exercise's muscles from the same vocabulary as the Body Map (`lib/muscles.js`).
  Primary = 1.0, secondary = 0.5 (`secondaryCredit`, **an assumption**, not a measured constant).
- **Hard set**: reps >= 1 or a hold > 0 s, and not RPE < 5 (read as a warm-up). Failed sets still count.
- `weeklySets` = hard sets x 7 / window length, so windows of different length compare.
- **Tonnage** = reps x load (lbs; kg converted) x credit. **Bodyweight sets** (no weight logged) count as
  sets, hard sets and reps but add no tonnage, because body mass is not in the log. A weight logged on a
  bodyweight exercise (belt, vest) is tonnage. **Timed sets** count as one hard set and add `seconds`.
- Stretches (`category: recovery`) are ignored. Sets matching no known muscle are counted in
  `skipped.unmapped`, never guessed. `full_body` credits nine major muscles in full (a Body Map decision).
- Guideline (default 10-20 weekly hard sets per muscle). The 10 is from Schoenfeld, Ogborn & Krieger
  (2017), J Sports Sci 35(11), dose-response of weekly sets and hypertrophy. The 20 is a conservative
  working ceiling and is **an assumption**. Status: `untrained` (0), `under` (< min), `ok`, `over` (> max).
  Volume is a rough proxy: it does not see intensity, proximity to failure or recovery.
- Windows: `length` days starting `step` days apart. from=D1, length 30, step 1 gives D1-D30, D2-D31,
  D3-D32. Only full windows ending on or before `to` are returned. Dates are ET calendar days.

## Request

`GET /volume/api/windows?from=YYYY-MM-DD&to=YYYY-MM-DD&length=30&step=1&guidelineMin=10&guidelineMax=20&primaryCredit=1&secondaryCredit=0.5&format=json|csv`

Defaults: `to` = today ET, `from` = the last 120 days (not before the first saved session), length 30,
step 1. Limits: length and step 1-366, at most 2000 windows (400 with a message otherwise).

## JSON

```json
{
  "success": true,
  "params": { "from": "2026-08-01", "to": "2026-11-11", "length": 30, "step": 1,
              "guideline": { "min": 10, "max": 20 }, "primaryCredit": 1, "secondaryCredit": 0.5 },
  "dataRange": { "first": "2026-07-02", "last": "2026-11-10" },
  "muscles": [ { "id": "chest", "name": "Chest", "region": "chest", "drawn": true } ],
  "windows": [
    { "start": "2026-08-01", "end": "2026-08-30",
      "muscles": { "chest": { "sets": 12, "hardSets": 10.5, "weeklySets": 2.4, "reps": 96,
                              "tonnageLbs": 14200, "seconds": 0, "status": "under" } } }
  ],
  "skipped": { "unmapped": 0, "considered": 120 }
}
```

`windows[i].muscles` has an entry for every id in `muscles`. `tonnageLbs` and `seconds` are rounded to whole numbers.

## CSV

Long format, one row per window x muscle, columns:
`window_start,window_end,window_days,muscle,muscle_name,sets,hard_sets,weekly_sets,reps,tonnage_lbs,seconds,status,guideline_min,guideline_max`.
