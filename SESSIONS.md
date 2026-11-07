# Shareable sessions

The owner builds a session (title, intro, ordered exercises, mobility drills and martial-arts
moves), tailors it to one person, and shares it by link, the way octopus-kitchen publishes recipes.
Each claim is marked **verified** (checked in code or by a test or run, with the date) or **assumed**.

## Phase 1 (this PR)

- Authoring at `/sessions` (list) and `/sessions/:id` (editor), behind login, **admin only**: any
  other account gets 404 on every authoring route. Admin is `req.user.role === 'admin'`, the value
  octopus-auth returns on verify. The nav link is shown to admins only. *Verified 2026-11-07 (tests).*
- Public reading at `GET /s` (storefront), `GET /s/sitemap.xml`, `GET /s/:slugOrToken`. Mounted
  before the login and app-access gates, and the handlers never read `req.user`. *Verified
  (test with no cookie; headless Chromium).*
- A session: title, intro, up to 40 items, and a private tailoring block. An item is an exercise,
  a mobility-routine item or an mma move, plus the owner's own sets/reps/time text and a note.
- Assist (no LLM): the tailoring block (goal, muscles/joints to work, joints with a limit,
  equipment owned) narrows the library using `api/equipment.js` and `lib/muscles.js`. It returns
  lists: suggested, "check before using" (loads a limited joint), and a count hidden for missing
  gear. It never adds anything. mma moves carry no muscle data, so they appear only when no focus
  is chosen.

## Three visibilities, default `private`

| Value | Who | Listed / indexed |
|---|---|---|
| `private` | owner only | no; its link is 404 at once |
| `unlisted` | anyone with the token link (192 bits of `crypto.randomBytes`, 32 url-safe chars) | no list, no sitemap; `X-Robots-Tag: noindex`, `<meta robots noindex>`, `Cache-Control: no-store` |
| `public` | anyone, by slug (title plus 6 hex) or by token (token redirects to the slug) | storefront and sitemap; canonical link |

Why three, not kitchen's two: a session tailored around someone's injury must never appear on a
public list, but it still has to be sendable to that one person. Unlisted is that case. Default
private so that publishing is a decision, never a default (same note as octopus-shopper).
Both unlisted and public pages send `Referrer-Policy: no-referrer`. "New link" replaces the token,
so a forwarded link can be killed without deleting the session. *Verified (tests).*

## Why a separate database file

Health keeps one SQLite file per user, and that must not change: the file is the privacy boundary
for logs, weight and meals. A row a stranger can read cannot live in anyone's per-user file, and
merging databases risks data. So sessions live in `<data dir>/shared-sessions.sqlite` (same volume,
survives deploys), table `SharedSessions`, with an `owner` column keyed on username. Nothing joins
it to a per-user file; the only per-user read is the admin's own exercise library for the picker.
The table is created by `sync()` and never altered: no `force`, no `alter`; a later column goes in
as a guarded `ADD COLUMN`. Someone else's id is 404, never 403. *Verified (tests, incl. a second admin).*

## Privacy rule

Who it is for, goal, limits and equipment are never rendered on a public or unlisted page, in JSON,
in meta tags or in the title. `publicView()` in `api/sessions-store.js` is a whitelist (title, intro,
items, visibility, slug); the template only receives that. `test/sessions.test.js` plants a marker in
every tailoring field and asserts it is absent from the unlisted page, public page, storefront,
sitemap and response headers, while present in the owner's editor. No per-user health data can reach
these pages (no code path reads it). **The item note and the title/intro ARE public**, and the
editor labels them so. A title like "Rehab for X's knee" would leak by itself: the owner types it.

## Items are snapshots

Display name, pose key, cues and instructions are copied into the item when it is added. A later
library rename cannot break a sent link. **Cost:** a library fix (a corrected cue, a better figure)
does not reach existing sessions until the item is removed and added again. *Verified by design.*
Pose keys are checked against files on disk at save time.

## Page and print

Server-rendered with `<%= %>` escaping throughout (a test posts script and `<img onerror>` text);
`asset()` for CSS and JS. Each item has an animated figure (`StickFigurePlayer`) and, rendered on the
server by the same engine, 2 to 4 still key frames with captions. The stills are what shows with no
JavaScript or reduced motion, and what prints (the Print stylesheet hides the animation, goes white
and inverts the figure for paper). There is no PDF generator: "Print or save as PDF" is the browser's.
Kit layout rules applied (16px gutter, 44px taps, 16px inputs, `viewport-fit=cover`, no sideways
scroll). *Verified in headless Chromium 2026-11-07 at 360x640 and 640x360; see the PR.*
The page carries a general-information, not-medical-advice line and "Shared by Serpopard".
**The owner must review that wording.**

## mma moves

Included: **45 of 55** techniques. `scripts/snapshot-mma.mjs` reads octopus-mma's `main` with
`git show` (never its checked-out branch), copies pose JSON byte for byte to `public/poses/mma/`,
and writes `lib/mma-moves.json` (title, discipline, level, type, summary, steps, key points).
`--check` reports drift; `test/mma-snapshot.test.js` validates format and runs that check when a
sibling checkout exists (like mma #6's equipment-ids test, a check you run, not a guarantee).
Format: health's engine and mma's are both v2 rigid-skeleton; mma's adds a `partner` second figure.
**Left out, listed with reasons in the catalogue:** 9 poses use `partner` (all BJJ except none of
the strikes; wrestling takedown; clinch knee, long guard, parry) which health's engine does not
draw, and 1 (muay-thai switch kick) fails health's stricter validator. So grappling is NOT in.
Bringing it in means porting mma's partner rendering into `public/stick-figure.js`. Licence:
octopus-mma is public and has no LICENSE file (checked 2026-11-07); the content was written in this
estate. **Owner to confirm** before offering it to paying clients. Both repos are public, so
nothing here carries personal data.

## Optional dedicated host

`PUBLIC_HOST` (empty by default; passed by `docker-compose.yml`). When set, requests for that host
reach only `/s...`, `/health` and `/api/build` and static files (`/` redirects to `/s`); everything
else is 404, so the tracker is never served there. Nothing creates DNS. *Verified (test, with
`localhost`).* Links shown in the editor use the host you are on. No `robots.txt` is added (health
had none and one would cover the whole app host); submit `/s/sitemap.xml` to a search console.

## Phases

1. **This PR.** Admin authoring, three visibilities, snapshots, assist, public page, print, 45 mma moves.
2. Grappling moves (needs partner-figure rendering in health's engine); image cards in the formats
   of octopus-mma's `DownloadCard` (portrait, story, square, landscape); a dedicated public domain
   (set `PUBLIC_HOST`, add DNS and proxy host); a UI toggle for the owner's domain in links.
3. Reusable templates; groups for training partners and students.
4. Paying clients: accounts, progress, billing through octopus-billing, liability wording. Needs
   its own design; anything about a named person's health would then need real storage and consent
   rules (compliance pack, HANDOFF items 75, 86). *Assumed:* none of that is covered by phase 1.

## Not done / not verified

Not exercised against production or Cloudflare. Nothing is deployed until merged (a push to `main`
ships). Not tested with a real octopus-auth (a stub returns `role`). Real-phone Safari not tried.
