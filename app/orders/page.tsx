import Link from "next/link";
import { Money } from "@/components/Money";
import { cognitivoUserId, fetchOrderHistory } from "@/lib/cognitivo";
import { requireUser } from "@/lib/session";

/**
 * Real past orders, newest first (requirement M7 / requirement 2's
 * "confirmation" trail). Fetched live from GET /orders/{user_id} — every
 * logged-in buyer sees the same list, because they all act as the one real
 * account (architecture.md §7).
 */
export default async function OrdersPage() {
  await requireUser(); // still gates the page — see architecture.md §7 for why the data itself is shared

  let orders: Awaited<ReturnType<typeof fetchOrderHistory>> = [];
  let fetchError: string | null = null;
  try {
    orders = await fetchOrderHistory(cognitivoUserId());
  } catch (error) {
    fetchError = error instanceof Error ? error.message : "The orders service didn't respond.";
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Past orders</h1>
      <p className="mt-1 text-sm text-stone-500">
        Real order history for {cognitivoUserId()}.
      </p>

      {fetchError && (
        <p
          role="alert"
          className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          Couldn&apos;t load order history right now ({fetchError}). Try
          refreshing in a moment.
        </p>
      )}

      {orders.length === 0 && !fetchError ? (
        <p className="mt-6 rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
          No orders placed yet.{" "}
          <Link href="/catalogue" className="font-medium underline">
            Browse the catalogue
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-white">
          {orders.map((order) => (
            <li key={order.orderId}>
              <Link
                href={`/orders/${order.orderId}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-stone-50"
              >
                <div>
                  <p className="font-medium text-stone-900">
                    {order.placedAt
                      ? new Date(order.placedAt).toLocaleString("en-US", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "Date unknown"}
                  </p>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {order.items.length} {order.items.length === 1 ? "item" : "items"}
                  </p>
                </div>
                <Money cents={order.totalCents} className="font-semibold tabular-nums" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
