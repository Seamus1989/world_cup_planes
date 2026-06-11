import { and, asc, eq, ne } from "drizzle-orm";
import { db, ensureSchema, schema } from "@/db";
import { getStandings } from "./standings";
import { resolvePlayer } from "./players";

const { matches, teams, matchEvents } = schema;

const SCORERS = [
  "Okafor", "Silva", "Haaland", "Mbappé", "Kane", "Vinícius", "Bellingham", "Saka", "Olmo",
  "Musiala", "Ødegaard", "Pulisic", "Mendes", "Tanaka", "Hakimi", "Nakamura", "Núñez", "Gakpo",
  "Osimhen", "Lautaro", "Foden", "Wirtz", "Yamal", "Rashford",
];
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;

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

async function advance(
  m: { stage: string; bracketIndex: number | null; homeTeamId: string | null; awayTeamId: string | null },
  winnerTeamId: string,
) {
  if (m.bracketIndex == null) return;
  const i = m.bracketIndex;
  const loser = winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
  const next = NEXT_STAGE[m.stage];
  if (next) await setSlot(next, Math.ceil(i / 2), i % 2 === 1, winnerTeamId);
  else if (m.stage === "SF") {
    await setSlot("FINAL", 1, i === 1, winnerTeamId);
    if (loser) await setSlot("THIRD", 1, i === 1, loser);
  }
}

/** Top-2 of each group + 8 best third-placed (only meaningful once all groups are done). */
export async function getQualifiers() {
  const tables = await getStandings();
  const complete = tables.length === 12 && tables.every((g) => g.played === 6);
  const winners = [], runners = [], thirds = [];
  for (const g of tables) {
    if (g.rows[0]) winners.push(g.rows[0]);
    if (g.rows[1]) runners.push(g.rows[1]);
    if (g.rows[2]) thirds.push(g.rows[2]);
  }
  // Best 3rd-placed across groups: pts → GD → goals → fair-play → drawing of lots.
  thirds.sort(
    (a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.fairPlay - a.fairPlay || a.code.localeCompare(b.code),
  );
  return { complete, codes: new Set([...winners, ...runners, ...thirds.slice(0, 8)].map((r) => r.code)) };
}

/** Elimination is DERIVED from results — non-qualifiers after the groups, plus every knockout loser. */
export async function recomputeEliminations() {
  await ensureSchema();
  await db.update(teams).set({ eliminated: false, eliminatedAt: null, exitStage: null });
  const allTeams = await db.select().from(teams);

  const { complete, codes } = await getQualifiers();
  if (complete) {
    for (const t of allTeams) {
      if (!codes.has(t.code)) {
        await db.update(teams).set({ eliminated: true, eliminatedAt: new Date(), exitStage: "GROUP" }).where(eq(teams.id, t.id));
      }
    }
  }

  const koFinished = await db
    .select()
    .from(matches)
    .where(and(ne(matches.stage, "GROUP"), eq(matches.status, "FINISHED")));
  for (const m of koFinished) {
    if (!m.winnerTeamId) continue;
    const loser = m.winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
    if (loser) {
      await db
        .update(teams)
        .set({ eliminated: true, eliminatedAt: new Date(), exitStage: m.stage })
        .where(eq(teams.id, loser));
    }
  }
}

type MatchRow = typeof matches.$inferSelect;

/** Simulate one match: scoreline, scorers (canonical players), shootout if a knockout's level, then advance. */
async function playMatch(m: MatchRow) {
  const isKO = m.stage !== "GROUP";
  const hs = Math.floor(Math.random() * 4);
  const as = Math.floor(Math.random() * 4);
  let hp: number | null = null;
  let ap: number | null = null;
  let winner: string | null = hs > as ? m.homeTeamId : as > hs ? m.awayTeamId : null;
  if (isKO && hs === as) {
    hp = 3 + Math.floor(Math.random() * 3);
    ap = 3 + Math.floor(Math.random() * 3);
    if (hp === ap) hp += 1;
    winner = hp > ap ? m.homeTeamId : m.awayTeamId;
  }

  await db
    .update(matches)
    .set({ status: "FINISHED", homeScore: hs, awayScore: as, homePens: hp, awayPens: ap, winnerTeamId: winner })
    .where(eq(matches.id, m.id));
  await db.delete(matchEvents).where(eq(matchEvents.matchId, m.id));

  const evs: (typeof matchEvents.$inferInsert)[] = [];
  const addGoals = async (teamId: string | null, n: number) => {
    for (let i = 0; i < n; i++) {
      const pen = Math.random() < 0.15;
      const name = pick(SCORERS);
      const playerId = await resolvePlayer(teamId, name);
      evs.push({
        matchId: m.id,
        teamId,
        playerId,
        playerName: name,
        type: pen ? "PENALTY_GOAL" : "GOAL",
        assistName: !pen && Math.random() < 0.5 ? pick(SCORERS) : null,
        minute: 1 + Math.floor(Math.random() * 90),
      });
    }
  };
  await addGoals(m.homeTeamId, hs);
  await addGoals(m.awayTeamId, as);
  if (evs.length) await db.insert(matchEvents).values(evs);

  if (isKO && winner) {
    await advance({ stage: m.stage, bracketIndex: m.bracketIndex, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId }, winner);
  }
}

const KO_ORDER = ["R32", "R16", "QF", "SF", "THIRD", "FINAL"];

/**
 * Play scheduled matches. stage: "groups" | "next" | "all" | a specific stage code.
 * count limits how many (for true game-by-game stepping). Recomputes eliminations after.
 */
export async function playMatches(stage: string, count?: number) {
  await ensureSchema();
  let rows = await db
    .select()
    .from(matches)
    .where(eq(matches.status, "SCHEDULED"))
    .orderBy(asc(matches.bracketIndex), asc(matches.kickoffUtc));

  const wantGroups = stage === "groups" || stage === "GROUP";
  if (wantGroups) rows = rows.filter((m) => m.stage === "GROUP");
  else if (stage && stage !== "next" && stage !== "all") rows = rows.filter((m) => m.stage === stage.toUpperCase());

  // knockout matches need both teams assigned before they can be played
  rows = rows.filter((m) => m.stage === "GROUP" || (m.homeTeamId && m.awayTeamId));

  if (stage === "next") {
    const ready = KO_ORDER.find((s) => rows.some((m) => m.stage === s));
    rows = ready ? rows.filter((m) => m.stage === ready) : [];
  }
  if (count && count > 0) rows = rows.slice(0, count);

  for (const m of rows) await playMatch(m);
  await recomputeEliminations();
  return { played: rows.length, stage: rows[0]?.stage ?? null };
}
