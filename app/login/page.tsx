import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/session";

export default async function LoginPage() {
  // Already signed in? No reason to show the form.
  if (await getCurrentUser()) redirect("/catalogue");

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Furniture Buyer
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        Sign in to browse the catalogue and place orders against your budget.
      </p>

      <div className="mt-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <LoginForm />
      </div>

      <div className="mt-6 rounded-lg border border-stone-200 bg-stone-100 p-4 text-sm text-stone-600">
        <p className="font-medium text-stone-800">Demo logins</p>
        <ul className="mt-2 space-y-1">
          <li>
            <code>buyer@shop.test</code> — $50,000 budget
          </li>
          <li>
            <code>alex@shop.test</code> — $12,000 budget
          </li>
        </ul>
        <p className="mt-2">
          Password for both: <code>furniture123</code>
        </p>
      </div>
    </div>
  );
}
