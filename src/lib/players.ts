import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

const { players } = schema;

export function normalizeName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.'`’]/g, "");
}

/**
 * Find-or-create the one canonical player for a team, keyed by normalised name.
 * Returns the playerId so goal events link to a real player (no duplicate "Harry Kane"s).
 */
export async function resolvePlayer(teamId: string | null, name: string | null): Promise<string | null> {
  if (!teamId || !name) return null;
  const n = normalizeName(name);
  if (!n) return null;
  await db.insert(players).values({ teamId, name: name.trim(), normalizedName: n }).onConflictDoNothing();
  const [p] = await db
    .select({ id: players.id })
    .from(players)
    .where(and(eq(players.teamId, teamId), eq(players.normalizedName, n)))
    .limit(1);
  return p?.id ?? null;
}
