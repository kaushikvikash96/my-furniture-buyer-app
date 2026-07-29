"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getBudgetSummary } from "@/lib/budget";
import { formatCents } from "@/lib/money";
import { requireUser } from "@/lib/session";

/** A rule the buyer broke (over budget, empty order) — not a bug. */
class OrderProblem extends Error {}

/** The cart is just an Order with status DRAFT — architecture.md §3. */
async function getOrCreateDraft(userId: string) {
  const existing = await db.order.findFirst({
    where: { userId, status: "DRAFT" },
  });
  return existing ?? db.order.create({ data: { userId, status: "DRAFT" } });
}

function refreshPages() {
  revalidatePath("/catalogue");
  revalidatePath("/order");
  revalidatePath("/orders");
}

export async function addToOrder(formData: FormData): Promise<void> {
  const user = await requireUser();
  const productId = String(formData.get("productId") ?? "");

  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) return;

  const draft = await getOrCreateDraft(user.id);

  await db.orderItem.upsert({
    where: { orderId_productId: { orderId: draft.id, productId } },
    // unitPriceCents is copied NOW, so re-pricing later can't rewrite history.
    create: {
      orderId: draft.id,
      productId,
      quantity: 1,
      unitPriceCents: product.priceCents,
    },
    update: { quantity: { increment: 1 } },
  });

  refreshPages();
}

export async function changeQuantity(formData: FormData): Promise<void> {
  const user = await requireUser();
  const itemId = String(formData.get("itemId") ?? "");
  const delta = Number(formData.get("delta") ?? 0);

  // Scoped through the order to this user — nobody can touch someone else's line.
  const item = await db.orderItem.findFirst({
    where: { id: itemId, order: { userId: user.id, status: "DRAFT" } },
  });
  if (!item) return;

  const quantity = item.quantity + delta;
  if (quantity < 1) {
    await db.orderItem.delete({ where: { id: item.id } });
  } else {
    await db.orderItem.update({ where: { id: item.id }, data: { quantity } });
  }

  refreshPages();
}

export async function removeItem(formData: FormData): Promise<void> {
  const user = await requireUser();
  const itemId = String(formData.get("itemId") ?? "");

  await db.orderItem.deleteMany({
    where: { id: itemId, order: { userId: user.id, status: "DRAFT" } },
  });

  refreshPages();
}

export type PlaceOrderState = { error?: string };

/**
 * Placing an order — the one genuinely tricky bit (architecture.md §4).
 *
 * The budget check and the write happen inside ONE transaction. If they were
 * separate steps, a double-clicked button could slip two orders through: each
 * passes the check, together they bust the budget.
 */
export async function placeOrder(
  _previous: PlaceOrderState,
  _formData: FormData,
): Promise<PlaceOrderState> {
  const user = await requireUser();
  let placedOrderId: string;

  try {
    placedOrderId = await db.$transaction(async (tx) => {
      const draft = await tx.order.findFirst({
        where: { userId: user.id, status: "DRAFT" },
        include: { items: true },
      });

      if (!draft || draft.items.length === 0) {
        throw new OrderProblem("Your order is empty.");
      }

      // Recomputed from the database — a total sent by the browser is never trusted.
      const totalCents = draft.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPriceCents,
        0,
      );

      const { remainingCents } = await getBudgetSummary(user.id, tx);

      if (totalCents > remainingCents) {
        const over = formatCents(totalCents - remainingCents);
        throw new OrderProblem(
          `That order is ${over} over your remaining budget. Remove something and try again.`,
        );
      }

      await tx.order.update({
        where: { id: draft.id },
        data: { status: "PLACED", totalCents, placedAt: new Date() },
      });

      return draft.id;
    });
  } catch (error) {
    if (error instanceof OrderProblem) return { error: error.message };
    throw error; // a real bug — let it surface rather than hiding it
  }

  revalidatePath("/", "layout"); // budget bar lives in the layout
  refreshPages();
  redirect(`/orders/${placedOrderId}?placed=1`);
}
