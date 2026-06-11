import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, ensureSchema, schema } from "@/db";

const { matches, teams, seats, users } = schema;

export type BoardTeam = {
  name: string;
  code: string;
  flag: string;
  eliminated: boolean;
  owner: string | null;
};

export type BoardMatch = {
  id: string;
  group: string | null;
  kickoffUtc: Date;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homePens: number | null;
  awayPens: number | null;
  home: BoardTeam | null;
  away: BoardTeam | null;
};

export async function getBoardFixtures(): Promise<BoardMatch[]> {
  await ensureSchema();
  const home = alias(teams, "home");
  const away = alias(teams, "away");

  const rows = await db
    .select({
      id: matches.id,
      group: matches.groupLetter,
      kickoffUtc: matches.kickoffUtc,
      status: matches.status,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homePens: matches.homePens,
      awayPens: matches.awayPens,
      hId: home.id,
      hName: home.name,
      hCode: home.code,
      hFlag: home.flagEmoji,
      hElim: home.eliminated,
      aId: away.id,
      aName: away.name,
      aCode: away.code,
      aFlag: away.flagEmoji,
      aElim: away.eliminated,
    })
    .from(matches)
    .leftJoin(home, eq(home.id, matches.homeTeamId))
    .leftJoin(away, eq(away.id, matches.awayTeamId))
    .orderBy(asc(matches.kickoffUtc));

  const ownerRows = await db
    .select({ teamId: seats.teamId, owner: users.name })
    .from(seats)
    .innerJoin(users, eq(users.id, seats.userId));
  const ownerByTeam = new Map(ownerRows.map((r) => [r.teamId, r.owner]));

  return rows.map((r) => ({
    id: r.id,
    group: r.group,
    kickoffUtc: r.kickoffUtc,
    status: r.status,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    homePens: r.homePens,
    awayPens: r.awayPens,
    home: r.hId
      ? { name: r.hName!, code: r.hCode!, flag: r.hFlag ?? "", eliminated: r.hElim ?? false, owner: ownerByTeam.get(r.hId) ?? null }
      : null,
    away: r.aId
      ? { name: r.aName!, code: r.aCode!, flag: r.aFlag ?? "", eliminated: r.aElim ?? false, owner: ownerByTeam.get(r.aId) ?? null }
      : null,
  }));
}
