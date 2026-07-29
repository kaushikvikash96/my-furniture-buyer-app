/**
 * Client for the furniture shop's own catalogue API
 * (day1.training.cognitivo.com.au, documented in the Day 1 Participant Guide).
 *
 * Uses GET /catalogue/search-index — the lightweight, no-images endpoint.
 * Measured directly: 500 products in 0.6s / 153KB here, versus 7.0s / 57MB
 * on the plain GET /catalogue endpoint (which embeds images). This module
 * never calls /catalogue.
 *
 * The base URL and key come from COGNITIVO_API_BASE_URL and COGNITIVO_API_KEY
 * in .env — server-side only, never hardcoded, never sent to the browser.
 */

/** One item as returned by the catalogue API. */
export type CatalogItem = {
  item_id: string;
  product_name: string;
  price: number;
  category: string | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  colours: string[] | null;
  link: string | null;
  image_url: string | null; // always null on search-index — that's what makes it fast
};

/** search-index caps `limit` at 1000 per call. */
const PAGE_SIZE = 1000;

function credentials() {
  const baseUrl = process.env.COGNITIVO_API_BASE_URL;
  const apiKey = process.env.COGNITIVO_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "COGNITIVO_API_BASE_URL and COGNITIVO_API_KEY must be set. Copy .env.example to .env and fill them in.",
    );
  }
  return { baseUrl, apiKey };
}

async function fetchPage(skip: number): Promise<CatalogItem[]> {
  const { baseUrl, apiKey } = credentials();
  const url = `${baseUrl}/catalogue/search-index?limit=${PAGE_SIZE}&skip=${skip}`;
  console.log(`[cognitivo] GET /catalogue/search-index?skip=${skip} at ${new Date().toISOString()}`);
  const res = await fetch(url, {
    headers: { "X-Api-Key": apiKey },
    cache: "no-store", // always live — never served from Next's fetch cache
  });
  if (!res.ok) {
    throw new Error(
      `GET /catalogue/search-index failed: ${res.status} ${await res.text()}`,
    );
  }
  return res.json();
}

/** Every product in the catalogue, paged through so a future catalogue
 * bigger than 1000 products can't silently get truncated. */
export async function fetchAllProducts(): Promise<CatalogItem[]> {
  const all: CatalogItem[] = [];
  let skip = 0;
  while (true) {
    const page = await fetchPage(skip);
    all.push(...page);
    if (page.length < PAGE_SIZE) return all; // last page
    skip += PAGE_SIZE;
  }
}

/** A single product, by the shop's own id. Used to sync one item into our
 * local database the first time it's added to an order. */
export async function fetchProductById(itemId: string): Promise<CatalogItem | null> {
  const { baseUrl, apiKey } = credentials();
  const res = await fetch(`${baseUrl}/catalogue/${encodeURIComponent(itemId)}`, {
    headers: { "X-Api-Key": apiKey },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GET /catalogue/${itemId} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Source prices are decimal numbers like 51.6, meaning 51 dollars 60 cents.
 * We store integer cents, so multiply and round — 51.6 * 100 is 5159.999...
 * in floating point, which is exactly the drift ADR-3 exists to avoid.
 */
export function toCents(price: number): number {
  return Math.round(price * 100);
}

/**
 * The source `product_name` is generic ("Bar stool"), and dozens of products
 * share one. The product link carries the series name, so
 *   .../p/nordviken-bar-table-black-00368814/  ->  "Nordviken Bar table"
 * which makes the catalogue readable instead of a wall of duplicates.
 */
export function buildName(item: CatalogItem): string {
  const productName = (item.product_name ?? "").trim() || "Untitled product";
  const slug = /\/p\/([^/]+)\/?/.exec(item.link ?? "")?.[1];
  const series = slug?.split("-")[0] ?? "";

  // Reject anything that isn't a plausible series name.
  if (series.length < 3 || /\d/.test(series)) return productName;

  const titled = series[0].toUpperCase() + series.slice(1).toLowerCase();
  // Don't produce "Billy Billy bookcase" if the name already starts with it.
  if (productName.toLowerCase().startsWith(titled.toLowerCase())) {
    return productName;
  }
  return `${titled} ${productName}`;
}

/** The source has no description field, so build one from colours and dimensions. */
export function buildDescription(item: CatalogItem): string {
  const parts: string[] = [];

  const colours = (item.colours ?? []).filter(Boolean);
  if (colours.length > 0) {
    const readable = colours.join(", ");
    parts.push(readable[0].toUpperCase() + readable.slice(1));
  }

  const dims: string[] = [];
  if (item.width != null) dims.push(`W${item.width}`);
  if (item.depth != null) dims.push(`D${item.depth}`);
  if (item.height != null) dims.push(`H${item.height}`);
  if (dims.length > 0) parts.push(`${dims.join(" × ")} cm`);

  if (parts.length === 0) return item.category ?? "Furniture";
  return parts.join(" · ");
}

/** A catalogue item shaped for display — what the live catalogue page renders. */
export type DisplayProduct = {
  sourceId: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  imageUrl: string;
  sourceUrl: string | null;
};

export function toDisplayProduct(item: CatalogItem, imageUrl = ""): DisplayProduct {
  return {
    sourceId: item.item_id,
    name: buildName(item),
    description: buildDescription(item),
    category: (item.category ?? "Uncategorised").trim(),
    priceCents: toCents(item.price),
    imageUrl,
    sourceUrl: item.link ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Real balance and real orders — GET /users/{id}, POST /orders, GET /orders/{id}
//
// Everything below is a genuine, mutating (for placeOrder) integration with a
// REAL account: day1.training.cognitivo.com.au/users/cognitivo020, real money,
// no undo. See architecture.md §7 for the decision to replace the local
// budget/cart simulation with this.
// ─────────────────────────────────────────────────────────────────────────────

/** The one real account this app acts as — see architecture.md §7. */
export function cognitivoUserId(): string {
  const userId = process.env.COGNITIVO_USER_ID;
  if (!userId) {
    throw new Error("COGNITIVO_USER_ID must be set. Copy .env.example to .env and fill it in.");
  }
  return userId;
}

export type RealBalance = { userId: string; name: string; balanceCents: number };

/** GET /users/{user_id} — your current real balance, derived server-side from a ledger. */
export async function fetchUserBalance(userId: string): Promise<RealBalance> {
  const { baseUrl, apiKey } = credentials();
  const res = await fetch(`${baseUrl}/users/${encodeURIComponent(userId)}`, {
    headers: { "X-Api-Key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GET /users/${userId} failed: ${res.status} ${await res.text()}`);
  }
  const data: { user_id: string; name: string; balance: number } = await res.json();
  return { userId: data.user_id, name: data.name, balanceCents: toCents(data.balance) };
}

/** Thrown by placeRealOrder when the account can't afford the order (HTTP 402). */
export class InsufficientBalanceError extends Error {}
/** Thrown by placeRealOrder when the item doesn't exist (HTTP 404). */
export class ProductNotFoundError extends Error {}

export type PlacedOrder = { orderId: string; totalCents: number; remainingBalanceCents: number };

/**
 * POST /orders — places a REAL order against the shop's system. Not a
 * simulation: on success this genuinely spends the account's real balance,
 * permanently. See app/actions/orders.ts for the one place this is called.
 */
export async function placeRealOrder(
  userId: string,
  itemId: string,
  quantity: number,
): Promise<PlacedOrder> {
  const { baseUrl, apiKey } = credentials();
  const res = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ user_id: userId, items: [{ item_id: itemId, quantity }] }),
  });

  if (res.status === 402) {
    const body: { detail?: string } = await res.json().catch(() => ({}));
    throw new InsufficientBalanceError(body.detail ?? "Insufficient balance.");
  }
  if (res.status === 404) {
    const body: { detail?: string } = await res.json().catch(() => ({}));
    throw new ProductNotFoundError(body.detail ?? "Item not found.");
  }
  if (!res.ok) {
    throw new Error(`POST /orders failed: ${res.status} ${await res.text()}`);
  }

  const data: { order_id: string; total_price: number; remaining_balance: number } =
    await res.json();
  return {
    orderId: data.order_id,
    totalCents: toCents(data.total_price),
    remainingBalanceCents: toCents(data.remaining_balance),
  };
}

export type RealOrderLine = {
  // The order-history schema calls this `product_id`; the catalogue schema
  // calls the same kind of value `item_id`. Same id space, different name —
  // an inconsistency in the shop's own API, not a mistake here.
  productId: string;
  productName: string | null;
  quantity: number;
  unitPriceCents: number;
};

export type RealOrder = {
  orderId: string;
  totalCents: number;
  placedAt: string | null;
  items: RealOrderLine[];
};

/** GET /orders/{user_id} — this account's real order history, newest first. */
export async function fetchOrderHistory(userId: string): Promise<RealOrder[]> {
  const { baseUrl, apiKey } = credentials();
  const res = await fetch(`${baseUrl}/orders/${encodeURIComponent(userId)}`, {
    headers: { "X-Api-Key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GET /orders/${userId} failed: ${res.status} ${await res.text()}`);
  }
  const data: Array<{
    order_id: string;
    total_amount: number;
    timestamp: string | null;
    items: Array<{ product_id: string; product_name: string | null; quantity: number; unit_price: number }>;
  }> = await res.json();

  return data
    .map((order) => ({
      orderId: order.order_id,
      totalCents: toCents(order.total_amount),
      placedAt: order.timestamp,
      items: order.items.map((item) => ({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPriceCents: toCents(item.unit_price),
      })),
    }))
    .sort((a, b) => (b.placedAt ?? "").localeCompare(a.placedAt ?? ""));
}
