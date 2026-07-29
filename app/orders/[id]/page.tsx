import Link from "next/link";
import { notFound } from "next/navigation";
import { Money } from "@/components/Money";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

/** One order's line items, at the prices actually paid (requirement S3). */
export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { placed } = await searchParams;

  // userId in the query is what stops one buyer reading another's order.
  const order = await db.order.findFirst({
    where: { id, userId: user.id },
    include: { items: { include: { product: true } } },
  });

  if (!order) notFound();

  return (
    <div>
      {placed && (
        <p
          role="status"
          className="mb-6 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Order placed. Your remaining budget has been updated.
        </p>
      )}

      <Link href="/orders" className="text-sm text-stone-500 hover:underline">
        ← Past orders
      </Link>

      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Order{" "}
        {order.placedAt?.toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </h1>

      <div className="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white">
        <ul className="divide-y divide-stone-200">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-stone-900">
                  {item.product.name}
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
          <Money
            cents={order.totalCents}
            className="text-lg font-semibold tabular-nums"
          />
        </div>
      </div>
    </div>
  );
}
