"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  cognitivoUserId,
  InsufficientBalanceError,
  placeRealOrder,
  ProductNotFoundError,
} from "@/lib/cognitivo";
import { requireUser } from "@/lib/session";

export type BuyState = { error?: string };

/**
 * Places a REAL order through the furniture shop's API. Not a simulation —
 * on success this genuinely spends the account's real balance, permanently.
 * See architecture.md §7 for why there's no local cart or budget check here
 * anymore: the shop's own system is now the one source of truth for both.
 *
 * Our own login still gates this (requireUser) — but every logged-in buyer
 * acts as the same one real account (COGNITIVO_USER_ID), because that's the
 * only account this API key has.
 */
export async function buyNow(_previous: BuyState, formData: FormData): Promise<BuyState> {
  await requireUser();
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!sourceId) return { error: "Something went wrong. Please try again." };

  let orderId: string;
  try {
    const result = await placeRealOrder(cognitivoUserId(), sourceId, 1);
    orderId = result.orderId;
  } catch (error) {
    // Two specific, expected failures get a clear message each; anything
    // else (network blip, an API change, a bug) gets a generic one — never
    // a crash. See requirement 3.
    if (error instanceof InsufficientBalanceError) {
      return { error: "You don't have enough balance for this order." };
    }
    if (error instanceof ProductNotFoundError) {
      return { error: "This item is no longer available." };
    }
    console.error("buyNow failed:", error);
    return { error: "Something went wrong placing your order. Please try again." };
  }

  revalidatePath("/", "layout"); // the real balance shown in the nav
  revalidatePath("/orders");
  redirect(`/orders/${orderId}?placed=1`);
}
