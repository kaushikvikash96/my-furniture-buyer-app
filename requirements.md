# Requirements — Furniture Buyer App

**Status:** Day 1 build complete — all Must-haves working · Last updated 2026-07-29

---

## 1. What we're building

A web app for a furniture shop's **buyers** (the people who purchase stock for
the shop). A buyer logs in, browses the product catalogue, adds furniture to an
order, and places that order — with the app enforcing that they never spend more
than their allocated budget.

The one-sentence pitch: *"A buyer's storefront that can't let you overspend."*

## 2. Who uses it

| Persona | What they need |
| --- | --- |
| **Buyer** (primary) | Log in, see what they can afford, browse, order, track remaining budget |
| **Demo viewer** (hackathon judge) | Understand the whole flow in under 2 minutes without being taught |

Only the Buyer role exists in Day 1. There is no admin/manager role — the
catalogue and budgets are set up by seeding the database (see
[architecture.md](architecture.md)).

## 3. Day 1 scope

Prioritised so that if the day runs short, we cut from the bottom and still have
a working demo.

### Must have — the demo does not exist without these

*All built and verified end-to-end.*

- **M1.** A buyer can log in with email + password, and log out.
- **M2.** Pages other than login are inaccessible when not logged in.
- **M3.** A buyer sees a catalogue of furniture products (name, image, price, description).
- **M4.** A buyer can add products to a current order and set quantities.
- **M5.** A buyer sees their **total budget**, **spent so far**, and **remaining**, always visible.
- **M6.** A buyer can place an order. The server rejects it if it exceeds remaining budget.
- **M7.** A buyer can see a list of their previously placed orders with totals.
- **M8.** The catalogue is pre-populated with realistic furniture data so the demo looks real. *Now the shop's **real, live** catalogue — the catalogue page fetches `GET /catalogue/search-index` fresh on every view (762 products), rather than a one-time import. See [architecture.md §7](architecture.md) for what changed and the tradeoff that came with it. `prisma/seed.ts` still holds 12 placeholder products as a fallback, and `npm run db:import-catalog` remains as an offline snapshot.*

### Should have — makes the demo persuasive

*S2 and S4 built; S1, S3, S5 built in their basic form.*

- **S1.** Remaining budget updates live as items are added, and warns *before* submitting when the order would exceed it.
- **S2.** Products that cost more than the remaining budget are visibly marked as unaffordable.
- **S3.** An order detail page showing line items, quantities, and the price paid.
- **S4.** Search / filter the catalogue by name and category. *Built — plus pagination, which 762 products made necessary.*
- **S5.** Looks decent on a phone screen as well as a laptop.

### Could have — only if time genuinely allows
- **C1.** Cancel a placed order, which returns its value to the remaining budget.
- **C2.** Sort catalogue by price.
- **C3.** A simple spend-by-category summary on the orders page.
- **C4.** Self-service signup (rather than seeded demo accounts).

### Won't have on Day 1 — explicitly out of scope
Payments or real checkout · shipping/delivery tracking · stock levels and
reservations · admin UI for editing products or budgets · multiple
users/roles/teams sharing a budget · email (verification, receipts, password
reset) · file uploads for product images (we use image URLs) · multi-currency ·
audit logging · production-grade rate limiting.

## 4. User stories & acceptance criteria

> "Given / When / Then" is just a way of writing down *how we'll know it works*.

### US-1 — Log in
> As a buyer, I want to log in so my budget and orders are mine.

- Given a seeded account, when I submit the correct email and password, then I land on the catalogue.
- Given a wrong password, then I stay on the login page and see "Incorrect email or password" (the message must **not** reveal whether the email exists).
- Given I am logged out, when I visit `/catalogue` or `/orders` directly, then I am redirected to `/login`.
- When I click Log out, then my session ends and revisiting a protected page redirects me to `/login`.

### US-2 — Browse the catalogue
> As a buyer, I want to see what's available and what it costs.

- Then each product shows a name, image, price, and short description.
- Then prices are formatted as currency (e.g. `$1,299.00`), never as a raw number.
- Given a product costs more than my remaining budget, then it is marked unaffordable and cannot be added *(S2)*.

### US-3 — Build an order
> As a buyer, I want to collect items before committing.

- When I add a product, then it appears in my current order with quantity 1.
- When I add the same product again, then its quantity increases rather than duplicating the line.
- When I change a quantity to 0 or remove a line, then it leaves the order.
- Then the order shows a running subtotal.
- Then my current order survives a page refresh (it lives in the database, not the browser).

### US-4 — See my budget at all times
> As a buyer, I want to know what I have left before I commit.

- Then total budget, spent, and remaining are visible on every logged-in page.
- Then `remaining = allocation − spent within the current budget period` (see business rule 3).
- Then the period is labelled, so it's unambiguous what the figures cover (e.g. "All time" or "July 2026").
- Given the current order's subtotal exceeds my remaining budget, then I see a clear warning and the Place Order button is disabled *(S1)*.

### US-5 — Place an order
> As a buyer, I want to commit my order and have the budget respected.

- Given the order total is within remaining budget, when I place it, then it becomes a placed order, my remaining budget decreases by exactly the order total, and my current order is emptied.
- Given the order total exceeds remaining budget, when I place it, then it is **rejected by the server** with a clear message and nothing is saved.
- Given I double-click Place Order or submit the same order twice, then **only one** order is created and the budget is decremented once.
- Given my order is empty, then I cannot place it.

### US-6 — Review past orders
> As a buyer, I want to see what I've already committed.

- Then I see my placed orders, newest first, each with a date, item count, and total.
- Then the sum of those totals equals my "spent so far" figure.
- Then I only ever see my own orders, never another user's.

## 5. Business rules

These are the rules the code must enforce, gathered in one place:

1. **Money is stored in whole minor units** (cents), never as a decimal. Displayed as currency only at the last moment.
2. **A buyer has exactly one budget allocation**, assigned at seed time.
3. **Spent = the sum of PLACED orders that fall inside the current budget period.** A draft/current order does *not* consume budget. What counts as "the current period" is decided by the active budget policy — all time (one-off total) or the current calendar month (monthly allowance). See [architecture.md ADR-4](architecture.md).
4. **A buyer has at most one draft order** at a time — that draft *is* the shopping cart.
5. **Budget is enforced on the server**, inside a single database transaction, at the moment of placing. Client-side warnings are a convenience, never the guard.
6. **Line items record the price at the time of ordering.** If a product's price changes later, past orders must not change.
7. **A buyer can only ever read or modify their own orders.**

## 6. Non-functional requirements

- **Demo-ready:** runs with two commands on a laptop, no cloud accounts required.
- **Fast enough:** any page in under ~1 second locally. No performance work beyond that. *Exception: the catalogue page, which now depends on the shop's live API (architecture.md §7) — its speed is theirs to control, measured anywhere from 0.6s to 3.0s at different times. Every other page is unaffected and still meets the ~1s bar.*
- **Honest security basics:** passwords hashed (never stored in plain text), session cookie is HttpOnly, no secrets committed to git. We are *not* claiming production-grade security.
- **Resettable:** one command reseeds the database to a clean demo state — essential when practising the demo.
- **Understandable:** the person who owns this app has no coding background, so file names and structure must be self-explanatory.

## 7. Decisions & open questions

### Decided

| # | Question | Decision (2026-07-29) |
| --- | --- | --- |
| Q1 | Is the budget a **one-off total** or a **recurring monthly allowance**? | **Neither is hard-coded.** The budget rule is built as a swappable module (see [architecture.md ADR-4](architecture.md)), shipping with *one-off total* active because it demos most clearly. Switching to monthly is a one-line change. |
| Q2 | Does the demo need a **public URL**, or is a laptop enough? | **Laptop only.** SQLite confirmed as the database; no cloud accounts needed. The Postgres escape hatch in [architecture.md §6](architecture.md) stays documented but unused. |

### Still open

| # | Question | Working default |
| --- | --- | --- |
| Q3 | What **currency**? | Displayed as **USD**, but the imported data is from IKEA Saudi Arabia, so the real figures are most likely **SAR**. The arithmetic is exact either way; only the `$` symbol is in doubt. One-line fix in `lib/money.ts`. **Worth a decision before judging.** |
| Q4 | Should a buyer be able to **cancel** an order and reclaim budget? | No on Day 1 *(C1)* |
| Q5 | Do judges expect **self-service signup**, or are seeded demo logins fine? | Seeded logins |
