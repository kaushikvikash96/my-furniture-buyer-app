import type { BudgetSummary } from "@/lib/budget";
import { Money } from "./Money";

/**
 * Total / spent / remaining, visible on every logged-in page (requirement M5).
 * These figures are calculated, never stored — see architecture.md §3.
 */
export function BudgetBar({ summary }: { summary: BudgetSummary }) {
  const { totalCents, spentCents, remainingCents, periodLabel } = summary;
  const usedPercent =
    totalCents > 0
      ? Math.min(100, Math.round((spentCents / totalCents) * 100))
      : 0;

  const nearlyGone = remainingCents <= totalCents * 0.1;

  return (
    <div className="border-b border-stone-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
            <span className="text-stone-500">
              Budget{" "}
              <Money cents={totalCents} className="font-medium text-stone-900" />
            </span>
            <span className="text-stone-500">
              Spent{" "}
              <Money cents={spentCents} className="font-medium text-stone-900" />
            </span>
            <span
              className={
                nearlyGone
                  ? "font-semibold text-amber-700"
                  : "font-semibold text-emerald-700"
              }
            >
              <Money cents={remainingCents} /> remaining
            </span>
          </div>
          <span className="text-xs uppercase tracking-wide text-stone-400">
            {periodLabel}
          </span>
        </div>

        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-stone-200"
          role="progressbar"
          aria-valuenow={usedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Budget used"
        >
          <div
            className={`h-full rounded-full transition-all ${
              nearlyGone ? "bg-amber-500" : "bg-emerald-600"
            }`}
            style={{ width: `${usedPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
