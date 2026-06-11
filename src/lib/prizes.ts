import { eq } from "drizzle-orm";
import { db, ensureSchema, schema } from "@/db";

const { matchEvents, players, teams, seats, users } = schema;

export type PrizeRow = {
  player: string;
  team: string;
  flag: string;
  owner: string | null;
  value: number;
  sub?: string;
};

export type Prizes = {
  goldenBoot: PrizeRow[];
  playmaker: PrizeRow[];
  penalties: PrizeRow[];
  totalGoals: number;
};

export async function getPrizes(): Promise<Prizes> {
  await ensureSchema();
  const [evs, allPlayers, allTeams, ownerRows] = await Promise.all([
    db
      .select({
        type: matchEvents.type,
        playerId: matchEvents.playerId,
        playerName: matchEvents.playerName,
        assist: matchEvents.assistName,
        teamId: matchEvents.teamId,
      })
      .from(matchEvents),
    db.select({ id: players.id, name: players.name, teamId: players.teamId }).from(players),
    db.select().from(teams),
    db
      .select({ teamId: seats.teamId, owner: users.name })
      .from(seats)
      .innerJoin(users, eq(users.id, seats.userId))
      .where(eq(seats.type, "PRIMARY")),
  ]);

  const playerById = new Map(allPlayers.map((p) => [p.id, p]));
  const teamById = new Map(allTeams.map((t) => [t.id, t]));
  const ownerByTeam = new Map(ownerRows.map((r) => [r.teamId, r.owner]));

  type Agg = { name: string; teamId: string | null; goals: number; pens: number };
  const scorers = new Map<string, Agg>();
  const assists = new Map<string, { name: string; teamId: string | null; n: number }>();
  let totalGoals = 0;

  for (const e of evs) {
    if (e.type === "GOAL" || e.type === "PENALTY_GOAL") {
      const canonical = e.playerId ? playerById.get(e.playerId) : null;
      const name = canonical?.name ?? e.playerName;
      if (!name) continue;
      totalGoals++;
      const key = e.playerId ?? `n:${name.toLowerCase()}`;
      const teamId = canonical?.teamId ?? e.teamId;
      const a = scorers.get(key) ?? { name, teamId, goals: 0, pens: 0 };
      a.goals++;
      if (e.type === "PENALTY_GOAL") a.pens++;
      scorers.set(key, a);
    }
    if (e.assist) {
      const key = `a:${e.assist.toLowerCase()}`;
      const a = assists.get(key) ?? { name: e.assist, teamId: e.teamId, n: 0 };
      a.n++;
      assists.set(key, a);
    }
  }

  const row = (name: string, teamId: string | null, value: number, sub?: string): PrizeRow => {
    const t = teamId ? teamById.get(teamId) : null;
    return {
      player: name,
      team: t?.name ?? "—",
      flag: t?.flagEmoji ?? "",
      owner: teamId ? ownerByTeam.get(teamId) ?? null : null,
      value,
      sub,
    };
  };

  return {
    totalGoals,
    goldenBoot: [...scorers.values()]
      .map((s) => row(s.name, s.teamId, s.goals, s.pens ? `${s.pens} pen` : undefined))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    playmaker: [...assists.values()]
      .map((a) => row(a.name, a.teamId, a.n))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    penalties: [...scorers.values()]
      .filter((s) => s.pens > 0)
      .map((s) => row(s.name, s.teamId, s.pens))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
  };
}
