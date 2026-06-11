import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { rawDb, schema } from "@/db";

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const isAdmin = (email?: string | null) => !!email && adminEmails.includes(email.toLowerCase());

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(rawDb(), {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers: [Google],
  session: { strategy: "database" },
  trustHost: true,
  callbacks: {
    // Every sign-in: make sure configured admins are promoted + active.
    async signIn({ user }) {
      if (isAdmin(user.email)) {
        await rawDb()
          .update(schema.users)
          .set({ role: "ADMIN", status: "ACTIVE" })
          .where(eq(schema.users.email, user.email!));
      }
      return true;
    },
    // Expose the user id on the session so getCurrentUser can load the full row.
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  events: {
    // First-time admin sign-in: the row is freshly created here, promote it.
    async createUser({ user }) {
      if (user.id && isAdmin(user.email)) {
        await rawDb()
          .update(schema.users)
          .set({ role: "ADMIN", status: "ACTIVE" })
          .where(eq(schema.users.id, user.id));
      }
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
