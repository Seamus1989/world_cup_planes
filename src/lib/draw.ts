import { eq } from "drizzle-orm";
import { db, ensureSchema, schema } from "@/db";

const { users, teams, seats, settings } = schema;

/** Fisher–Yates. Dev-grade randomness; swap for a committed seed/hash for "provably fair". */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

/**
 * Teams nobody draws (e.g. 15 players × cap 3 = 45, leaving 3) are owned by "The House"
 * so every team has an owner. Rename `name` to your chosen charity. Its seats are £0 stake,
 * so they don't inflate the prize pot.
 */
export const HOUSE_USER = { email: "house@gate-to-glory.local", name: "The House" };

async function ensureHouseUser(): Promise<string> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, HOUSE_USER.email))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(users)
    .values({ email: HOUSE_USER.email, name: HOUSE_USER.name, role: "PLAYER", status: "ACTIVE" })
    .returning({ id: users.id });
  return created!.id;
}

/**
 * Phase 1 — everyone gets one. Assigns one random team to each ACTIVE user who
 * doesn't already hold a primary seat. The assignment is written to the DB (the
 * "commit") before any reveal animation plays it back.
 */
export async function commitPrimaryDraw() {
  await ensureSchema();
  const [activeUsers, existingSeats, allTeams] = await Promise.all([
    db.select().from(users).where(eq(users.status, "ACTIVE")),
    db.select().from(seats),
    db.select().from(teams),
  ]);

  const usersWithPrimary = new Set(
    existingSeats.filter((s) => s.type === "PRIMARY").map((s) => s.userId),
  );
  const ownedTeamIds = new Set(existingSeats.map((s) => s.teamId));

  const drawUsers = shuffle(
    activeUsers.filter((u) => !usersWithPrimary.has(u.id) && u.email !== HOUSE_USER.email),
  );
  const available = shuffle(allTeams.filter((t) => !ownedTeamIds.has(t.id)));

  const startOrder =
    existingSeats.reduce((m, s) => Math.max(m, s.revealOrder ?? -1), -1) + 1;
  const n = Math.min(drawUsers.length, available.length);

  const newSeats = Array.from({ length: n }, (_, i) => ({
    userId: drawUsers[i]!.id,
    teamId: available[i]!.id,
    type: "PRIMARY" as const,
    revealOrder: startOrder + i,
  }));
  if (newSeats.length) await db.insert(seats).values(newSeats);

  await db
    .insert(settings)
    .values({ id: "singleton", drawCommittedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.id,
      set: { drawCommittedAt: new Date(), updatedAt: new Date() },
    });

  return { assigned: n, usersLeftOver: drawUsers.length - n, teamsLeftOver: available.length - n };
}

/**
 * Phase 2 — Standby. Distributes leftover teams as STANDBY seats (with an
 * overperformance multiplier) to ACTIVE users still under the seat cap.
 */
export async function openStandbyAndDraw(seatCap = 3, standbyMultiplier = 1.5) {
  await ensureSchema();
  const [existingSeats, allTeams, activeUsers] = await Promise.all([
    db.select().from(seats),
    db.select().from(teams),
    db.select().from(users).where(eq(users.status, "ACTIVE")),
  ]);

  const ownedTeamIds = new Set(existingSeats.map((s) => s.teamId));
  const seatCount = new Map<string, number>();
  for (const s of existingSeats) seatCount.set(s.userId, (seatCount.get(s.userId) ?? 0) + 1);

  const leftover = shuffle(allTeams.filter((t) => !ownedTeamIds.has(t.id)));
  let startOrder =
    existingSeats.reduce((m, s) => Math.max(m, s.revealOrder ?? -1), -1) + 1;

  const newSeats: {
    userId: string;
    teamId: string;
    type: "STANDBY";
    multiplier: number;
    revealOrder: number;
  }[] = [];

  for (const team of leftover) {
    const pool = shuffle(
      activeUsers.filter((u) => (seatCount.get(u.id) ?? 0) < seatCap && u.email !== HOUSE_USER.email),
    );
    if (pool.length === 0) break; // everyone is capped out
    const user = pool[0]!;
    newSeats.push({
      userId: user.id,
      teamId: team.id,
      type: "STANDBY",
      multiplier: standbyMultiplier,
      revealOrder: startOrder++,
    });
    seatCount.set(user.id, (seatCount.get(user.id) ?? 0) + 1);
  }
  if (newSeats.length) await db.insert(seats).values(newSeats);

  // Anything still unclaimed → The House, so all 48 teams have an owner.
  const claimed = new Set<string>([...ownedTeamIds, ...newSeats.map((s) => s.teamId)]);
  const orphans = allTeams.filter((t) => !claimed.has(t.id));
  if (orphans.length) {
    const houseId = await ensureHouseUser();
    await db.insert(seats).values(
      orphans.map((t, i) => ({
        userId: houseId,
        teamId: t.id,
        type: "STANDBY" as const,
        multiplier: 1,
        stakePennies: 0,
        revealOrder: startOrder + i,
      })),
    );
  }

  await db
    .insert(settings)
    .values({ id: "singleton", standbyOpen: true, standbyDrawCommittedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.id,
      set: { standbyOpen: true, standbyDrawCommittedAt: new Date(), updatedAt: new Date() },
    });

  return { standbyAssigned: newSeats.length, teamsStillFree: leftover.length - newSeats.length };
}

/** Dev helper — knock out k random surviving teams to test the CANCELLED state. */
export async function markRandomEliminations(k: number) {
  await ensureSchema();
  const alive = shuffle((await db.select().from(teams)).filter((t) => !t.eliminated));
  const toKill = alive.slice(0, k);
  for (const t of toKill) {
    await db
      .update(teams)
      .set({ eliminated: true, eliminatedAt: new Date(), exitStage: "GROUP" })
      .where(eq(teams.id, t.id));
  }
  return { eliminated: toKill.length };
}
