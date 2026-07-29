# Furniture Buyer App

A buyer's storefront for a furniture shop — **that can't let you overspend.**

A buyer logs in, browses the furniture catalogue, builds an order, and places it.
The app tracks every dollar against their allocated budget and refuses any order
that would exceed what's left.

Built for Day 1 of a hackathon.

## Status

✅ **Working.** Login, catalogue, ordering and budget enforcement all run, loaded
with the shop's real catalogue of **762 products**.

## Running it

You need [Node.js](https://nodejs.org) 20 or newer. Then, in this folder:

```bash
npm install     # once, to fetch the libraries
npm run dev     # start the app
```

Then open **<http://localhost:3000>** in your browser.

Sign in with either demo account — the password is pre-filled on the login page:

| Email | Password | Budget |
| --- | --- | --- |
| `buyer@shop.test` | `furniture123` | $50,000 |
| `alex@shop.test` | `furniture123` | $12,000 |

Use the smaller budget to demo the app refusing an over-budget order.

Press `Ctrl+C` in the terminal to stop the app.

### Looking at the data

```bash
npm run db:studio
```

Opens a spreadsheet-like view of the database in your browser — buyers, products,
orders — where you can read and edit rows directly. Useful for checking that
something saved, or for changing a buyer's budget.

### Rebuilding the data

The database is one file (`prisma/dev.db`), created from these commands:

```bash
npm run db:seed             # demo buyers + 12 placeholder products
npm run db:import-catalog   # replace those with the real 762-product catalogue
```

`db:import-catalog` reads the shop's MongoDB using `CATALOG_MONGODB_URI` from
`.env`, and saves the product images into `public/products/`. Re-running it
updates products in place, so existing orders keep working.

## Features

- 🔐 Email + password login; every other page redirects to it when logged out
- 🛋️ Browse 762 products with search, category filter and pagination
- 🧾 Build up an order, adjust quantities, place it
- 💰 Total / spent / remaining budget visible at all times
- 🚫 Orders over the remaining budget are **rejected by the server**, inside one database transaction, so a double-clicked button can't sneak past
- 📜 Order history, with each line at the price actually paid
- 🔧 The budget rule is modular — a one-off total today, switchable to a monthly allowance in one line

## Documentation

| Doc | What's in it |
| --- | --- |
| [requirements.md](requirements.md) | What the app must do — user stories, acceptance criteria, what's out of scope |
| [architecture.md](architecture.md) | How it's built — technology choices and why, the data model, how the budget rule is enforced safely, and how the catalogue import works |
| [CLAUDE.md](CLAUDE.md) | Working notes and conventions for Claude Code |

## Tech stack

Deliberately small — **six runtime dependencies**:

- **[Next.js](https://nextjs.org)** (App Router) + **TypeScript** — pages and server logic in one project
- **SQLite** + **[Prisma](https://www.prisma.io)** — a single-file database, with a spreadsheet-like viewer
- **Session cookies** + `bcryptjs` password hashing — login, kept deliberately small
- **[Tailwind CSS](https://tailwindcss.com)** — styling

No state-management library, no form library, no component kit, no separate API
layer, no Docker. (`mongodb` is a dev-only dependency, used once by the catalogue
import.) Every choice and the rejected alternatives are explained in plain English
in [architecture.md §2](architecture.md).

## Known issues

- **Prices may be mislabelled.** The imported catalogue comes from IKEA Saudi Arabia, so the figures are most likely SAR while the app displays `$`. All the arithmetic is exact; only the symbol is in doubt. Change `CURRENCY` in `lib/money.ts` to fix.

## A note on security

This is a hackathon demo. Passwords are hashed, session cookies are HttpOnly, and
one buyer cannot read another's orders. But there's no password reset, no
brute-force protection and no session-expiry hardening — it is not intended for
production or real customer data. The database credential lives in `.env`, which
is git-ignored; don't commit it.
