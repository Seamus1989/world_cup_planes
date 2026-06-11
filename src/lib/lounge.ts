import { eq } from "drizzle-orm";
import { db, ensureSchema, schema } from "@/db";
import { getBoardFixtures } from "./board";

const { seats, teams } = schema;

export type LoungeFixture = {
  when: Date;
  status: string;
  oppName: string;
  oppFlag: string;
  oppOwner: string | null;
  forScore: number | null;
  oppScore: number | null;
  outcome: "W" | "D" | "L" | null;
};

export type LoungeTeam = {
  name: string;
  code: string;
  flag: string;
  group: string | null;
  eliminated: boolean;
  type: string;
  multiplier: number;
  fixtures: LoungeFixture[];
};

export async function getLoungeData(userId: string) {
  await ensureSchema();
  const mine = await db
    .select({
      code: teams.code,
      name: teams.name,
      flag: teams.flagEmoji,
      group: teams.groupLetter,
      eliminated: teams.eliminated,
      type: seats.type,
      multiplier: seats.multiplier,
    })
    .from(seats)
    .innerJoin(teams, eq(teams.id, seats.teamId))
    .where(eq(seats.userId, userId));

  const all = await getBoardFixtures();

  const teamsOut: LoungeTeam[] = mine.map((t) => {
    const fixtures = all
      .filter((m) => m.home?.code === t.code || m.away?.code === t.code)
      .map((m): LoungeFixture => {
        const isHome = m.home?.code === t.code;
        const opp = isHome ? m.away : m.home;
        const forScore = isHome ? m.homeScore : m.awayScore;
        const oppScore = isHome ? m.awayScore : m.homeScore;
        let outcome: "W" | "D" | "L" | null = null;
        if (m.status === "FINISHED" && forScore != null && oppScore != null) {
          outcome = forScore > oppScore ? "W" : forScore < oppScore ? "L" : "D";
        }
        return {
          when: m.kickoffUtc,
          status: m.status,
          oppName: opp?.name ?? "TBD",
          oppFlag: opp?.flag ?? "",
          oppOwner: opp?.owner ?? null,
          forScore,
          oppScore,
          outcome,
        };
      });
    return {
      name: t.name,
      code: t.code,
      flag: t.flag ?? "",
      group: t.group,
      eliminated: t.eliminated,
      type: t.type,
      multiplier: t.multiplier,
      fixtures,
    };
  });

  teamsOut.sort((a, b) => (a.type === "PRIMARY" ? 0 : 1) - (b.type === "PRIMARY" ? 0 : 1));
  const alive = teamsOut.filter((t) => !t.eliminated).length;
  return { teams: teamsOut, alive, total: teamsOut.length };
}
