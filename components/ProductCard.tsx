import type { DisplayProduct } from "@/lib/cognitivo";
import { BuyButton } from "./BuyButton";
import { Money } from "./Money";

/**
 * One product in the catalogue grid, fetched live from the shop's API. Buy
 * places a REAL order for this exact item — see architecture.md §7.
 *
 * Most of these have no photo — the live endpoint doesn't return one — so
 * the image is only rendered when we actually have one (a leftover local
 * file from an earlier import, if any). Otherwise it's just the gradient
 * tile, not a broken-image icon.
 */
export function ProductCard({
  product,
  remainingBalanceCents,
}: {
  product: DisplayProduct;
  remainingBalanceCents: number;
}) {
  const affordable = product.priceCents <= remainingBalanceCents;

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
      <div className="relative aspect-4/3 bg-linear-to-br from-stone-200 to-stone-300">
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
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
            <BuyButton sourceId={product.sourceId} />
          ) : (
            // Requirement S2 — over remaining balance, so it can't be bought.
            <span
              className="rounded bg-stone-100 px-3 py-2 text-sm text-stone-500"
              title="This costs more than your remaining balance"
            >
              Insufficient balance
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
