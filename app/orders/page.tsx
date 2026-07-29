import Link from "next/link";
import { Money } from "@/components/Money";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

/** Past placed orders, newest first (requirement M7). */
export default async function OrdersPage() {
  const user = await requireUser();

  // Scoped to this user — you can never see anyone else's orders.
  const orders = await db.order.findMany({
    where: { userId: user.id, status: "PLACED" },
    orderBy: { placedAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Past orders</h1>

      {orders.length === 0 ? (
        <p className="mt-6 rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
          You haven&apos;t placed any orders yet.{" "}
          <Link href="/catalogue" className="font-medium underline">
            Browse the catalogue
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-white">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-stone-50"
              >
                <div>
                  <p className="font-medium text-stone-900">
                    {order.placedAt?.toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {order._count.items}{" "}
                    {order._count.items === 1 ? "item" : "items"}
                  </p>
                </div>
                <Money
                  cents={order.totalCents}
                  className="font-semibold tabular-nums"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
