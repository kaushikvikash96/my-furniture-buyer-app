import { readdir } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import {
  cognitivoUserId,
  fetchAllProducts,
  fetchUserBalance,
  toDisplayProduct,
  type DisplayProduct,
} from "@/lib/cognitivo";
import { requireUser } from "@/lib/session";

const PAGE_SIZE = 24;
const IMAGE_DIR = path.join(process.cwd(), "public", "products");

/** Product photos left over from an earlier version of this app (the live
 * catalogue API never returns one). One directory read, not 762 file checks. */
async function localImageBySourceId(): Promise<Map<string, string>> {
  try {
    const files = await readdir(IMAGE_DIR);
    return new Map(files.map((f) => [path.parse(f).name, `/products/${f}`]));
  } catch {
    return new Map(); // no leftover photos — fine, cards just show the gradient tile
  }
}

/**
 * The home page: the furniture catalogue (requirements M3, M8).
 *
 * Fetches LIVE from the shop's catalogue API on every view — see
 * lib/cognitivo.ts and architecture.md §7. There is no local caching; every
 * request is a fresh call to GET /catalogue/search-index. The search-index
 * endpoint has no free-text search, so search/category/pagination are all
 * done here, in memory, against the fetched list.
 *
 * If the shop's API is unreachable, this page shows a clear error instead of
 * crashing (requirement 3).
 */
export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  await requireUser(); // the route guard (M2)
  const { q, category, page } = await searchParams;

  const search = (q ?? "").trim().toLowerCase();
  const currentPage = Math.max(1, Number(page) || 1);

  let allProducts: DisplayProduct[];
  let fetchedAt: Date;
  let fetchError: string | null = null;

  try {
    const [items, images] = await Promise.all([fetchAllProducts(), localImageBySourceId()]);
    fetchedAt = new Date();
    allProducts = items.map((item) => toDisplayProduct(item, images.get(item.item_id) ?? ""));
  } catch (error) {
    fetchError =
      error instanceof Error ? error.message : "The catalogue service didn't respond.";
    allProducts = [];
    fetchedAt = new Date();
  }

  let remainingBalanceCents = 0;
  let balanceError: string | null = null;
  try {
    const balance = await fetchUserBalance(cognitivoUserId());
    remainingBalanceCents = balance.balanceCents;
  } catch (error) {
    balanceError =
      error instanceof Error ? error.message : "The balance service didn't respond.";
  }

  const categoryCounts = new Map<string, number>();
  for (const p of allProducts) {
    categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
  }
  const categories = [...categoryCounts.keys()].sort();

  const filtered = allProducts.filter(
    (p) =>
      (!search || p.name.toLowerCase().includes(search)) &&
      (!category || p.category === category),
  );

  const matchCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(matchCount / PAGE_SIZE));
  const products = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    (currentPage - 1) * PAGE_SIZE + PAGE_SIZE,
  );

  /** Build a link that keeps the other filters intact. */
  function linkTo(next: { category?: string | null; page?: number }) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    const nextCategory =
      next.category === undefined ? category : (next.category ?? undefined);
    if (nextCategory) params.set("category", nextCategory);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    return query ? `/catalogue?${query}` : "/catalogue";
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Catalogue</h1>
        <div className="text-right text-sm text-stone-500">
          <p>
            {matchCount.toLocaleString("en-US")}
            {search || category ? " matching" : ""} product
            {matchCount === 1 ? "" : "s"}
          </p>
          <p
            className="text-xs text-stone-400"
            title="Fetched fresh from the shop's catalogue API on this page load — no caching"
          >
            live · fetched {fetchedAt.toLocaleTimeString("en-US")}
          </p>
        </div>
      </div>

      {fetchError && (
        <p
          role="alert"
          className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          The shop&apos;s catalogue service isn&apos;t responding right now
          ({fetchError}). Try refreshing in a moment.
        </p>
      )}
      {balanceError && (
        <p
          role="alert"
          className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          Couldn&apos;t check your real balance ({balanceError}) — affordability
          below may be wrong. Try refreshing.
        </p>
      )}

      <form method="GET" action="/catalogue" className="mt-4 flex gap-2">
        {category && <input type="hidden" name="category" value={category} />}
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search by name…"
          aria-label="Search products by name"
          className="w-full max-w-xs rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
        >
          Search
        </button>
        {(search || category) && (
          <Link
            href="/catalogue"
            className="self-center text-sm text-stone-500 underline hover:text-stone-900"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={linkTo({ category: null, page: 1 })}
          className={`rounded-full px-3 py-1 text-xs ${
            category
              ? "bg-white text-stone-600 ring-1 ring-stone-300 hover:bg-stone-100"
              : "bg-stone-900 text-white"
          }`}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c}
            href={linkTo({ category: c, page: 1 })}
            className={`rounded-full px-3 py-1 text-xs ${
              category === c
                ? "bg-stone-900 text-white"
                : "bg-white text-stone-600 ring-1 ring-stone-300 hover:bg-stone-100"
            }`}
          >
            {c} <span className="text-stone-400">{categoryCounts.get(c)}</span>
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <p className="mt-8 rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
          {fetchError
            ? "Couldn't load the catalogue — see the message above."
            : "No products match. Try clearing the filters."}
        </p>
      ) : (
        <>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.sourceId}
                product={product}
                remainingBalanceCents={remainingBalanceCents}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-between border-t border-stone-200 pt-4 text-sm">
              {currentPage > 1 ? (
                <Link
                  href={linkTo({ page: currentPage - 1 })}
                  className="rounded border border-stone-300 bg-white px-3 py-2 hover:bg-stone-100"
                >
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-stone-500">
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages ? (
                <Link
                  href={linkTo({ page: currentPage + 1 })}
                  className="rounded border border-stone-300 bg-white px-3 py-2 hover:bg-stone-100"
                >
                  Next →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
