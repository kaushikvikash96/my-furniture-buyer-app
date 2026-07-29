import Link from "next/link";
import { notFound } from "next/navigation";
import { Money } from "@/components/Money";
import { cognitivoUserId, fetchOrderHistory, fetchUserBalance } from "@/lib/cognitivo";
import { requireUser } from "@/lib/session";

/**
 * One real order's line items, at the prices actually paid (requirement S3),
 * plus the post-purchase confirmation + updated balance (requirement 2).
 *
 * There's no GET-one-order-by-id on the shop's API with a documented shape
 * (only a full history list, and an /invoice endpoint whose schema isn't
 * specified) — so this finds the order within the history list. Fine at this
 * scale; would need a smarter lookup if history ever got large.
 */
export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { placed } = await searchParams;

  const userId = cognitivoUserId();
  const orders = await fetchOrderHistory(userId);
  const order = orders.find((o) => o.orderId === id);

  if (!order) notFound();

  let balance = null;
  if (placed) {
    try {
      balance = await fetchUserBalance(userId);
    } catch {
      // Confirmation still shows below even if this particular re-check fails.
    }
  }

  return (
    <div>
      {placed && (
        <p
          role="status"
          className="mb-6 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Order placed for real.{" "}
          {balance ? (
            <>
              Your balance is now <Money cents={balance.balanceCents} className="font-semibold" />.
            </>
          ) : (
            "Balance updated on the shop's side."
          )}
        </p>
      )}

      <Link href="/orders" className="text-sm text-stone-500 hover:underline">
        ← Past orders
      </Link>

      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Order{" "}
        {order.placedAt
          ? new Date(order.placedAt).toLocaleDateString("en-US", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : ""}
      </h1>

      <div className="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white">
        <ul className="divide-y divide-stone-200">
          {order.items.map((item, i) => (
            <li key={`${item.productId}-${i}`} className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-stone-900">
                  {item.productName ?? item.productId}
                </p>
                <p className="mt-0.5 text-sm text-stone-500">
                  {item.quantity} × <Money cents={item.unitPriceCents} />
                  <span className="text-stone-400"> (price at order)</span>
                </p>
              </div>
              <Money
                cents={item.quantity * item.unitPriceCents}
                className="font-medium tabular-nums"
              />
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-stone-300 bg-stone-50 p-4">
          <span className="font-medium text-stone-700">Order total</span>
          <Money cents={order.totalCents} className="text-lg font-semibold tabular-nums" />
        </div>
      </div>
    </div>
  );
}
