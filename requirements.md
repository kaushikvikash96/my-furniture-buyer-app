# Requirements — Furniture Buyer App

**Status:** Real integration built and verified · Last updated 2026-07-29

---

## 1. What we're building

A web app for a furniture shop's **buyers**. A buyer logs in, browses the
shop's real product catalogue, and clicks Buy to place a **real order**
through the shop's own system — spending their **real** balance, checked by
the shop itself, not a number we invented.

The one-sentence pitch changed with this revision: it used to be *"a buyer's
storefront that can't let you overspend against a made-up budget."* It's now
*"a buyer's storefront wired directly to the real thing."*

## 2. Who uses it

| Persona | What they need |
| --- | --- |
| **Buyer** (primary) | Log in, see their real balance, browse, buy, see confirmation |
| **Demo viewer** | Understand the whole flow in under 2 minutes without being taught |

Two demo logins exist (Sam, Alex) purely so there's something to log in *as*.
Both act on the **same one real account** — see §3, business rule 1. There is
no admin/manager role.

## 3. Business rules

1. **Every logged-in buyer acts as the same one real shop account** (`COGNITIVO_USER_ID` in `.env`). This app's API key only resolves to one real user; it isn't a limitation discovered late, it's a deliberate choice the owner made explicitly when asked. See [architecture.md §7](architecture.md).
2. **Balance is never stored or computed locally.** It's read fresh from the shop's API every time it's shown. This app has no `budgetCents` field anywhere anymore.
3. **An order is never stored or simulated locally.** Clicking Buy sends one real request to the shop's own order-placing endpoint. There is no local draft, no local cart, no local rejection logic — the shop's system is the only thing that decides whether an order succeeds.
4. **Money is stored in whole minor units** (cents) the moment it's read from the shop's API, never as a decimal. Displayed as currency only at the last moment.
5. **Every distinguishable failure gets its own message.** "Not enough balance" and "item no longer exists" read differently to a buyer, so they're detected and shown differently — see requirement 3 below.
6. **Nothing the shop's API does is ever allowed to crash the page.** Every call to it is wrapped so a failure becomes a clear, on-screen message.

## 4. Requirements (as given) and how each is met

### Requirement 1 — show the real balance

> On the logged-in user's page, show their real balance from the furniture
> shop API instead of whatever balance we were tracking in our own database
> before.

- **Met.** `GET /users/{user_id}` is called live, on every page load, from `app/layout.tsx` — so the balance shown in the nav bar on *every* logged-in page is the real one, not a stored figure.
- The old local `budgetCents` field, and everything that computed a "remaining budget" from it, no longer exist in the code at all (see [architecture.md ADR-4](architecture.md), marked superseded).
- If the balance service is unreachable, the page still renders — a clear message replaces the balance figure rather than a crash. Verified by pointing the app at an unreachable host.

### Requirement 2 — Buy places a real order

> When a logged-in user clicks "Buy" on a product, place a real order through
> the furniture shop API for that user and that item. Show them the
> confirmation and updated balance afterwards.

- **Met.** Each product card has one **Buy** button (`components/BuyButton.tsx`). One click calls `buyNow` (`app/actions/orders.ts`), which sends exactly one `POST /orders` for that item, quantity 1, for the account named in requirement 1.
- On success, the buyer is taken to an order confirmation page showing the items, the total, and — because the shop's own response includes it — the new balance, re-confirmed with a fresh `GET /users/{user_id}`.
- **Verified for real**, not just read from a spec: one genuine $1.20 order was placed against the real account during development, with the balance confirmed to move from $4,804.00 to $4,802.80 and the confirmation page showing both correctly. There's no sandbox for this — every future click is real too.

### Requirement 3 — clear, specific error messages, never a crash

> If an order fails because the user doesn't have enough balance, show a
> clear "insufficient balance" message instead of a generic error. If a
> product no longer exists, show a friendly "this item is no longer
> available" message. Don't let either of these crash the page.

- **Met**, and the exact shape of both failures was confirmed by deliberately triggering them against the real account (not guessed from documentation, which only lists a generic `422`):

  | Failure | What the shop's API actually returns | What the buyer sees |
  | --- | --- | --- |
  | Insufficient balance | `402 Payment Required`, `{"detail": "Balance X is less than total price Y"}` | "You don't have enough balance for this order." |
  | Item no longer exists | `404 Not Found`, `{"detail": "No product with item_id '...'"}` | "This item is no longer available." |
  | Anything else (network blip, an API change, a bug) | any other non-success response | "Something went wrong placing your order. Please try again." — logged server-side, never shown as a raw error |

- **Crash-safety verified two ways:** a real click on a deliberately-nonexistent item returned the friendly message with no error page; and the catalogue/balance pages were tested against a completely unreachable host, confirming a `200` with a plain-English notice, not a `500`.
- Since no single product currently costs more than the real balance, the "insufficient balance" *message* was verified at the `lib/cognitivo.ts` level directly (calling the real endpoint with a deliberately huge quantity) rather than through a literal Buy click — the underlying detection is proven; only the specific UI click for *this* exact scenario hasn't happened live, because nothing in the catalogue is currently expensive enough to trigger it that way.

## 5. What this replaced

Everything below existed in an earlier version of this app and was
**deliberately removed**, not merely deprecated, when the owner asked to
replace the local simulation with the real integration above:

- A fictional per-buyer budget (`User.budgetCents`), seeded at $50,000 / $12,000.
- A local shopping cart (`Order` with `status = "DRAFT"`), added-to via "Add to order," with quantity controls.
- A swappable local budget policy (one-off total vs. monthly allowance), enforced in a database transaction on "Place order."
- A locally-mirrored `Product` table, kept in sync with the shop's catalogue by import or lazy sync.

None of it is "still there but unused" — the `Order`, `OrderItem`, and
`Product` tables were dropped from the database, and the files that
implemented this (`lib/budget.ts`, `prisma/import-catalog.ts`,
`components/PlaceOrderButton.tsx`, `app/order/page.tsx`) were deleted.
[architecture.md §3](architecture.md) shows what remains: `User` and
`Session`, nothing else.

## 6. Still true from the original build

- **M1/M2 — login and route protection.** Unchanged: email + password, HttpOnly session cookie, every page but `/login` redirects when logged out.
- **Catalogue browsing** — name, price, category, description built from dimensions/colours, search, category filter, pagination. Now live from the shop's API rather than a local copy (this was itself a prior revision — see the git history / earlier drafts of this file if curious).
- **Order history** — a list of past orders and a detail page per order. Now reading real history from `GET /orders/{user_id}` instead of local rows.
- **Responsive layout, currency formatting, integer-cents arithmetic** — unaffected by this revision.

## 7. Non-functional requirements

- **Demo-ready:** runs with two commands on a laptop.
- **Fast where it can be:** login and navigation stay fast; the catalogue, balance, and order pages are only as fast as the shop's API is at that moment — measured anywhere from well under a second to a few seconds. Not something this app controls.
- **Honest security basics:** passwords hashed, session cookie HttpOnly, no secrets committed to git. Not a claim of production-grade security.
- **Resettable — for login only.** `npm run db:reset` restores clean demo logins in seconds. It cannot and does not reset anything real; there is no undo for a real order.
- **Understandable:** no coding background on the owner's side, so file names, structure, and this document stay in plain English.

## 8. Decisions & open questions

### Decided

| # | Question | Decision (2026-07-29) |
| --- | --- | --- |
| Q1 | Should the real integration replace the local budget demo, or sit alongside it? | **Replace it.** The local simulation was removed entirely — see §5. |
| Q2 | Which shop account should logged-in buyers act as? | **`cognitivo020`, the only account this API key can see.** Both demo logins act on it. |
| Q3 | Permission to test the real "insufficient balance" / "item not found" paths against the real account? | **Yes** — two deliberately-failing requests were sent (a wildly over-quantity order, a nonexistent item id), confirmed to leave the real balance untouched, and one genuine $1.20 order was placed to verify the success path. |
| Q4 | Does the demo need a public URL? | **Laptop only** — unaffected by this revision. |

### Still open

| # | Question | Working default |
| --- | --- | --- |
| Q5 | Should any product cost enough to genuinely exercise "insufficient balance" through a real Buy click, for demo purposes? | Not currently — every item is affordable against the $4,800-ish real balance. Worth deciding before a demo that wants to show this path live rather than described. |
| Q6 | What happens as the real balance runs low over repeated real testing? | No plan yet — it only goes down, never resets. Worth a decision before extensive rehearsal. |
