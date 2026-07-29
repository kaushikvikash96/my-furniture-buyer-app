import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

/** "/" sends you to the catalogue if you're logged in, or the login page if not. */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/catalogue" : "/login");
}
