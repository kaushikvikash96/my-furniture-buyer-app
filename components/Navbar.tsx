import Link from "next/link";
import { logOut } from "@/app/actions/auth";

export function Navbar({ userName }: { userName: string }) {
  return (
    <header className="border-b border-stone-200 bg-stone-900 text-stone-100">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/catalogue" className="font-semibold tracking-tight">
          Furniture&nbsp;Buyer
        </Link>

        <div className="flex items-center gap-x-5 text-sm">
          <Link href="/catalogue" className="hover:text-white">
            Catalogue
          </Link>
          <Link href="/orders" className="hover:text-white">
            Past orders
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-x-4 text-sm">
          <span className="text-stone-400">{userName}</span>
          <form action={logOut}>
            <button
              type="submit"
              className="rounded border border-stone-600 px-3 py-1 hover:border-stone-400 hover:text-white"
            >
              Log out
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
