"use client";

import { useActionState } from "react";
import { placeOrder, type PlaceOrderState } from "@/app/actions/orders";

/**
 * The disabled state and the warning here are a courtesy only. The real guard
 * is the transaction on the server (architecture.md §4) — which is why placing
 * an order can still come back with an error even when this button looks happy.
 */
export function PlaceOrderButton({
  subtotalCents,
  remainingCents,
}: {
  subtotalCents: number;
  remainingCents: number;
}) {
  const [state, action, pending] = useActionState<PlaceOrderState, FormData>(
    placeOrder,
    {},
  );

  const overBudget = subtotalCents > remainingCents;

  return (
    <form action={action} className="space-y-3">
      {overBudget && (
        <p
          role="alert"
          className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          This order is over your remaining budget.
        </p>
      )}

      {state.error && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || overBudget}
        className="w-full rounded bg-emerald-700 px-4 py-2.5 font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
      >
        {pending ? "Placing order…" : "Place order"}
      </button>
    </form>
  );
}
