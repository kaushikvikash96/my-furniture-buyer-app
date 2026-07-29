import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { getBudgetSummary } from "@/lib/budget";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 24;

/**
 * The home page: the furniture catalogue (requirements M3, M8).
 *
 * The real catalogue has hundreds of products, so this page filters and
 * paginates rather than rendering everything. Search and category are plain
 * links and a GET form, so none of it needs JavaScript.
 */
export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const user = await requireUser(); // the route guard (M2)
  const { q, category, page } = await searchParams;

  const search = (q ?? "").trim();
  const currentPage = Math.max(1, Number(page) || 1);

  const where: Prisma.ProductWhereInput = {
    ...(search ? { name: { contains: search } } : {}),
    ...(category ? { category } : {}),
  };

  const [products, matchCount, categories, budget] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ name: "asc" }],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.product.count({ where }),
    db.product.groupBy({
      by: ["category"],
      _count: { category: true },
      orderBy: { category: "asc" },
    }),
    getBudgetSummary(user.id),
  ]);

  const totalPages = Math.max(1, Math.ceil(matchCount / PAGE_SIZE));

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
        <p className="text-sm text-stone-500">
          {matchCount.toLocaleString("en-US")}
          {search || category ? " matching" : ""} product
          {matchCount === 1 ? "" : "s"}
        </p>
      </div>

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
            key={c.category}
            href={linkTo({ category: c.category, page: 1 })}
            className={`rounded-full px-3 py-1 text-xs ${
              category === c.category
                ? "bg-stone-900 text-white"
                : "bg-white text-stone-600 ring-1 ring-stone-300 hover:bg-stone-100"
            }`}
          >
            {c.category}{" "}
            <span className="text-stone-400">{c._count.category}</span>
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <p className="mt-8 rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
          No products match. Try clearing the filters, or run{" "}
          <code>npm run db:import-catalog</code> if the catalogue is empty.
        </p>
      ) : (
        <>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                remainingCents={budget.remainingCents}
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
