import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";

/**
 * The budget rule, as a swappable module (architecture.md ADR-4).
 *
 * Any budget rule only answers two questions:
 *   1. how much is this buyer allocated?
 *   2. which of their placed orders count against that allocation?
 *
 * Answer those differently and you get every variant. Nothing else in the app
 * knows which rule is active — everything goes through getBudgetSummary().
 */
export type BudgetPeriod = {
  /** null = no lower bound (count orders from the beginning of time) */
  from: Date | null;
  /** null = no upper bound */
  to: Date | null;
};

export type BudgetPolicy = {
  name: string;
  allocationCents: (user: { budgetCents: number }) => number;
  currentPeriod: (now: Date) => BudgetPeriod;
  periodLabel: (now: Date) => string;
};

/** Spend it once. Every placed order counts, forever. */
export const oneOffTotal: BudgetPolicy = {
  name: "One-off total",
  allocationCents: (user) => user.budgetCents,
  currentPeriod: () => ({ from: null, to: null }),
  periodLabel: () => "All time",
};

/** Same allowance every month; only this month's orders count. */
export const monthlyAllowance: BudgetPolicy = {
  name: "Monthly allowance",
  allocationCents: (user) => user.budgetCents,
  currentPeriod: (now) => ({
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  }),
  periodLabel: (now) =>
    now.toLocaleString("en-US", { month: "long", year: "numeric" }),
};

// ─────────────────────────────────────────────────────────────────────────────
// The single line that changes the app's budget model.
export const activePolicy: BudgetPolicy = oneOffTotal;
// ─────────────────────────────────────────────────────────────────────────────

export type BudgetSummary = {
  totalCents: number;
  spentCents: number;
  remainingCents: number;
  periodLabel: string;
  policyName: string;
};

/** Either the normal client or a transaction handle — both work here. */
type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * `spent` and `remaining` are CALCULATED here, never stored in a column.
 * Derived from the orders themselves, they cannot drift out of sync with
 * reality. See architecture.md §3, "What the model deliberately does not store".
 */
export async function getBudgetSummary(
  userId: string,
  client: DbClient = db,
  now: Date = new Date(),
): Promise<BudgetSummary> {
  const user = await client.user.findUniqueOrThrow({
    where: { id: userId },
    select: { budgetCents: true },
  });

  const period = activePolicy.currentPeriod(now);
  const placedAt: Prisma.DateTimeNullableFilter = {};
  if (period.from) placedAt.gte = period.from;
  if (period.to) placedAt.lt = period.to;

  const spent = await client.order.aggregate({
    where: {
      userId,
      status: "PLACED",
      ...(period.from || period.to ? { placedAt } : {}),
    },
    _sum: { totalCents: true },
  });

  const totalCents = activePolicy.allocationCents(user);
  const spentCents = spent._sum.totalCents ?? 0;

  return {
    totalCents,
    spentCents,
    remainingCents: totalCents - spentCents,
    periodLabel: activePolicy.periodLabel(now),
    policyName: activePolicy.name,
  };
}
