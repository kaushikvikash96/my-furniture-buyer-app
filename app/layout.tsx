import type { Metadata } from "next";
import "./globals.css";
import { BalanceBar } from "@/components/BalanceBar";
import { Navbar } from "@/components/Navbar";
import { cognitivoUserId, fetchUserBalance } from "@/lib/cognitivo";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Furniture Buyer",
  description: "Browse the catalogue and buy against your real balance.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The nav and balance bar appear on every logged-in page (requirement 1),
  // so they're loaded once here rather than repeated in each page. This runs
  // on every page in the app, so a shop-API hiccup here must not crash the
  // whole shell (requirement 3) — same "show a message, don't throw" rule as
  // the catalogue page.
  const user = await getCurrentUser();
  let balance = null;
  let balanceError = false;
  if (user) {
    try {
      balance = await fetchUserBalance(cognitivoUserId());
    } catch {
      balanceError = true;
    }
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        {user && (
          <>
            <Navbar userName={user.name} />
            {balance && <BalanceBar balance={balance} />}
            {balanceError && (
              <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-800">
                Couldn&apos;t reach the shop&apos;s balance service right now.
              </p>
            )}
          </>
        )}
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
