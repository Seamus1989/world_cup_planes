import { asc, eq, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, ensureSchema, schema } from "@/db";

const { matches, teams, seats, users } = schema;

export type BracketTeam = { name: string; flag: string; owner: string | null; eliminated: boolean } | null;
export type BracketMatch = {
  id: string;
  stage: string;
  index: number;
  kickoffUtc: Date;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homePens: number | null;
  awayPens: number | null;
  winnerTeamId: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  home: BracketTeam;
  away: BracketTeam;
  homeLabel: string | null;
  awayLabel: string | null;
};

const STAGE_ORDER = ["R32", "R16", "QF", "SF", "FINAL", "THIRD"];
export const STAGE_NAMES: Record<string, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  FINAL: "Final",
  THIRD: "3rd place",
};

export async function getBracket(): Promise<{ stage: string; matches: BracketMatch[] }[]> {
  await ensureSchema();
  const home = alias(teams, "home");
  const away = alias(teams, "away");
  const [rows, ownerRows] = await Promise.all([
    db
      .select({
        id: matches.id,
        stage: matches.stage,
        index: matches.bracketIndex,
        kickoffUtc: matches.kickoffUtc,
        status: matches.status,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        homePens: matches.homePens,
        awayPens: matches.awayPens,
        winnerTeamId: matches.winnerTeamId,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        homeLabel: matches.homeLabel,
        awayLabel: matches.awayLabel,
        hId: home.id,
        hName: home.name,
        hFlag: home.flagEmoji,
        hElim: home.eliminated,
        aId: away.id,
        aName: away.name,
        aFlag: away.flagEmoji,
        aElim: away.eliminated,
      })
      .from(matches)
      .leftJoin(home, eq(home.id, matches.homeTeamId))
      .leftJoin(away, eq(away.id, matches.awayTeamId))
      .where(ne(matches.stage, "GROUP"))
      .orderBy(asc(matches.bracketIndex)),
    db
      .select({ teamId: seats.teamId, owner: users.name })
      .from(seats)
      .innerJoin(users, eq(users.id, seats.userId))
      .where(eq(seats.type, "PRIMARY")),
  ]);

  const ownerByTeam = new Map(ownerRows.map((r) => [r.teamId, r.owner]));
  const toTeam = (id: string | null, name: string | null, flag: string | null, elim: boolean | null): BracketTeam =>
    id ? { name: name ?? "?", flag: flag ?? "", owner: ownerByTeam.get(id) ?? null, eliminated: elim ?? false } : null;

  const all: BracketMatch[] = rows.map((r) => ({
    id: r.id,
    stage: r.stage,
    index: r.index ?? 0,
    kickoffUtc: r.kickoffUtc,
    status: r.status,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    homePens: r.homePens,
    awayPens: r.awayPens,
    winnerTeamId: r.winnerTeamId,
    homeTeamId: r.homeTeamId,
    awayTeamId: r.awayTeamId,
    homeLabel: r.homeLabel,
    awayLabel: r.awayLabel,
    home: toTeam(r.hId, r.hName, r.hFlag, r.hElim),
    away: toTeam(r.aId, r.aName, r.aFlag, r.aElim),
  }));

  return STAGE_ORDER.map((stage) => ({
    stage,
    matches: all.filter((m) => m.stage === stage).sort((a, b) => a.index - b.index),
  })).filter((s) => s.matches.length > 0);
}
