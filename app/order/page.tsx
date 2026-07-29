import Link from "next/link";
import { changeQuantity, removeItem } from "@/app/actions/orders";
import { Money } from "@/components/Money";
import { PlaceOrderButton } from "@/components/PlaceOrderButton";
import { getBudgetSummary } from "@/lib/budget";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

/** The current draft order — the cart (requirements M4, M6). */
export default async function OrderPage() {
  const user = await requireUser();

  const [draft, budget] = await Promise.all([
    db.order.findFirst({
      where: { userId: user.id, status: "DRAFT" },
      include: { items: { include: { product: true } } },
    }),
    getBudgetSummary(user.id),
  ]);

  const items = draft?.items ?? [];
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceCents,
    0,
  );

  if (items.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Current order</h1>
        <p className="mt-6 rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
          Your order is empty.{" "}
          <Link href="/catalogue" className="font-medium underline">
            Browse the catalogue
          </Link>{" "}
          to add something.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Current order</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 divide-y divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-white">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-stone-900">
                  {item.product.name}
                </p>
                <p className="mt-0.5 text-sm text-stone-500">
                  <Money cents={item.unitPriceCents} /> each
                </p>
              </div>

              {/* Plain forms, so quantity works with no JavaScript at all. */}
              <div className="flex items-center gap-1">
                <form action={changeQuantity}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="delta" value={-1} />
                  <button
                    type="submit"
                    aria-label={`Reduce quantity of ${item.product.name}`}
                    className="h-8 w-8 rounded border border-stone-300 text-stone-700 hover:bg-stone-100"
                  >
                    −
                  </button>
                </form>
                <span
                  className="w-10 text-center tabular-nums"
                  aria-label="Quantity"
                >
                  {item.quantity}
                </span>
                <form action={changeQuantity}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="delta" value={1} />
                  <button
                    type="submit"
                    aria-label={`Increase quantity of ${item.product.name}`}
                    className="h-8 w-8 rounded border border-stone-300 text-stone-700 hover:bg-stone-100"
                  >
                    +
                  </button>
                </form>
              </div>

              <Money
                cents={item.quantity * item.unitPriceCents}
                className="w-28 text-right font-medium tabular-nums"
              />

              <form action={removeItem}>
                <input type="hidden" name="itemId" value={item.id} />
                <button
                  type="submit"
                  className="text-sm text-stone-400 hover:text-red-700"
                >
                  Remove
                </button>
              </form>
            </div>
          ))}
        </div>

        <aside className="h-fit rounded-lg border border-stone-200 bg-white p-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-600">Order subtotal</dt>
              <dd className="font-medium tabular-nums">
                <Money cents={subtotalCents} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-600">Budget remaining</dt>
              <dd className="font-medium tabular-nums">
                <Money cents={budget.remainingCents} />
              </dd>
            </div>
            <div className="flex justify-between border-t border-stone-200 pt-2">
              <dt className="text-stone-600">Left after this order</dt>
              <dd
                className={`font-semibold tabular-nums ${
                  budget.remainingCents - subtotalCents < 0
                    ? "text-red-700"
                    : "text-emerald-700"
                }`}
              >
                <Money cents={budget.remainingCents - subtotalCents} />
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            <PlaceOrderButton
              subtotalCents={subtotalCents}
              remainingCents={budget.remainingCents}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
