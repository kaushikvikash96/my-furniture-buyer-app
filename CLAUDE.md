# CLAUDE.md — working notes for Claude

Guidance for working in this repo. Read alongside
[requirements.md](requirements.md) (*what* we're building, with priorities and
acceptance criteria) and [architecture.md](architecture.md) (*how* it's built,
with the reasoning behind each choice). Don't duplicate those here — link to them.

## Project in one line

A hackathon Day 1 web app: a furniture shop's buyer logs in, browses a
catalogue, and places orders that the server refuses to let exceed their budget.

## Who you're working with — this matters

The owner of this project **has no coding background**. That shapes how to work:

- Explain choices in plain English *before* creating things; use analogies over jargon.
- Recommend, don't survey. One clear recommendation with the reasoning beats three options.
- Check in before structural or hard-to-undo steps (picking a stack, scaffolding, adding dependencies).
- Never assume they can debug a failure — if something breaks, diagnose it rather than handing back an error message.
- Say plainly when something doesn't work. A demo that fails on stage is much worse than a scope cut agreed at noon.

## Stack

TypeScript · Next.js (App Router) · SQLite via Prisma · own cookie session
(bcryptjs + `Session` table) · Tailwind CSS.

**Six dependencies total**, and it stays that way: `next`/`react`/`react-dom`,
`typescript`, `prisma`+`@prisma/client`, `tailwindcss`, `bcryptjs`. Session tokens
use Node's built-in `crypto`; forms are plain HTML forms + Server Actions; the
catalogue import script (below) talks to the shop's API with the built-in
`fetch` — no HTTP client library.

**Version pins that matter:** Prisma **6** (v7 needs a config file, `dotenv` and a
native `better-sqlite3` adapter for SQLite) and TypeScript **6** (Next.js 16
rejects TypeScript 7's compiler API). Don't bump either without a reason.

**Do not add a dependency unless a Must-have genuinely can't be built without it**
— no state library, no form library, no component kit, no tRPC/REST layer, no
Docker. The full skipped-and-why list is in [architecture.md §2](architecture.md).

`bcryptjs`, not `bcrypt` — the latter needs a C++ build that often fails on WSL.

**There is no `middleware.ts`.** `requireUser()` at the top of each protected page
is the real guard and can't be bypassed. Don't add middleware "for safety" — it
would duplicate the check and add a framework convention that Next 16 is renaming.

Two choices reversed an earlier plan (JavaScript → TypeScript, NextAuth → own
session). Reasoning is in [architecture.md §2](architecture.md) as ADR-1 and
ADR-2 — read it before proposing a change back.

## Conventions to follow

- **Money is always integer cents** (`priceCents`, `budgetCents`, `totalCents`). Never a float. Format for display only via `lib/money.ts`. See ADR-3.
- **Server-side is the source of truth for totals and budget.** Recompute from the database; treat any amount from the browser as untrusted. Client-side budget warnings are UX, never enforcement.
- **Placing an order runs in one Prisma transaction** — the check and the write must not be separable. See [architecture.md §4](architecture.md).
- **The cart is an `Order` with `status = "DRAFT"`**; there is no separate cart table and no browser-only cart.
- **`OrderItem.unitPriceCents` is copied at add time** so past orders never change when a product's price does.
- **All budget reasoning goes through `getBudgetSummary()`** in `lib/budget.ts`. Never inline "what counts as spent" logic into a page or component — that's the active policy's job (ADR-4). Switching one-off total ↔ monthly allowance must stay a one-line change.
- **Every query is scoped to the current user.** No route may read or write another user's orders.
- **Prefer Server Components and Server Actions** over writing API route handlers. Reach for a route handler only when something genuinely needs an HTTP endpoint.
- Business rules live in `lib/`, not inside page components.
- **The catalogue page fetches live from the shop's API on every view** (`lib/cognitivo.ts`, `cache: "no-store"`) — it does not query `db.product`. Don't "optimize" this back into a database read without re-reading [architecture.md §7](architecture.md) first; that reversal was deliberate and asked for.
- **`addToOrder` lazily creates a local `Product` row the first time an item is ordered** (via `GET /catalogue/{item_id}`), reusing `buildName`/`buildDescription`/`toCents` from `lib/cognitivo.ts`. Any other code that needs those transforms should import them from there, not redefine them.

## Layout

`app/` = pages you can visit · `components/` = things you can see · `lib/` =
shared logic · `prisma/` = data model and seed. Full tree in
[architecture.md §5](architecture.md).

**Data model — five tables:** `User` · `Session` · `Product` · `Order` ·
`OrderItem`. Diagram, rationale, and a requirements-coverage check in
[architecture.md §3](architecture.md). `spent` / `remaining` / line totals are
**derived, never stored columns** — the only frozen figure is `Order.totalCents`
once placed.

## Commands

```bash
npm run dev                 # start the app at http://localhost:3000
npm run db:push             # apply schema changes (non-destructive)
npm run db:seed             # demo buyers + 12 placeholder products
npm run db:import-catalog   # optional: snapshot the catalogue locally (fallback, not required)
npm run db:studio           # spreadsheet-like view of the data (useful for the owner)
npm run build               # production build — also type-checks
npm run db:reset            # DESTRUCTIVE: wipes the database, then reseeds
```

`db:reset` uses `--force-reset`; Prisma blocks that for AI agents without the
owner's explicit consent, so prefer `db:push` + `db:seed` unless a true wipe is
wanted. Never run it against anything but the local dev file.

## Build order

Follow the Must-have list in [requirements.md §3](requirements.md), in this
sequence — each step leaves something demonstrable:

1. Scaffold + Prisma schema + seed data (M8) — so there's something real to look at.
2. Login, logout, route protection (M1, M2) — the known time sink; do it early.
3. Catalogue (M3).
4. Draft order: add / change quantity / remove (M4).
5. Budget bar (M5).
6. Place order with transactional budget check (M6).
7. Past orders (M7).

Then Should-haves (S1–S5). Only then Could-haves. Cut from the bottom, never the top.

## Current status

**Built and verified end-to-end (2026-07-29).** All Must-haves M1–M8 work:
login/logout, route guard, catalogue with search + category filter + pagination,
draft order with quantities, budget bar, transactional over-budget rejection,
order history and detail.

**The catalogue is live (2026-07-29 revision).** Originally a one-way import
into SQLite (still true when this file was last fully rewritten); the owner
then explicitly asked for real, live API calls instead, so the catalogue page
now fetches `GET /catalogue/search-index` fresh on every view — no caching —
and "Add to order" lazily creates a local `Product` row via
`GET /catalogue/{item_id}` the first time each item is ordered. Product photos
saved by an earlier `npm run db:import-catalog` are merged in read-only for
display. Full detail, including the honest tradeoff (a live demo now depends
on the shop's server), in [architecture.md §7](architecture.md).

Verified: wrong password sets no cookie; over-budget order rejected with 0
rows written; double-submit creates exactly one order; one buyer gets 404 on
another's order; a deliberately-deleted local product re-syncs correctly on
next "Add to order"; the catalogue page returns a friendly error (not a crash)
when the shop's API is unreachable.

**Open, and worth raising:**
- Prices came from IKEA Saudi Arabia so they are probably SAR while the UI shows `$` — a one-line change in `lib/money.ts` (requirements.md Q3).
- The shop's own `/catalogue/search-index` latency varies noticeably by the hour — measured 0.6s once, 3.0s later, for the same request, confirmed via direct `curl` (not our code). Worth knowing before judging, since it sets how snappy the catalogue page feels.
- Other open questions (order cancellation, self-service signup) don't block anything.
