"use client";

import { useActionState } from "react";
import { askAssistantAction, type AssistantState } from "@/app/actions/assistant";
import { BuyButton } from "@/components/BuyButton";
import { Money } from "@/components/Money";

const initialState: AssistantState = { reply: "" };

/**
 * The Ask assistant's text box. The reply is plain text; recommendation (if
 * any) renders as a card with a real BuyButton (components/BuyButton.tsx) —
 * the same one-click-one-real-order button used everywhere else. The
 * assistant itself never places an order; only that manual click does.
 */
export function AssistantForm() {
  const [state, action, pending] = useActionState<AssistantState, FormData>(askAssistantAction, initialState);

  return (
    <div>
      <form action={action} className="flex flex-col gap-3">
        <textarea
          name="question"
          rows={3}
          placeholder="e.g. something cheap for a small kitchen, or a black bookcase"
          className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Thinking…" : "Ask"}
        </button>
      </form>

      {state.error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {state.reply && (
        <div className="mt-6 rounded-lg border border-stone-200 bg-white p-4">
          <p className="whitespace-pre-wrap text-sm text-stone-800">{state.reply}</p>

          {state.recommendation && (
            <div className="mt-4 flex items-center justify-between gap-4 rounded border border-stone-200 bg-stone-50 p-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-stone-900">{state.recommendation.name}</p>
                <Money cents={state.recommendation.priceCents} className="text-sm text-stone-500" />
                <p className="mt-1 text-xs text-stone-500">{state.recommendation.reason}</p>
              </div>
              <BuyButton sourceId={state.recommendation.itemId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
