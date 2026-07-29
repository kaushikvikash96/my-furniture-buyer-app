import type { RealBalance } from "@/lib/cognitivo";
import { Money } from "./Money";

/**
 * The account's real balance (requirement 1), visible on every logged-in
 * page. Fetched live from GET /users/{user_id} — never stored locally, never
 * derived from anything in our own database. See architecture.md §7.
 */
export function BalanceBar({ balance }: { balance: RealBalance }) {
  return (
    <div className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-baseline justify-between px-4 py-4">
        <span className="text-sm text-stone-500">
          Real balance ({balance.userId})
        </span>
        <Money cents={balance.balanceCents} className="text-lg font-semibold text-stone-900" />
      </div>
    </div>
  );
}
