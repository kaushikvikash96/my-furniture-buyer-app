import type { Metadata } from "next";
import "./globals.css";
import { BudgetBar } from "@/components/BudgetBar";
import { Navbar } from "@/components/Navbar";
import { getBudgetSummary } from "@/lib/budget";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Furniture Buyer",
  description: "Browse the catalogue and order against your budget.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The nav and budget bar appear on every logged-in page (M5), so they're
  // loaded once here rather than repeated in each page.
  const user = await getCurrentUser();

  const [budget, draftItemCount] = user
    ? await Promise.all([
        getBudgetSummary(user.id),
        db.orderItem.count({
          where: { order: { userId: user.id, status: "DRAFT" } },
        }),
      ])
    : [null, 0];

  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        {user && (
          <>
            <Navbar userName={user.name} draftItemCount={draftItemCount} />
            {budget && <BudgetBar summary={budget} />}
          </>
        )}
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
