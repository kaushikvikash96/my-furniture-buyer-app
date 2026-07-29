"use client";

import { useActionState } from "react";
import { buyNow, type BuyState } from "@/app/actions/orders";

/**
 * One click places a REAL order (architecture.md §7) — there's no cart, no
 * "are you sure", no undo. The disabled state on the card that renders this
 * is a courtesy only; the actual guard is the shop's own balance check,
 * which is why this can still come back with an error even when the button
 * looked enabled a moment ago.
 */
export function BuyButton({ sourceId }: { sourceId: string }) {
  const [state, action, pending] = useActionState<BuyState, FormData>(buyNow, {});

  return (
    <form action={action}>
      <input type="hidden" name="sourceId" value={sourceId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Placing order…" : "Buy"}
      </button>
      {state.error && (
        <p role="alert" className="mt-1 max-w-40 text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
