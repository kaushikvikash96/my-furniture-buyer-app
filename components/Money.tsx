import { formatCents } from "@/lib/money";

/** Renders whole cents as currency. The only way money reaches the screen. */
export function Money({
  cents,
  className,
}: {
  cents: number;
  className?: string;
}) {
  return (
    <span className={className}>{formatCents(cents)}</span>
  );
}
