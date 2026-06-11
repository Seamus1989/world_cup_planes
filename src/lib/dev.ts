import { and, asc, count, eq, ne } from "drizzle-orm";
import { db, ensureSchema, schema } from "@/db";
import { SEED_TEAMS } from "@/db/seed-data";
import { GROUP_SCHEDULE, KNOCKOUT_SCHEDULE, kickoffUtc } from "@/db/schedule-2026";
import { getStandings } from "./standings";

const {
  users,
  teams,
  seats,
  settings,
  matches,
  matchEvents,
  players,
  predictions,
  sessions,
  accounts,
} = schema;

const FIRST = [
  "Alex", "Sam", "Jordan", "Priya", "Marcus", "Chloe", "Dev", "Niamh", "Tom", "Ava",
  "Liam", "Zoe", "Ravi", "Ella", "Jack", "Mia", "Omar", "Freya", "Noah", "Isla",
  "Leo", "Aoife", "Ben", "Sofia", "Kai", "Holly", "Reece", "Maya", "Finn", "Lucy",
  "Theo", "Nina", "Cole", "Ruby", "Seb", "Effy",
];
const LAST = [
  "Hunt", "Patel", "Okafor", "Nguyen", "Walsh", "Reid", "Mensah", "Kovac", "Silva",
  "Byrne", "Khan", "Rossi", "Ahmed", "Murphy", "Clarke", "Dubois", "Haddad",
  "Lindqvist", "Owusu", "Costa", "Vidal", "Park", "Nowak", "Ferreira",
];

const SCORERS = [
  "Okafor", "Silva", "Haaland", "Mbappé", "Kane", "Vinícius", "Bellingham", "Saka",
  "Olmo", "Musiala", "Ødegaard", "Pulisic", "Mendes", "Tanaka", "Hakimi", "Nakamura",
  "Núñez", "Gakpo", "Osimhen", "Lautaro",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function avatar(seed: string) {
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;
}

export async function ensureSettings() {
  await db.insert(settings).values({ id: "singleton" }).onConflictDoNothing();
}

export async function seedTeams() {
  await ensureSchema();
  const rows = await db.select({ c: count() }).from(teams);
  if (Number(rows[0]?.c ?? 0) > 0) return { inserted: 0, skipped: true as const };
  await db.insert(teams).values(SEED_TEAMS);
  await ensureSettings();
  return { inserted: SEED_TEAMS.length, skipped: false as const };
}

export async function seedRandomUsers(n: number) {
  await ensureSchema();
  await ensureSettings();
  const rows = Array.from({ length: n }, (_, i) => {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    return {
      name,
      email: `${name.replace(/\s+/g, ".").toLowerCase()}.${i}@planes.dev`,
      image: avatar(name + i),
      role: "PLAYER" as const,
      status: "ACTIVE" as const,
    };
  });
  await db.insert(users).values(rows).onConflictDoNothing();
  // a couple of PENDING users to exercise the approval queue later
  await db
    .insert(users)
    .values([
      { name: "Pending Pat", email: "pending.pat@planes.dev", status: "PENDING", role: "PLAYER" },
      { name: "Waiting Wendy", email: "waiting.wendy@planes.dev", status: "PENDING", role: "PLAYER" },
    ])
    .onConflictDoNothing();
  // the admin
  await db
    .insert(users)
    .values({
      name: "Seamus",
      email: "seamus@planes.agency",
      role: "ADMIN",
      status: "ACTIVE",
      image: avatar("seamus"),
    })
    .onConflictDoNothing();
  return { inserted: rows.length };
}

/** Seed the 72 group-stage fixtures (round-robin per group). Kickoff times are
 *  plausible UK-evening slots — sync to the official schedule later. */
export async function seedFixtures() {
  await ensureSchema();
  const existing = await db.select({ c: count() }).from(matches).where(eq(matches.stage, "GROUP"));
  if (Number(existing[0]?.c ?? 0) > 0) return { inserted: 0, skipped: true as const };

  const allTeams = await db.select().from(teams);
  const idByCode = new Map(allTeams.map((t) => [t.code, t.id]));

  // Real 2026 group schedule — actual matchups, dates, UK kick-off times + venues.
  const rows: (typeof matches.$inferInsert)[] = GROUP_SCHEDULE.map(
    ([group, home, away, date, uk, city], i) => ({
      stage: "GROUP",
      groupLetter: group,
      matchNumber: i + 1,
      homeTeamId: idByCode.get(home) ?? null,
      awayTeamId: idByCode.get(away) ?? null,
      kickoffUtc: kickoffUtc(date, uk),
      city,
      status: "SCHEDULED",
    }),
  );
  await db.insert(matches).values(rows);
  return { inserted: rows.length, skipped: false as const };
}

/** Dev helper — play out the next k scheduled GROUP fixtures with random scorelines + goal events. */
export async function simulateResults(k: number) {
  await ensureSchema();
  const scheduled = (
    await db
      .select()
      .from(matches)
      .where(and(eq(matches.status, "SCHEDULED"), eq(matches.stage, "GROUP")))
      .orderBy(asc(matches.kickoffUtc))
  ).slice(0, k);

  for (const m of scheduled) {
    const hs = Math.floor(Math.random() * 4);
    const as = Math.floor(Math.random() * 4);
    const winnerTeamId = hs > as ? m.homeTeamId : as > hs ? m.awayTeamId : null;
    await db
      .update(matches)
      .set({ status: "FINISHED", homeScore: hs, awayScore: as, winnerTeamId })
      .where(eq(matches.id, m.id));

    const events: (typeof matchEvents.$inferInsert)[] = [];
    const addGoals = (teamId: string | null, n: number) => {
      for (let i = 0; i < n; i++) {
        const pen = Math.random() < 0.15;
        events.push({
          matchId: m.id,
          teamId,
          type: pen ? "PENALTY_GOAL" : "GOAL",
          playerName: pick(SCORERS),
          assistName: !pen && Math.random() < 0.5 ? pick(SCORERS) : null,
          minute: 1 + Math.floor(Math.random() * 90),
        });
      }
    };
    addGoals(m.homeTeamId, hs);
    addGoals(m.awayTeamId, as);
    await db.delete(matchEvents).where(eq(matchEvents.matchId, m.id));
    if (events.length) await db.insert(matchEvents).values(events);
  }
  return { played: scheduled.length };
}

/** Seed the empty knockout bracket (R32 → Final) with slot labels + dates. Teams filled later. */
export async function seedKnockout() {
  await ensureSchema();
  const existing = await db.select({ c: count() }).from(matches).where(ne(matches.stage, "GROUP"));
  if (Number(existing[0]?.c ?? 0) > 0) return { inserted: 0, skipped: true as const };

  const labels = (stage: string, i: number): [string, string] => {
    switch (stage) {
      case "R16": return [`Winner R32-${2 * i - 1}`, `Winner R32-${2 * i}`];
      case "QF": return [`Winner R16-${2 * i - 1}`, `Winner R16-${2 * i}`];
      case "SF": return [`Winner QF-${2 * i - 1}`, `Winner QF-${2 * i}`];
      case "THIRD": return ["Loser SF-1", "Loser SF-2"];
      case "FINAL": return ["Winner SF-1", "Winner SF-2"];
      default: return ["TBD", "TBD"];
    }
  };

  // Real 2026 knockout dates, UK kick-off times + venues. bracketIndex/labels keep the
  // existing adjacency advancement (R32 i → R16 ⌈i/2⌉, …); team-filling happens later.
  const rows: (typeof matches.$inferInsert)[] = KNOCKOUT_SCHEDULE.map(([stage, idx, date, uk, city], i) => {
    const [hl, al] = labels(stage, idx);
    return {
      stage: stage as typeof matches.$inferInsert.stage,
      bracketIndex: idx,
      matchNumber: 73 + i,
      homeLabel: hl,
      awayLabel: al,
      kickoffUtc: kickoffUtc(date, uk),
      city,
      status: "SCHEDULED",
    };
  });

  await db.insert(matches).values(rows);
  return { inserted: rows.length, skipped: false as const };
}

/** Suggest R32 qualifiers from current standings (top 2 + best 8 thirds). A starting point; admin adjusts. */
export async function autofillR32() {
  await ensureSchema();
  const [tables, allTeams, ko] = await Promise.all([
    getStandings(),
    db.select().from(teams),
    db.select().from(matches).where(eq(matches.stage, "R32")),
  ]);
  if (ko.length === 0) return { filled: 0, note: "seed knockout first" as const };

  const idByCode = new Map(allTeams.map((t) => [t.code, t.id]));
  const winners = [], runners = [], thirds = [];
  for (const g of tables) {
    if (g.rows[0]) winners.push(g.rows[0]);
    if (g.rows[1]) runners.push(g.rows[1]);
    if (g.rows[2]) thirds.push(g.rows[2]);
  }
  thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  const q = [...winners, ...runners, ...thirds.slice(0, 8)];
  const n = q.length;
  const koByIdx = new Map(ko.map((m) => [m.bracketIndex ?? 0, m]));
  let filled = 0;
  for (let k = 1; k <= 16; k++) {
    const m = koByIdx.get(k);
    if (!m) continue;
    const home = q[k - 1];
    const away = q[n - k];
    const homeId = home ? idByCode.get(home.code) ?? null : null;
    const awayId = away && away !== home ? idByCode.get(away.code) ?? null : null;
    await db.update(matches).set({ homeTeamId: homeId, awayTeamId: awayId }).where(eq(matches.id, m.id));
    if (homeId || awayId) filled++;
  }
  return { filled };
}

export async function resetAll() {
  await ensureSchema();
  // delete in FK-safe order
  await db.delete(seats);
  await db.delete(matchEvents);
  await db.delete(predictions);
  await db.delete(matches);
  await db.delete(players);
  await db.delete(teams);
  await db.delete(sessions);
  await db.delete(accounts);
  await db.delete(users);
  await db.delete(settings);
}

export async function getStateSummary() {
  await ensureSchema();
  const [allUsers, allTeams, allSeats, cfgRows] = await Promise.all([
    db.select().from(users),
    db.select().from(teams),
    db.select().from(seats),
    db.select().from(settings).limit(1),
  ]);
  const cfg = cfgRows[0];

  const ownedTeamIds = new Set(allSeats.map((s) => s.teamId));
  const teamById = new Map(allTeams.map((t) => [t.id, t]));

  const roster = allUsers
    .map((u) => {
      const mine = allSeats.filter((s) => s.userId === u.id);
      return {
        id: u.id,
        name: u.name ?? u.email,
        role: u.role,
        status: u.status,
        image: u.image,
        teams: mine.map((s) => {
          const t = teamById.get(s.teamId);
          return {
            name: t?.name ?? "?",
            flag: t?.flagEmoji ?? "",
            type: s.type,
            paid: s.paymentStatus === "PAID",
            eliminated: t?.eliminated ?? false,
            multiplier: s.multiplier,
          };
        }),
      };
    })
    .sort((a, b) => b.teams.length - a.teams.length || a.name.localeCompare(b.name));

  return {
    counts: {
      users: allUsers.length,
      active: allUsers.filter((u) => u.status === "ACTIVE").length,
      pending: allUsers.filter((u) => u.status === "PENDING").length,
      teams: allTeams.length,
      teamsAvailable: allTeams.filter((t) => !ownedTeamIds.has(t.id)).length,
      teamsEliminated: allTeams.filter((t) => t.eliminated).length,
      seats: allSeats.length,
      primarySeats: allSeats.filter((s) => s.type === "PRIMARY").length,
      standbySeats: allSeats.filter((s) => s.type === "STANDBY").length,
      paidSeats: allSeats.filter((s) => (s.stakePennies ?? 0) > 0).length,
      potGbp: allSeats.reduce((sum, s) => sum + (s.stakePennies ?? 0), 0) / 100,
    },
    drawCommittedAt: cfg?.drawCommittedAt ?? null,
    standbyOpen: cfg?.standbyOpen ?? false,
    roster,
  };
}
