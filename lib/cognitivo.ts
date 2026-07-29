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
