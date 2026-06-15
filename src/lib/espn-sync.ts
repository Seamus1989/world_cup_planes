/**
 * Sync real results from ESPN into our DB — the reliable replacement for the AI extractor.
 *
 *  - Matches ESPN games to our fixtures by the (unordered) team pair + nearest kickoff, so it
 *    works regardless of which side ESPN calls "home" (irrelevant in a World Cup anyway).
 *  - Writes the score, winner, shootout pens, and the goal/card/own-goal events.
 *  - `dryRun: true` does ALL the fetching + matching + diffing but writes NOTHING — point it at
 *    a clone of prod to see exactly what would change before committing.
 *  - Idempotent: re-running re-matches the same rows and replaces their events.
 *
 * Group stage is fully handled today. Knockout matching works once a fixture's two teams are
 * assigned (via the bracket); knockout progression is wired separately — see syncFromEspn notes.
 */
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, ensureSchema, schema } from "@/db";
import { resolvePlayer } from "./players";
import { recomputeEliminations } from "./play";
import { fetchEspnMatches, type EspnMatch } from "./espn";

const { matches, matchEvents, teams } = schema;

export type SyncChange = {
  espnId: string;
  fixture: string; // "MEX 2–0 RSA"
  before: string; // "— · SCHEDULED"
  after: string; // "2–0 · FINISHED · W:MEX"
  events: number;
  applied: boolean;
};

export type SyncReport = {
  dryRun: boolean;
  espnFinished: number;
  matched: number;
  changed: number;
  unchanged: number;
  unmatched: { fixture: string; espnId: string; reason: string }[];
  changes: SyncChange[];
  recomputed: boolean;
};

function periodFor(minute: number | null) {
  if (minute == null) return null;
  if (minute <= 45) return "FIRST_HALF" as const;
  if (minute <= 90) return "SECOND_HALF" as const;
  if (minute <= 105) return "ET1" as const;
  return "ET2" as const;
}

const pairKey = (a: string, b: string) => [a, b].sort().join("|");

type MatchRow = typeof matches.$inferSelect;

export async function syncFromEspn(opts?: { dryRun?: boolean }): Promise<SyncReport> {
  const dryRun = !!opts?.dryRun;
  await ensureSchema();

  const [allTeams, allMatches] = await Promise.all([
    db.select().from(teams),
    db.select().from(matches),
  ]);

  const teamByCode = new Map(allTeams.map((t) => [t.code, t]));
  const codeById = new Map(allTeams.map((t) => [t.id, t.code]));

  // Index our fixtures by team pair — only those with both teams known (all group games; KO once seeded).
  const byPair = new Map<string, MatchRow[]>();
  for (const m of allMatches) {
    if (!m.homeTeamId || !m.awayTeamId) continue;
    const hc = codeById.get(m.homeTeamId);
    const ac = codeById.get(m.awayTeamId);
    if (!hc || !ac) continue;
    const key = pairKey(hc, ac);
    (byPair.get(key) ?? byPair.set(key, []).get(key)!).push(m);
  }

  const espnMatches = await fetchEspnMatches({ onlyFinished: true });
  const finished = espnMatches.filter((m) => m.status === "FINISHED");

  const report: SyncReport = {
    dryRun,
    espnFinished: finished.length,
    matched: 0,
    changed: 0,
    unchanged: 0,
    unmatched: [],
    changes: [],
    recomputed: false,
  };

  let didWrite = false;

  for (const em of finished) {
    const codes = em.competitors.map((c) => c.code);
    const label = em.competitors.map((c) => c.code ?? `?(${c.espnId})`).join(" v ");

    if (em.unknownTeam || codes.some((c) => !c)) {
      report.unmatched.push({ fixture: label, espnId: em.espnId, reason: "unmapped ESPN team id" });
      continue;
    }
    const [c1, c2] = codes as [string, string];
    const candidates = byPair.get(pairKey(c1, c2));
    if (!candidates || candidates.length === 0) {
      report.unmatched.push({ fixture: label, espnId: em.espnId, reason: "no fixture with this team pair" });
      continue;
    }
    // Nearest kickoff to the ESPN date (a pair plays once in groups; disambiguates any KO rematch).
    const emTime = new Date(em.dateISO).getTime();
    const row = [...candidates].sort(
      (a, b) => Math.abs(a.kickoffUtc.getTime() - emTime) - Math.abs(b.kickoffUtc.getTime() - emTime),
    )[0]!;

    // Orientation: assign each ESPN score to whichever slot that team occupies in OUR row.
    const homeCode = codeById.get(row.homeTeamId!)!;
    const awayCode = codeById.get(row.awayTeamId!)!;
    const homeComp = em.competitors.find((c) => c.code === homeCode)!;
    const awayComp = em.competitors.find((c) => c.code === awayCode)!;
    const newHome = homeComp.score;
    const newAway = awayComp.score;

    const winnerComp = em.competitors.find((c) => c.winner);
    const winnerTeamId = winnerComp ? (teamByCode.get(winnerComp.code!)?.id ?? null) : null;

    const isKO = row.stage !== "GROUP";
    const newHomePens = isKO && em.pens ? (em.pens[homeCode] ?? null) : null;
    const newAwayPens = isKO && em.pens ? (em.pens[awayCode] ?? null) : null;

    report.matched++;

    const changed =
      row.status !== "FINISHED" ||
      row.homeScore !== newHome ||
      row.awayScore !== newAway ||
      row.winnerTeamId !== winnerTeamId ||
      (row.homePens ?? null) !== newHomePens ||
      (row.awayPens ?? null) !== newAwayPens;

    if (changed) report.changed++;
    else report.unchanged++;

    report.changes.push({
      espnId: em.espnId,
      fixture: `${homeCode} ${newHome}–${newAway} ${awayCode}`,
      before: `${row.homeScore ?? "—"}–${row.awayScore ?? "—"} · ${row.status}`,
      after: `${newHome}–${newAway} · FINISHED${winnerComp ? ` · W:${winnerComp.code}` : " · draw"}${
        newHomePens != null ? ` · pens ${newHomePens}-${newAwayPens}` : ""
      }`,
      events: em.events.length,
      applied: !dryRun && changed,
    });

    if (dryRun) continue;

    await db
      .update(matches)
      .set({
        homeScore: newHome,
        awayScore: newAway,
        homePens: newHomePens,
        awayPens: newAwayPens,
        status: "FINISHED",
        winnerTeamId,
      })
      .where(eq(matches.id, row.id));

    await db.delete(matchEvents).where(eq(matchEvents.matchId, row.id));
    const rows = await Promise.all(
      em.events.map(async (ev) => {
        const teamId = teamByCode.get(ev.teamCode)?.id ?? null;
        return {
          matchId: row.id,
          teamId,
          playerId: await resolvePlayer(teamId, ev.player),
          playerName: ev.player?.trim() || null,
          assistName: ev.assist?.trim() || null,
          type: ev.type as typeof matchEvents.$inferInsert.type,
          minute: ev.minute,
          period: periodFor(ev.minute),
          source: `espn:${em.espnId}`,
        };
      }),
    );
    if (rows.length) await db.insert(matchEvents).values(rows);
    didWrite = true;
  }

  if (didWrite) {
    await recomputeEliminations();
    report.recomputed = true;
    // revalidatePath only works inside a Next request; ignore when run from the CLI.
    try {
      for (const p of ["/", "/fixtures", "/group-stage", "/knockout", "/side-quests", "/admin/matches"]) {
        revalidatePath(p);
      }
    } catch {
      /* not in a request scope (CLI sync) */
    }
  }

  return report;
}
