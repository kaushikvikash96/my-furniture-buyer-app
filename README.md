# Furniture Buyer App

A buyer's storefront for a furniture shop — **that can't let you overspend.**

A buyer logs in, browses the furniture catalogue, builds an order, and places it.
The app tracks every dollar against their allocated budget and refuses any order
that would exceed what's left.

Built for Day 1 of a hackathon.

## Status

🚧 **Planning complete, not yet built.** The documentation below describes what's
being built. There is no runnable app in this repository yet.

## Documentation

| Doc | What's in it |
| --- | --- |
| [requirements.md](requirements.md) | What the app must do — user stories, acceptance criteria, and what's deliberately out of scope |
| [architecture.md](architecture.md) | How it's built — the technology choices and why, the data model, and how the budget rule is enforced safely |
| [CLAUDE.md](CLAUDE.md) | Working notes and conventions for Claude Code |

## Planned features

- 🔐 Email + password login, with pages protected when logged out
- 🛋️ A browsable furniture catalogue with prices and images
- 🧾 Build up an order, adjust quantities, and place it
- 💰 Total / spent / remaining budget visible at all times
- 🚫 Orders that exceed the remaining budget are rejected by the server
- 📜 A history of past orders with their totals
- 🔧 The budget rule is modular — a one-off total today, switchable to a monthly allowance in one line

## Tech stack

Deliberately small — **six dependencies in total**:

- **[Next.js](https://nextjs.org)** (App Router) + **TypeScript** — the pages and the server logic in one project
- **SQLite** + **[Prisma](https://www.prisma.io)** — a single-file database, with a spreadsheet-like viewer for the data
- **Session cookies** + `bcryptjs` password hashing — login, kept deliberately small
- **[Tailwind CSS](https://tailwindcss.com)** — styling

No state-management library, no form library, no component kit, no separate API
layer, no Docker. Nothing gets added unless a must-have feature can't be built
without it.

Every one of those choices, the alternatives that were rejected, and the things
we're *not* using, are explained in plain English in
[architecture.md §2](architecture.md).

## Getting started

Once the project is scaffolded:

```bash
npm install
npm run db:reset    # create the database and fill it with demo furniture + logins
npm run dev         # then open http://localhost:3000
```

## A note on security

This is a hackathon demo. Passwords are hashed and session cookies are
HttpOnly, but there's no password reset, brute-force protection, or session
expiry hardening. It is not intended for production or real customer data.
