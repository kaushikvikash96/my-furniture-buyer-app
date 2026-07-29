import type { Product } from "@prisma/client";
import { addToOrder } from "@/app/actions/orders";
import { Money } from "./Money";

/**
 * One product in the catalogue grid.
 *
 * The image sits on a gradient tile, so if a placeholder photo fails to load
 * you get a tasteful coloured card rather than a broken-image icon.
 */
export function ProductCard({
  product,
  remainingCents,
}: {
  product: Product;
  remainingCents: number;
}) {
  const affordable = product.priceCents <= remainingCents;

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
      <div className="relative aspect-4/3 bg-linear-to-br from-stone-200 to-stone-300">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <span className="text-xs uppercase tracking-wide text-stone-400">
          {product.category}
        </span>
        {product.sourceUrl && (
          <a
            href={product.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-stone-400 underline hover:text-stone-700"
          >
            View product page ↗
          </a>
        )}
        <h3 className="mt-1 font-medium text-stone-900">{product.name}</h3>
        <p className="mt-1 flex-1 text-sm leading-relaxed text-stone-600">
          {product.description}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <Money
            cents={product.priceCents}
            className="text-lg font-semibold text-stone-900"
          />

          {affordable ? (
            <form action={addToOrder}>
              <input type="hidden" name="productId" value={product.id} />
              <button
                type="submit"
                className="rounded bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700"
              >
                Add to order
              </button>
            </form>
          ) : (
            // Requirement S2 — over remaining budget, so it can't be added.
            <span
              className="rounded bg-stone-100 px-3 py-2 text-sm text-stone-500"
              title="This costs more than your remaining budget"
            >
              Over budget
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
