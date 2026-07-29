// Money is stored everywhere as whole cents (integers) — see architecture.md ADR-3.
// This file is the ONLY place cents turn into something a human reads.

export const CURRENCY = "USD";
export const LOCALE = "en-US";

/** 129900 -> "$1,299.00" */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
  }).format(cents / 100);
}
