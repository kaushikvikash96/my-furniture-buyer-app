# CLAUDE.md — working notes for Claude

Guidance for working in this repo. Read alongside
[requirements.md](requirements.md) (*what* we're building, with priorities and
acceptance criteria) and [architecture.md](architecture.md) (*how* it's built,
with the reasoning behind each choice). Don't duplicate those here — link to them.

## Project in one line

A furniture shop's buyer logs in, browses the shop's real catalogue, and
clicks Buy to place a **real order** through the shop's own API — spending a
**real** balance the shop tracks, not a number this app invented.

## Who you're working with — this matters

The owner of this project **has no coding background**. That shapes how to work:

- Explain choices in plain English *before* creating things; use analogies over jargon.
- Recommend, don't survey. One clear recommendation with the reasoning beats three options.
- Check in before structural or hard-to-undo steps (picking a stack, scaffolding, adding dependencies) — and *especially* before anything that touches the real shop account (below).
- Never assume they can debug a failure — if something breaks, diagnose it rather than handing back an error message.
- Say plainly when something doesn't work. A demo that fails on stage is much worse than a scope cut agreed at noon.

## The one thing more important than anything else here

**A real order, once placed, cannot be undone.** This app is wired to one
genuine account (`COGNITIVO_USER_ID` in `.env`) with a real, currently-small
balance. Before writing a test that calls `buyNow` or `placeRealOrder`, or
before running anything that could trigger one as a side effect, stop and
think about whether it will actually place an order — and if there's any
doubt, ask first, the same way permission was asked for before the one
deliberate real purchase made during development (a $1.20 item, to verify the
success path — see [architecture.md §7](architecture.md)). Testing failure
paths (insufficient balance, item not found) is safe and was done directly —
see below — because both are *guaranteed* not to place an order.

## Stack

TypeScript · Next.js (App Router) · SQLite via Prisma (login only) · own
cookie session (bcryptjs + `Session` table) · Tailwind CSS.

**Six dependencies total**: `next`/`react`/`react-dom`, `typescript`,
`prisma`+`@prisma/client`, `tailwindcss`, `bcryptjs`. Session tokens use
Node's built-in `crypto`; forms are plain HTML forms + Server Actions; every
call to the shop's API (`lib/cognitivo.ts`) uses the built-in `fetch` — no
HTTP client library, ever.

**Version pins that matter:** Prisma **6** (v7 needs a config file, `dotenv`
and a native adapter for SQLite — no benefit here) and TypeScript **6**
(Next.js 16 rejects TypeScript 7's compiler API). Don't bump either without a
reason.

**Do not add a dependency unless a requirement genuinely can't be built
without it** — no state library, no form library, no component kit, no
tRPC/REST layer, no Docker. The full skipped-and-why list is in
[architecture.md §2](architecture.md).

`bcryptjs`, not `bcrypt` — the latter needs a C++ build that often fails on WSL.

**There is no `middleware.ts`.** `requireUser()` at the top of each protected
page is the real guard and can't be bypassed.

TypeScript over JavaScript and an own session over NextAuth were both
deliberate reversals of the very first plan, and are still current — see
[architecture.md §2](architecture.md), ADR-1 and ADR-2.

## Conventions to follow

- **Nothing about products, balance, or orders is stored locally, ever.** Every read goes live to the shop's API (`lib/cognitivo.ts`) at the moment it's needed. Don't add a cache, a database table, or a "sync" step for any of this without checking [architecture.md §7](architecture.md) first — a local copy of any of this was tried before and deliberately removed.
- **Money is always integer cents** once read from the shop's API (`toCents()` in `lib/cognitivo.ts`). Format for display only via `lib/money.ts`. See ADR-3.
- **Every call to the shop's API is wrapped in a try/catch that renders a plain-English message on failure, never lets an exception reach the page.** This is requirement 3, and it applies everywhere `lib/cognitivo.ts` is called from, not just `buyNow`.
- **`InsufficientBalanceError` and `ProductNotFoundError`** (`lib/cognitivo.ts`) are the two specific, confirmed failure shapes for placing an order (`402`/`404` with a `{"detail": "..."}` body — confirmed against the real API, not assumed from its `422`-only documented schema). Any new code that calls `placeRealOrder` should handle both by name, not by a generic catch, if it wants requirement-3-quality messages.
- **Every logged-in buyer acts as the same one real account** (`COGNITIVO_USER_ID`). Our own login (`User`/`Session`) only gates *access to the app* — it has no relationship to which balance or orders are shown; there's only one.
- **Prefer Server Components and Server Actions** over writing API route handlers. Every call to the shop's API happens server-side, never in a Client Component — the API key would otherwise ship to the browser.
- Business rules live in `lib/`, not inside page components.

## Layout

`app/` = pages you can visit · `components/` = things you can see · `lib/` =
shared logic. Full tree in [architecture.md §5](architecture.md).

**Data model — two tables, on purpose:** `User` · `Session`. That's the whole
local database now — see [architecture.md §3](architecture.md) for why
`Product`/`Order`/`OrderItem` were dropped rather than left unused.

## Commands

```bash
npm run dev          # start the app at http://localhost:3000
npm run db:push      # apply schema changes (non-destructive)
npm run db:seed      # demo logins only (Sam, Alex)
npm run db:studio    # spreadsheet-like view of the login data
npm run build        # production build — also type-checks
npm run db:reset     # wipes and reseeds LOGIN DATA ONLY — never touches anything real
```

`db:reset` uses `--force-reset`; Prisma blocks that for AI agents without the
owner's explicit consent, so prefer `db:push` + `db:seed` unless a true wipe
is wanted. It's safe regardless — it can't reach the real account.

## Current status

**Requirements 1–3 built and verified against the real account (2026-07-29).**

- **Requirement 1** (real balance): `GET /users/{user_id}` shown live in the nav on every page (`app/layout.tsx`).
- **Requirement 2** (real Buy): one click → one real `POST /orders` → confirmation page with the real updated balance. Verified with one genuine $1.20 purchase; balance moved from $4,804.00 to $4,802.80 as expected.
- **Requirement 3** (clear errors, no crash): `402`/`404` confirmed by deliberately sending two guaranteed-to-fail requests against the real account (an absurd-quantity order, a nonexistent item), balance confirmed unaffected afterward. The "item not found" message was also confirmed through the real UI end to end. The "insufficient balance" message was confirmed at the `lib/cognitivo.ts` level directly, not through a literal Buy click — no product currently costs more than the real balance, so that exact click hasn't happened live (see requirements.md Q5).

This replaced, rather than sat alongside, an earlier local budget/cart
simulation — `Order`, `OrderItem`, and `Product` tables were dropped;
`lib/budget.ts`, `prisma/import-catalog.ts`, `components/PlaceOrderButton.tsx`,
and `app/order/page.tsx` were deleted. If you find a reference to any of those
in an old note or commit, that's what it was — don't try to resurrect it
without re-reading [architecture.md §5](architecture.md) (marked superseded).

**Open, worth raising:**
- No product in the catalogue currently costs more than the real balance — so "insufficient balance" can't be demoed with a real click right now (requirements.md Q5).
- The real balance only ever goes down; there's no reset for it (requirements.md Q6).
