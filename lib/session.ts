import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

/**
 * Login sessions, kept deliberately small (architecture.md ADR-2).
 *
 * On login we generate a long random token, save it in the Session table, and
 * hand the browser a matching cookie. Every request looks the token up to find
 * out who you are. No JWTs, no signing keys, no cryptography to get wrong.
 */
const COOKIE_NAME = "session";
const SESSION_DAYS = 7;

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({ data: { id: token, userId, expiresAt } });

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true, // page scripts cannot read it
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    secure: process.env.NODE_ENV === "production",
  });
}

/** The logged-in buyer, or null. Safe to call from any page. */
export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: token } }).catch(() => {});
    return null;
  }

  return session.user;
}

/**
 * The real route guard (requirement M2). Every protected page calls this.
 * A Server Component runs on the server, so this cannot be bypassed from the
 * browser — which is why we don't also need middleware.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await db.session.delete({ where: { id: token } }).catch(() => {});
  }
  jar.delete(COOKIE_NAME);
}
