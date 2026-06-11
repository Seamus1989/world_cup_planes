import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, ensureSchema, schema } from "@/db";
import { auth } from "@/auth";

type User = typeof schema.users.$inferSelect;

/**
 * The active user. Prefers a real Auth.js (Google) session; falls back to the
 * dev "Login as" cookie so the /dev cockpit can still impersonate seeded users.
 */
const DEV_COOKIE = "gtg_dev_user";

async function byId(id: string): Promise<User | null> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return user ?? null;
}

export async function getCurrentUser(): Promise<User | null> {
  await ensureSchema();
  // Dev "Login as" impersonation is honoured LOCALLY ONLY — never in production.
  if (process.env.NODE_ENV !== "production") {
    const devId = (await cookies()).get(DEV_COOKIE)?.value;
    if (devId) {
      const u = await byId(devId);
      if (u) return u;
    }
  }
  const session = await auth();
  if (session?.user?.id) {
    const u = await byId(session.user.id);
    if (u) return u;
  }
  return null;
}

/** Guard for player-facing pages: must be signed in AND approved. */
export async function requireActive(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.status === "PENDING") redirect("/waiting");
  if (user.status === "DECLINED") redirect("/declined");
  return user;
}

/** Guard for admin pages. */
export async function requireAdmin(): Promise<User> {
  const user = await requireActive();
  if (user.role !== "ADMIN") redirect("/fixtures");
  return user;
}

/* --- dev impersonation (used by the /dev cockpit only) --- */
export async function loginAs(userId: string) {
  const store = await cookies();
  store.set(DEV_COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function logout() {
  (await cookies()).delete(DEV_COOKIE);
}
