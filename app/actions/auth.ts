"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";

export type LoginState = { error?: string };

/**
 * A hash of a throwaway string. When the email doesn't exist we still run a
 * password comparison against this, so a wrong email takes the same time as a
 * wrong password — otherwise the response time itself would leak which emails
 * are registered.
 */
const DUMMY_HASH =
  "$2b$10$/pBRV/Gnau91RsC54ouZseIBekSajfW0eDP29YTK0mtn1D96Rv54K";

export async function logIn(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Please enter both your email and your password." };
  }

  const user = await db.user.findUnique({ where: { email } });
  const passwordMatches = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_HASH,
  );

  // One message for both failures — never reveal whether the email exists (US-1).
  if (!user || !passwordMatches) {
    return { error: "Incorrect email or password." };
  }

  await createSession(user.id);
  redirect("/catalogue");
}

export async function logOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}
