import { eq } from "drizzle-orm";
import { db, ensureSchema, schema } from "@/db";

const { matches, matchEvents, players, teams, seats, users } = schema;

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
  conceded: PrizeRow[]; // Welcome Aboard — most goals conceded
  defence: PrizeRow[]; // Border Control — fewest conceded per game played
  zinedine: PrizeRow[]; // The Zinedine — most yellow/red cards
  ownGoals: PrizeRow[]; // Friendly Fire — most own goals (attributed to the culprit's team)
  totalGoals: number;
};

export async function getPrizes(): Promise<Prizes> {
  await ensureSchema();
  const [evs, allPlayers, allTeams, ownerRows, finishedMatches] = await Promise.all([
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
      .innerJoin(users, eq(users.id, seats.userId)),
    db
      .select({
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
      })
      .from(matches)
      .where(eq(matches.status, "FINISHED")),
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

  // The Zinedine — most cards (yellow + red), by team
  const cardTally = new Map<string, { y: number; r: number }>();
  for (const e of evs) {
    if ((e.type !== "YELLOW" && e.type !== "RED") || !e.teamId) continue;
    const c = cardTally.get(e.teamId) ?? { y: 0, r: 0 };
    if (e.type === "YELLOW") c.y++;
    else c.r++;
    cardTally.set(e.teamId, c);
  }
  // Own goals (Friendly Fire) — the event's teamId is the CULPRIT's team
  const ownGoalTally = new Map<string, number>();
  for (const e of evs) {
    if (e.type !== "OWN_GOAL" || !e.teamId) continue;
    ownGoalTally.set(e.teamId, (ownGoalTally.get(e.teamId) ?? 0) + 1);
  }
  // Goals conceded per team (Welcome Aboard = most; Border Control = fewest per game)
  const concededTally = new Map<string, { against: number; games: number }>();
  for (const m of finishedMatches) {
    if (!m.homeTeamId || !m.awayTeamId || m.homeScore == null || m.awayScore == null) continue;
    const h = concededTally.get(m.homeTeamId) ?? { against: 0, games: 0 };
    h.against += m.awayScore;
    h.games++;
    concededTally.set(m.homeTeamId, h);
    const a = concededTally.get(m.awayTeamId) ?? { against: 0, games: 0 };
    a.against += m.homeScore;
    a.games++;
    concededTally.set(m.awayTeamId, a);
  }
  const teamRow = (teamId: string, value: number, sub?: string): PrizeRow => {
    const t = teamById.get(teamId);
    return {
      player: t?.name ?? "—",
      team: t?.groupLetter ? `Group ${t.groupLetter}` : "—",
      flag: t?.flagEmoji ?? "",
      owner: ownerByTeam.get(teamId) ?? null,
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
      .slice(0, 10),
    conceded: [...concededTally.entries()]
      .map(([id, c]) => teamRow(id, c.against, `in ${c.games} ${c.games === 1 ? "game" : "games"}`))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    defence: [...concededTally.entries()]
      .filter(([, c]) => c.games > 0)
      .map(([id, c]) => teamRow(id, Math.round((c.against / c.games) * 100) / 100, `${c.against} in ${c.games}`))
      .sort((a, b) => a.value - b.value)
      .slice(0, 10),
    zinedine: [...cardTally.entries()]
      .map(([id, c]) => {
        const games = concededTally.get(id)?.games ?? 0;
        const perGame = games > 0 ? Math.round(((c.y + c.r * 2) / games) * 100) / 100 : 0;
        return teamRow(id, perGame, `${c.y}Y ${c.r}R in ${games}`);
      })
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    ownGoals: [...ownGoalTally.entries()]
      .map(([id, n]) => teamRow(id, n))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
  };
}

/* ------------------------------------------------------------------ */
/* Prize money — the pot split. Edit to taste; shown in the UI.        */
/* ------------------------------------------------------------------ */

export const PRIZES = {
  champion: 40,
  runnerUp: 20,
  third: 10,
  fourth: 5,
  // Booby prizes pay £10, "good team" quests £5 — the good teams are probably
  // cashing the main pot anyway.
  conceded: 10, // Welcome Aboard — most goals conceded
  zinedine: 10, // The Zinedine — most cards
  ownGoals: 10, // Friendly Fire — most own goals
  defence: 5, // Border Control — fewest conceded per game played
  goldenBoot: 5,
  playmaker: 5,
} as const;

export const PRIZE_TOTAL = Object.values(PRIZES).reduce((a, b) => a + b, 0); // £120

export type Finisher = { team: string; flag: string; owner: string | null } | null;

/** Champion / runner-up / 3rd / 4th owners, from the Final + 3rd-place play-off (once played). */
export async function getMainPrizes(): Promise<{
  champion: Finisher;
  runnerUp: Finisher;
  third: Finisher;
  fourth: Finisher;
}> {
  await ensureSchema();
  const [finalRows, thirdRows, allTeams, ownerRows] = await Promise.all([
    db.select().from(matches).where(eq(matches.stage, "FINAL")).limit(1),
    db.select().from(matches).where(eq(matches.stage, "THIRD")).limit(1),
    db.select().from(teams),
    db.select({ teamId: seats.teamId, owner: users.name }).from(seats).innerJoin(users, eq(users.id, seats.userId)),
  ]);
  const teamById = new Map(allTeams.map((t) => [t.id, t]));
  const ownerByTeam = new Map(ownerRows.map((r) => [r.teamId, r.owner]));
  const slot = (teamId: string | null | undefined): Finisher => {
    if (!teamId) return null;
    const t = teamById.get(teamId);
    return t ? { team: t.name, flag: t.flagEmoji ?? "", owner: ownerByTeam.get(teamId) ?? null } : null;
  };
  const done = (m?: typeof matches.$inferSelect) =>
    m && m.status === "FINISHED" && m.winnerTeamId ? m : null;
  const f = done(finalRows[0]);
  const t = done(thirdRows[0]);
  return {
    champion: f ? slot(f.winnerTeamId) : null,
    runnerUp: f ? slot(f.winnerTeamId === f.homeTeamId ? f.awayTeamId : f.homeTeamId) : null,
    third: t ? slot(t.winnerTeamId) : null,
    fourth: t ? slot(t.winnerTeamId === t.homeTeamId ? t.awayTeamId : t.homeTeamId) : null,
  };
}
