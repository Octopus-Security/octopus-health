# Trainer role and shareable plans (octopus-coach phase 1, health half)

Design: `octopus-vault/COACH.md`. Claims are **verified** (a test in this repo passed, 2026-11-11) or
**assumed**. Where this file and the code disagree, the code wins.

## Who may author

Sessions (`/sessions`) and plans (`/trainer-plans`) are for role `trainer` or `admin`; anyone else gets
**404** on every authoring route. `admin` implies `trainer`; `trainer` implies nothing else. Public pages
(`/s/...`, `/p/...`) never look at the role. *Verified (test/plans.test.js).*

### How fresh the role is

- health does **not** trust the JWT's role claim. `index.js` verifies the cookie remotely against
  octopus-auth `POST /api/auth/verify` (auth re-reads `User.role` from its database on each call) and
  caches the answer for **5 minutes** (`lib/verify-cache.js`). That is too long for a revoked trainer.
- Every authoring request therefore goes through `api/trainer-guard.js`, which asks a **second, shorter
  cache** (`verifyTokenFresh` in `index.js`, `ROLE_CACHE_MS`, default **30 s**) and uses *its* role.
  Revoking `trainer` in auth stops authoring within about 30 s, or at once if no authoring request was
  made in the last 30 s. If auth is unreachable the answer is null and the request is **refused**
  (fail closed); unreachable answers are never cached. *Verified: role flipped to `user` in a stub auth,
  authoring 404 after the cache window; flipping back restores it; a token auth no longer knows is refused.*
- The nav link on *other* pages still comes from the 5-minute answer, so a revoked trainer may see the
  link for a few minutes; clicking it is a 404. Cosmetic only.
- *Assumed, not run against the real octopus-auth:* that `/verify` returns the current `role` string
  `trainer` unchanged (COACH.md read this in auth's code) and that cortex's Users panel can set it.

## Isolation

The shared DB (`shared-sessions.sqlite`) rows carry `owner` = the account **username** (the key sessions
already used; auth's numeric id is not in `req.user`). Every list, read, update, visibility, rotate and
delete goes through `getOwned(owner, id)`; a foreign id is **404**. The admin has no wider view: an admin
sees only their own rows. The plan editor's session picker lists only the caller's sessions.
*Verified with two trainers plus an admin on every route (sessions and plans).*

## Plans

Tables: new `SharedPlans` (created by `sync()`, additive; no `force`/`alter`). A plan has title, intro,
`weeks` (JSON: weeks of days), visibility `private|unlisted|public`, token (192-bit), slug (public only),
`publishedAt`. A day is `{label, sessionId|null, note}`: it can point at one of the trainer's sessions,
carry free text ("rest", "easy 20 min run"), or both. Limits: 52 weeks, 14 days a week, 400 days in total.

| Visibility | Reached by | Listed |
|---|---|---|
| `private` | owner only; link 404 at once | no |
| `unlisted` | token at `/p/<token>`; noindex, no-store, no-referrer | no list, **not in sitemap** |
| `public` | slug at `/p/<slug>` (token redirects); canonical | `/p/sitemap.xml` (opt-in) |

Authoring: `/trainer-plans` (list) and `/trainer-plans/:id` (editor: weeks and days add/reorder/remove,
session picker, note, visibility, copy link, open as visitor, new link, delete). Themed dialogs only;
`asset()` for static files. Print: the browser's "Print or save as PDF", same stylesheet as sessions.

### Live references

A plan stores session **ids**, not copies. `GET /p/...` reads the plan and each referenced session on
every request, so editing the plan or any session in it changes what the same link shows. A deleted
session leaves "This session is no longer available" on that day, never a 500. *Verified by test.*
(Note: a session's own items are still snapshots of the library, as in SESSIONS.md.)

### Decision: a private session inside a shared plan

**The plan's visibility governs.** A day that references a *private* session still shows that session's
title, intro, items and item notes to anyone who may open the plan. The session's own link stays 404, its
**tailoring block** (who it is for, goal, limits, equipment) is never rendered, and the editor warns the
trainer. Reason: a trainer builds a plan out of their drafts and expects one link to work. If the owner
prefers "private sessions are hidden from plans", it is one condition in `planPublicView`.
*Verified by test, including a marker planted in every tailoring field.*

A plan may reference only sessions owned by the same trainer: checked on save (400, missing and foreign
give the same answer) **and** on every read (the lookup is scoped to the plan's owner). *Verified.*

## Not done / not verified

- Not run against the real octopus-auth, a browser, Cloudflare or a phone (the editor JS is untested in a
  browser; server routes and rendered pages are tested). Layout rules were followed in CSS, not measured.
- The cortex Role selector and coach app do not exist in this PR. Granting `trainer` is still an auth
  admin action.
- The two-figure/animated figures on plan pages reuse the session page script unchanged.
- No plan storefront (`/p` lists nothing); only the sitemap. Plans are not in `PUBLIC_HOST`-less discovery.
