import { eq, inArray } from "drizzle-orm";
import { db, ensureSchema, schema } from "@/db";

const { matches, teams, seats, users, matchEvents } = schema;

export type StandingRow = {
  code: string;
  name: string;
  flag: string;
  owner: string | null;
  eliminated: boolean;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  yellow: number;
  red: number;
  fairPlay: number; // 0 is best; cards make it negative
};

export type GroupTable = { group: string; rows: StandingRow[]; played: number };

type Acc = StandingRow & { id: string; group: string };
type Match = typeof matches.$inferSelect;

export async function getStandings(): Promise<GroupTable[]> {
  await ensureSchema();
  const [allTeams, groupMatches, ownerRows, cards] = await Promise.all([
    db.select().from(teams),
    db.select().from(matches).where(eq(matches.stage, "GROUP")),
    db
      .select({ teamId: seats.teamId, owner: users.name })
      .from(seats)
      .innerJoin(users, eq(users.id, seats.userId))
      .where(eq(seats.type, "PRIMARY")),
    db
      .select({ teamId: matchEvents.teamId, type: matchEvents.type, matchId: matchEvents.matchId })
      .from(matchEvents)
      .where(inArray(matchEvents.type, ["YELLOW", "RED"])),
  ]);
  const ownerByTeam = new Map(ownerRows.map((r) => [r.teamId, r.owner]));
  const groupMatchIds = new Set(groupMatches.filter((m) => m.status === "FINISHED").map((m) => m.id));

  const byId = new Map<string, Acc>();
  for (const t of allTeams) {
    byId.set(t.id, {
      id: t.id,
      group: t.groupLetter ?? "?",
      code: t.code,
      name: t.name,
      flag: t.flagEmoji ?? "",
      owner: ownerByTeam.get(t.id) ?? null,
      eliminated: t.eliminated,
      p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0,
      yellow: 0, red: 0, fairPlay: 0,
    });
  }

  const playedByGroup = new Map<string, number>();
  for (const m of groupMatches) {
    if (m.status !== "FINISHED" || m.homeScore == null || m.awayScore == null) continue;
    const h = m.homeTeamId ? byId.get(m.homeTeamId) : null;
    const a = m.awayTeamId ? byId.get(m.awayTeamId) : null;
    if (!h || !a) continue;
    playedByGroup.set(h.group, (playedByGroup.get(h.group) ?? 0) + 1);
    h.p++; a.p++;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    if (m.homeScore > m.awayScore) { h.w++; a.l++; h.pts += 3; }
    else if (m.homeScore < m.awayScore) { a.w++; h.l++; a.pts += 3; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  }

  // Fair-play points: yellow −1, red −4 (we don't separately track second-yellow).
  for (const c of cards) {
    if (!c.teamId || !groupMatchIds.has(c.matchId)) continue;
    const t = byId.get(c.teamId);
    if (!t) continue;
    if (c.type === "YELLOW") t.yellow++;
    else if (c.type === "RED") t.red++;
  }
  for (const r of byId.values()) {
    r.gd = r.gf - r.ga;
    r.fairPlay = -(r.yellow + r.red * 4);
  }

  const groups = new Map<string, Acc[]>();
  for (const r of byId.values()) {
    if (r.group === "?") continue;
    if (!groups.has(r.group)) groups.set(r.group, []);
    groups.get(r.group)!.push(r);
  }

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, rows]) => ({
      group,
      played: playedByGroup.get(group) ?? 0,
      rows: rankGroup(rows, groupMatches),
    }));
}

const cmpOverall = (x: Acc, y: Acc) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf;
const sameOverall = (x: Acc, y: Acc) => x.pts === y.pts && x.gd === y.gd && x.gf === y.gf;

/**
 * FIFA group ranking: points → goal difference → goals scored, then for teams still level,
 * head-to-head (points, GD, goals in matches between them) → fair-play points → drawing of lots.
 */
function rankGroup(rows: Acc[], groupMatches: Match[]): Acc[] {
  const sorted = [...rows].sort(cmpOverall);
  const out: Acc[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sameOverall(sorted[i]!, sorted[j]!)) j++;
    const run = sorted.slice(i, j);
    if (run.length > 1) resolveTie(run, groupMatches);
    out.push(...run);
    i = j;
  }
  return out;
}

function resolveTie(run: Acc[], groupMatches: Match[]) {
  const ids = new Set(run.map((r) => r.id));
  const h2h = new Map(run.map((r) => [r.id, { pts: 0, gd: 0, gf: 0 }]));
  for (const m of groupMatches) {
    if (m.status !== "FINISHED" || m.homeScore == null || m.awayScore == null) continue;
    if (!m.homeTeamId || !m.awayTeamId || !ids.has(m.homeTeamId) || !ids.has(m.awayTeamId)) continue;
    const H = h2h.get(m.homeTeamId)!, A = h2h.get(m.awayTeamId)!;
    H.gf += m.homeScore; H.gd += m.homeScore - m.awayScore;
    A.gf += m.awayScore; A.gd += m.awayScore - m.homeScore;
    if (m.homeScore > m.awayScore) H.pts += 3;
    else if (m.homeScore < m.awayScore) A.pts += 3;
    else { H.pts++; A.pts++; }
  }
  run.sort((x, y) => {
    const hx = h2h.get(x.id)!, hy = h2h.get(y.id)!;
    return (
      hy.pts - hx.pts || hy.gd - hx.gd || hy.gf - hx.gf || // head-to-head
      y.fairPlay - x.fairPlay || // fair-play points (fewest cards)
      x.code.localeCompare(y.code) // drawing of lots (deterministic stand-in)
    );
  });
}
