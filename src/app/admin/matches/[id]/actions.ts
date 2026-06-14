"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, ensureSchema, schema } from "@/db";
import { extractMatchFromUrl, searchMatchResult, type MatchExtract } from "@/lib/extract";
import { resolvePlayer } from "@/lib/players";
import { requireAdmin } from "@/lib/session";

const { matches, matchEvents, teams } = schema;

export type DraftEvent = {
  team: "HOME" | "AWAY";
  type: string;
  player: string;
  assist: string | null;
  minute: number | null;
};

/** Fetch the URL + AI-extract a structured draft. Does NOT save. */
export async function runExtract(matchId: string, url: string): Promise<MatchExtract> {
  await requireAdmin();
  await ensureSchema();
  const home = alias(teams, "home");
  const away = alias(teams, "away");
  const [m] = await db
    .select({ homeName: home.name, awayName: away.name })
    .from(matches)
    .leftJoin(home, eq(home.id, matches.homeTeamId))
    .leftJoin(away, eq(away.id, matches.awayTeamId))
    .where(eq(matches.id, matchId))
    .limit(1);

  const empty: MatchExtract = {
    found: false,
    homeScore: null,
    awayScore: null,
    status: "SCHEDULED",
    events: [],
    shootout: null,
    summary: "",
    sourceUrl: url,
  };
  if (!m) return { ...empty, error: "Match not found" };
  try {
    return await extractMatchFromUrl({
      url,
      homeTeam: m.homeName ?? "Home",
      awayTeam: m.awayName ?? "Away",
    });
  } catch (e) {
    return { ...empty, error: (e as Error).message };
  }
}

/** Live web-search the result via Sonar — no URL needed, uses the fixture's teams + date. Does NOT save. */
export async function searchResult(matchId: string): Promise<MatchExtract> {
  await requireAdmin();
  await ensureSchema();
  const home = alias(teams, "home");
  const away = alias(teams, "away");
  const [m] = await db
    .select({ homeName: home.name, awayName: away.name, kickoff: matches.kickoffUtc })
    .from(matches)
    .leftJoin(home, eq(home.id, matches.homeTeamId))
    .leftJoin(away, eq(away.id, matches.awayTeamId))
    .where(eq(matches.id, matchId))
    .limit(1);

  const empty: MatchExtract = {
    found: false,
    homeScore: null,
    awayScore: null,
    status: "SCHEDULED",
    events: [],
    shootout: null,
    summary: "",
    sourceUrl: "web-search",
  };
  if (!m) return { ...empty, error: "Match not found" };
  if (!m.homeName || !m.awayName) {
    return { ...empty, error: "Both teams must be set before searching (knockout slots may still be TBD)." };
  }
  try {
    return await searchMatchResult({
      homeTeam: m.homeName,
      awayTeam: m.awayName,
      dateISO: m.kickoff ? m.kickoff.toISOString().slice(0, 10) : undefined,
    });
  } catch (e) {
    return { ...empty, error: (e as Error).message };
  }
}

function periodFor(minute: number | null) {
  if (minute == null) return null;
  if (minute <= 45) return "FIRST_HALF" as const;
  if (minute <= 90) return "SECOND_HALF" as const;
  if (minute <= 105) return "ET1" as const;
  return "ET2" as const;
}

const NEXT_STAGE: Record<string, string> = { R32: "R16", R16: "QF", QF: "SF" };

async function setSlot(stage: string, idx: number, home: boolean, teamId: string) {
  const [t] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.stage, stage as typeof matches.$inferSelect.stage), eq(matches.bracketIndex, idx)))
    .limit(1);
  if (!t) return;
  await db.update(matches).set(home ? { homeTeamId: teamId } : { awayTeamId: teamId }).where(eq(matches.id, t.id));
}

/** Feed the winner (and SF loser → 3rd place) into the next round's slot. */
async function advanceKnockout(
  m: { stage: string; bracketIndex: number | null; homeTeamId: string | null; awayTeamId: string | null },
  winnerTeamId: string,
) {
  if (m.stage === "GROUP" || m.bracketIndex == null) return;
  const i = m.bracketIndex;
  const loser = winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
  const next = NEXT_STAGE[m.stage];
  if (next) {
    await setSlot(next, Math.ceil(i / 2), i % 2 === 1, winnerTeamId);
  } else if (m.stage === "SF") {
    await setSlot("FINAL", 1, i === 1, winnerTeamId);
    if (loser) await setSlot("THIRD", 1, i === 1, loser);
  }
}

export async function saveMatch(
  matchId: string,
  payload: {
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    sourceUrl?: string;
    homeTeamId?: string | null;
    awayTeamId?: string | null;
    homePens?: number | null;
    awayPens?: number | null;
    events: DraftEvent[];
  },
) {
  await requireAdmin();
  await ensureSchema();
  const [m] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!m) return { ok: false as const };

  const homeTeamId = payload.homeTeamId !== undefined ? payload.homeTeamId : m.homeTeamId;
  const awayTeamId = payload.awayTeamId !== undefined ? payload.awayTeamId : m.awayTeamId;
  const finished = payload.status === "FINISHED";
  const isKnockout = m.stage !== "GROUP";
  const hs = payload.homeScore;
  const as = payload.awayScore;
  const hp = payload.homePens ?? null;
  const ap = payload.awayPens ?? null;

  // Winner = higher score; if a knockout is level, the penalty SHOOTOUT decides it.
  // The shootout never changes the scoreline (it stays a draw) and never counts as goals.
  let winnerTeamId: string | null = null;
  if (finished && hs != null && as != null) {
    if (hs > as) winnerTeamId = homeTeamId;
    else if (as > hs) winnerTeamId = awayTeamId;
    else if (isKnockout && hp != null && ap != null && hp !== ap) winnerTeamId = hp > ap ? homeTeamId : awayTeamId;
  }

  await db
    .update(matches)
    .set({
      homeTeamId,
      awayTeamId,
      homeScore: hs,
      awayScore: as,
      homePens: isKnockout ? hp : null,
      awayPens: isKnockout ? ap : null,
      status: finished ? "FINISHED" : payload.status === "LIVE" ? "LIVE" : "SCHEDULED",
      winnerTeamId,
    })
    .where(eq(matches.id, matchId));

  await db.delete(matchEvents).where(eq(matchEvents.matchId, matchId));
  const rows = await Promise.all(
    payload.events
      .filter((e) => e.player.trim() || e.type)
      .map(async (e) => {
        const teamId = e.team === "HOME" ? homeTeamId : awayTeamId;
        return {
          matchId,
          teamId,
          playerId: await resolvePlayer(teamId, e.player),
          playerName: e.player.trim() || null,
          assistName: e.assist?.trim() || null,
          type: e.type as typeof matchEvents.$inferInsert.type,
          minute: e.minute ?? null,
          period: periodFor(e.minute),
          source: payload.sourceUrl ?? null,
        };
      }),
  );
  if (rows.length) await db.insert(matchEvents).values(rows);

  if (finished && winnerTeamId && m.stage !== "GROUP") {
    await advanceKnockout({ stage: m.stage, bracketIndex: m.bracketIndex, homeTeamId, awayTeamId }, winnerTeamId);
  }

  revalidatePath("/admin/matches");
  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath("/fixtures");
  revalidatePath("/knockout");
  return { ok: true as const, saved: rows.length };
}
