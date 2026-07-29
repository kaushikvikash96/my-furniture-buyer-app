# Furniture Buyer App

A buyer's storefront wired directly to a real furniture shop's own API.

A buyer logs in, browses the shop's real product catalogue, and clicks **Buy**
to place a **real order** — spending a real balance the shop tracks, not a
number this app made up.

Built for Day 1 of a hackathon. This revision replaced an earlier local
budget/cart simulation with a genuine integration — see [architecture.md
§7](architecture.md) for why, and [requirements.md](requirements.md) for
exactly what was asked for and how each part was verified.

## ⚠️ Before you click "Buy"

**This is not a sandbox. A real order cannot be undone.** Every login in this
app acts on the same one real account, and clicking Buy genuinely spends its
real balance, permanently. There's no "reset" for it the way there is for the
login database.

## Status

✅ **Working, against the real account.** Real balance shown live on every
page. Buy places a genuine order. One real $1.20 purchase was made during
development specifically to confirm this — the balance actually moved.

## Running it

You need [Node.js](https://nodejs.org) 20 or newer. Then, in this folder:

```bash
npm install     # once, to fetch the libraries
npm run dev     # start the app
```

Then open **<http://localhost:3000>** in your browser.

Sign in with either demo account — the password is pre-filled on the login page:

| Email | Password |
| --- | --- |
| `buyer@shop.test` | `furniture123` |
| `alex@shop.test` | `furniture123` |

Both log in as separate people in *this app*, but act on the exact same real
balance and order history — see "The one real account" below.

Press `Ctrl+C` in the terminal to stop the app.

### The one real account

This app's shop API key resolves to exactly one real account (`cognitivo020`
by default — set in `.env` as `COGNITIVO_USER_ID`). There's no way, with what
the key can see, for Sam and Alex to have different real balances — so they
share one. That's a deliberate choice, not an oversight: see requirements.md §8.

### Looking at the login data

```bash
npm run db:studio
```

Opens a spreadsheet-like view of the *login* database — that's all it holds
now (`User`, `Session`). Products, balance, and orders are never stored here;
look at them in the app itself, since it always shows the live, real figures.

### Rebuilding the login data

```bash
npm run db:seed    # recreate the two demo logins
npm run db:reset   # wipe + reseed
```

Both only ever touch login data. Neither can affect the real account.

### Why the catalogue takes a moment sometimes

The home page calls the shop's `GET /catalogue/search-index` API fresh every
time you view it — no caching, ever. Look for the small "live · fetched
HH:MM:SS" label at the top: it changes every reload, proving it's not a
stored copy. You won't see the call in your browser's DevTools — it happens
on the server, which is required to keep the API key private. Watch the
terminal running `npm run dev` instead; each fetch logs a line there.

One real consequence: **this page's speed is the shop's server's speed, not
ours** — measured anywhere from under a second to a few seconds, at different
times, for the exact same request.

## Features

- 🔐 Email + password login; every other page redirects to it when logged out
- 🛋️ Browse 762 real products live from the shop's own catalogue API — search, category filter, pagination
- 💰 **Real balance**, shown live on every page, read fresh from the shop's own account each time — never stored or calculated by this app
- 🛒 **Buy places a genuine order** through the shop's API — one click, one item, real money, real confirmation
- 🚫 **Specific, friendly errors** — "insufficient balance" and "item no longer available" are detected and shown distinctly, confirmed against the real API's actual (undocumented) failure responses; nothing crashes the page
- 📜 Real order history, read live from the shop's own records

## Documentation

| Doc | What's in it |
| --- | --- |
| [requirements.md](requirements.md) | What the app must do, the three requirements this revision was built against, and exactly how each was verified |
| [architecture.md](architecture.md) | How it's built — technology choices, the two-table data model, and the full detail on the real integration (§7) |
| [CLAUDE.md](CLAUDE.md) | Working notes and conventions for Claude Code — including the one rule that matters most: real orders can't be undone |

## Tech stack

Deliberately small — **six dependencies**:

- **[Next.js](https://nextjs.org)** (App Router) + **TypeScript** — pages and server logic in one project
- **SQLite** + **[Prisma](https://www.prisma.io)** — a single-file database holding only login data
- **Session cookies** + `bcryptjs` password hashing — login, kept deliberately small
- **[Tailwind CSS](https://tailwindcss.com)** — styling

No state-management library, no form library, no component kit, no separate
API layer, no Docker, and — since this revision — no local copy of products,
balance, or orders either. Every choice and the rejected alternatives are
explained in plain English in [architecture.md §2](architecture.md).

## A note on security

Passwords are hashed, session cookies are HttpOnly, and there's no password
reset or brute-force protection — not a claim of production-grade security
for the *login* system. Separately, and more importantly here: the shop API
key in `.env` grants real purchasing power on a real account. `.env` is
git-ignored; never commit it, and treat it with the same care as a payment
credential, because that's effectively what it is.
