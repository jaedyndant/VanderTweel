# Agent onboarding — Van der Tweel / Cemagi Atelier

This file is the single source of truth for any AI agent (or human) joining
this project. Read this before touching code. If anything here conflicts
with what you were told elsewhere, this file + `/docs` win.

For the agreed 30 October MS3/MS4/MS5 frontend integration branch, CI rollout
and isolated staging acceptance plan, also read
[INTEGRATION_MS3_MS4_MS5.md](INTEGRATION_MS3_MS4_MS5.md).

## 1. What this project is

Max van der Tweel develops Cemagi Atelier: five loft villas with pool on
Bali's west coast, sold to buyers who don't live on-site. Buyers pay in 9
installments tied to construction milestones and want to track build
progress remotely. Max currently updates them by hand, which costs him time
and costs buyer trust during quiet periods.

**Core mechanic (the actual hard part of this project):** when someone on
the team logs a progress update, payment, or file, it must show up for
*exactly* the right buyer — and nobody else — automatically. Role-based
access control is enforced at the API layer, never only in the UI. A buyer
account is scoped to their own villa/villas via `buyer_villa`; a PM is
scoped to their own projects via `pm_project`; a developer sees everything.
**Never build a screen that filters by role only in the frontend** — the
query itself must be scoped, so a bug in one screen can't leak another
buyer's data.

Three frontend surfaces, one shared Next.js app, one shared Neon Postgres
database, no direct DB access from any browser — always through the API/
server components:
- **Public website** (no login) — project info, two request forms.
- **Koper-app** (`/koper`, magic-link login, buyer role) — 8 screens per
  Figma: own villa, progress, 3D view, payment schedule, photos, updates,
  documents, account. Read-only from the buyer's side.
- **Back-office** (`/office`, magic-link login, pm/developer role) — 9
  developer screens (full visibility), 3 PM screens (own projects only, no
  money, no contract files). Write endpoints live here; every write is what
  triggers the buyer-facing update.

Full detail: `/docs/Plan_van_Aanpak_Van_der_Tweel.pdf` (PvA — scope, 8
milestones, risk analysis) and `/docs/Technisch_Ontwerp_Van_der_Tweel.pdf`
(TO — architecture, data model chapter 7, API/security chapter 9). Read
both before starting a new milestone, not just this summary.

**Explicitly out of scope** (don't build these even if it seems helpful):
in-app payment, in-app digital signing, multi-language (English only), a
native app, buyer↔team chat, a 4th role, a 2nd developer account, 3D of the
whole villa row (only the buyer's own villa).

## 2. Stack

- Next.js 16 (App Router) + React 19 + TypeScript, one codebase for all
  three surfaces, routed by Next.js route groups: `(site)`, `(koper)`,
  `(office)`.
- Tailwind CSS.
- Drizzle ORM on Neon Postgres. Schema: `src/db/schema.ts`. Migrations:
  `drizzle/*.sql`, numbered, tracked in `drizzle/meta/_journal.json`.
- Auth.js (NextAuth v5, beta) — magic-link via Resend, **no passwords, no
  self-registration**, database session strategy (not JWT).
- React Three Fiber (Three.js) for the 3D villa view — not raw WebGL. Not
  built yet (MS6).
- Vercel hosting, Sentry error tracking.
- Vitest for unit tests.

## 3. Git workflow — read this before writing any code

This is PvA §4.6 verbatim, written specifically for multiple
agents/developers on one repo. It is not optional.

1. **main is protected. Nobody commits directly to main.** Every change
   goes through a pull request, even trivial ones, even with one reviewer —
   so every change is visible before it's final.
2. **One task = one branch = one PR.** Name branches after the milestone/
   task, e.g. `ms4-office-projects-screen`, `ms5-notification-trigger`.
   Never share a branch between two unrelated tasks.
3. **Claim before you start.** Say in chat (to Jaedyn, who relays) which
   milestone/task you're taking before you start it. Two agents must never
   work on the same card or the same file unknowingly — if you're both on
   MS4, split it by screen/table, not by vibes.
4. **Small, scope-bounded commits.** A commit touches only what belongs to
   that one task. "While I was in there I also..." is exactly how
   unintended deletions happen. If you notice something unrelated that's
   broken, flag it, don't fix it inline.
5. **Database changes always go through a numbered migration file in
   `drizzle/`, never by hand-editing `schema.ts` and pushing schema state
   directly.** This is how two agents avoid silently conflicting schema
   changes. Generate with `npx drizzle-kit generate`, review the SQL it
   produces, commit it.
6. **No force-push to main. No rebase that overwrites someone else's
   commits.** If you need to update your branch, merge main into it, don't
   rebase over shared history.
7. **Short sync at every milestone boundary** — before the next milestone
   starts, it should be clear who's doing which part, so scope doesn't
   silently overlap.

### Practical additions from real mistakes made on this project (Oct 2026)

- **`drizzle-kit migrate` is currently broken/silent on this repo** — it
  exits non-zero with no usable error output against the Neon driver setup
  here. Until someone fixes that properly, apply migration SQL files
  directly with `@neondatabase/serverless`'s `Pool` (websocket mode, needs
  the `ws` package + `neonConfig.webSocketConstructor = require('ws')`).
  The plain `sql.unsafe()` HTTP-mode call from `neon()` looked like it
  worked (resolved without throwing) but silently did **not** execute
  anything — it just returned a query descriptor. Verify any direct DB
  script against a real row count before trusting it, every time.
- **There are two Neon databases referenced in this project's history:**
  the real one Vercel's `DATABASE_URL` points at (what the live app
  actually reads), and a separate `STAGING_DATABASE_URL`/`STAGING_*`
  branch that was set up per NFR 11.4 and got used for testing instead by
  mistake. Data seeded into the staging branch does not exist for the
  deployed app. **Always confirm which `DATABASE_URL` you're running
  against — pull it fresh with `vercel env pull --environment=production`
  immediately before any migration/seed, don't reuse an old `.env` file.**
- **Make every seed/backfill idempotent and re-run it against the live DB
  after writing it, to prove it's a no-op the second time**, before
  calling a data fix done. A one-off script run once by hand is not a
  fix, it's a ticking time bomb for the next fresh environment — promote
  it to a tracked migration (see `drizzle/0003_ms2_account_backfill.sql`
  for the pattern: `ON CONFLICT DO NOTHING` / `WHERE NOT EXISTS` guards on
  every statement).
- **Required env vars for the app to even boot auth** (`AUTH_SECRET`,
  `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`) must be set in Vercel for
  **Production and Preview both** — check with `vercel env ls`, don't
  assume because it works locally it's set remotely. Missing `AUTH_SECRET`
  fails silently as a generic "server configuration" error with no
  stack trace surfaced to the client.
- There is a temporary, secret-gated `/api/dev-login` route (PR #4) that
  exists only because no real Resend API key is wired up yet. It is a
  deliberate backdoor, gated by `DEV_LOGIN_SECRET`, and must be deleted
  once real magic-link email works end to end. Don't build on top of it,
  don't copy the pattern elsewhere.

## 4. Current state (as of 2026-10-28)

Merged PRs, in order: #1 project foundation/schema, #2 MS2 login + role
routing, #3 MS3 koper-app (own villa / progress / payment schedule), #4
dev-login backdoor, #5 migration hardening for the MS2 account seed.

- **MS1, MS2, MS3: done**, verified against the real deployed database and
  real deployed auth (not just staging) as of today.
- **MS4 (back-office basisschermen): not started.** `/office` is currently
  a one-screen stub that only confirms the logged-in account and role.
  This is the next milestone: 9 developer screens, 3 PM screens (no money,
  no contract files for PM).
- MS5 (team→buyer notification coupling), MS6 (3D villa), MS7 (public
  site + forms), MS8 (testing/security/handover) not started.
- 28/28 unit tests passing (`npx vitest run`): auth adapter, role routing,
  koper data scoping. CI runs typecheck + lint + tests + build on every PR
  against `main`.
- Live production: `https://van-der-tweel-eight.vercel.app`. Real seed
  data: Villa 1 (Marcus Oduya, project "Row A"), Villa 3 (Emma Larsen),
  each with their own payment milestones and progress tasks, confirmed
  isolated from each other.

## 5. Before you write code

1. Read `/docs/Plan_van_Aanpak_Van_der_Tweel.pdf` and
   `/docs/Technisch_Ontwerp_Van_der_Tweel.pdf` in full, not summaries.
2. Read `src/db/schema.ts` — don't guess field names.
3. Check `git log --oneline` and open PRs so you know what's in flight.
4. Say in chat which task/milestone you're claiming before starting.
5. Work on your own branch. Never touch files outside your claimed task's
   scope in the same commit.
6. Before merging: `npx tsc --noEmit`, `npx vitest run`, `npm run build`
   must all pass locally — don't rely on CI to catch it first.
7. If your task touches the database schema: `npx drizzle-kit generate`,
   review the generated SQL yourself, commit the migration file + updated
   journal/snapshot together with the code that needs it, in the same PR.
8. Open a PR, don't merge your own work without it going through review
   (Jaedyn reviews, or the other agent, per whoever owns that PR).

## 6. Who's doing what

Two agents work this repo: Jaedyn's agent (Claude) and his teammate's
agent (GPT-based). Both follow this exact document — same rules, same
workflow, no separate conventions per agent. If you're the GPT-based
agent reading this for the first time: you have no other context about
this project beyond what's in this file and `/docs` — don't assume
anything else about scope, stack, or conventions. When in doubt, ask in
chat before building, don't guess and build something that has to be
redone.
