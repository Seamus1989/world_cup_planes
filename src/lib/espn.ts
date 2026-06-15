/**
 * ESPN's public (unofficial) JSON feed for the 2026 FIFA World Cup — no API key needed.
 * The score is a NUMBER IN A FIELD, not prose, so there is nothing for an LLM to misread.
 * This replaces the AI page-scraper as the source of truth for results + events.
 *
 * Endpoints (competition slug `fifa.world`):
 *   scoreboard ?dates=YYYYMMDD-YYYYMMDD  → fixtures, final scores, per-team `winner` flag
 *   summary    ?event=<id>              → per-match key events (goals, cards, own goals)
 *
 * ESPN team IDs are stable primary keys; the map below was verified against all 48 of our
 * team codes on 2026-06-15. We key on the numeric id (not the abbreviation) so it can't drift.
 *
 * Caveat: an unofficial endpoint. Treat failures gracefully and keep manual entry as a fallback.
 */

const SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

/** ESPN numeric team id → our 3-letter team code (all 48, verified 2026-06-15). */
export const ESPN_TEAM_CODE_BY_ID: Record<string, string> = {
  "203": "MEX", "467": "RSA", "451": "KOR", "450": "CZE", // Group A
  "206": "CAN", "475": "SUI", "4398": "QAT", "452": "BIH", // Group B
  "205": "BRA", "2869": "MAR", "580": "SCO", "2654": "HAI", // Group C
  "660": "USA", "628": "AUS", "210": "PAR", "465": "TUR", // Group D
  "481": "GER", "209": "ECU", "4789": "CIV", "11678": "CUW", // Group E
  "449": "NED", "627": "JPN", "659": "TUN", "466": "SWE", // Group F
  "459": "BEL", "469": "IRN", "2620": "EGY", "2666": "NZL", // Group G
  "164": "ESP", "212": "URU", "655": "KSA", "2597": "CPV", // Group H
  "478": "FRA", "654": "SEN", "464": "NOR", "4375": "IRQ", // Group I
  "202": "ARG", "474": "AUT", "624": "ALG", "2917": "JOR", // Group J
  "482": "POR", "208": "COL", "2570": "UZB", "2850": "COD", // Group K
  "448": "ENG", "477": "CRO", "2659": "PAN", "4469": "GHA", // Group L
};

/**
 * The whole tournament in date windows. One scoreboard call caps at 100 events, and the
 * tournament has 104, so we fetch in non-overlapping windows and merge (dedup by id).
 * Dates are the real WC2026 span (11 Jun – 19 Jul 2026).
 */
const DATE_WINDOWS = [
  "20260611-20260617",
  "20260618-20260624",
  "20260625-20260701",
  "20260702-20260708",
  "20260709-20260715",
  "20260716-20260720",
];

export type EspnEventType = "GOAL" | "PENALTY_GOAL" | "OWN_GOAL" | "YELLOW" | "RED";

export type EspnEvent = {
  teamCode: string; // our code of the team the event is attributed to (for OWN_GOAL: the CULPRIT's team)
  type: EspnEventType;
  player: string | null;
  assist: string | null;
  minute: number | null;
};

export type EspnCompetitor = {
  espnId: string;
  code: string | null; // our code, or null if the ESPN id isn't in our map
  score: number;
  winner: boolean;
  homeAway: "home" | "away";
};

export type EspnMatch = {
  espnId: string;
  dateISO: string;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  competitors: EspnCompetitor[]; // exactly 2
  events: EspnEvent[]; // populated for FINISHED matches
  pens: Record<string, number> | null; // shootout tally keyed by our code (knockouts only)
  unknownTeam: boolean; // an ESPN team id we couldn't map → don't trust this row
};

const GOAL_TYPE_IDS = new Set(["70", "137", "173"]); // goal, goal-header, goal-volley
const RED_TYPE_IDS = new Set(["93", "167"]); // red-card, VAR red-card upgrade

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; GateToGlory/1.0)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ESPN HTTP ${res.status} for ${url}`);
  return (await res.json()) as Record<string, unknown>;
}

/** "9'" → 9, "45'+4'" → 45, "90'+8'" → 90 (we store the base minute; period is derived from it). */
function minuteOf(k: Record<string, unknown>): number | null {
  const dv = (k.clock as { displayValue?: string } | undefined)?.displayValue ?? "";
  const m = /^(\d+)/.exec(dv);
  return m ? Number(m[1]) : null;
}

type RawEvent = {
  id?: string | number;
  date?: string;
  status?: { type?: { state?: string; completed?: boolean } };
  competitions?: { competitors?: RawCompetitor[] }[];
};
type RawCompetitor = { team?: { id?: string | number }; score?: string | number; winner?: boolean; homeAway?: string };

function parseScoreboardEvent(e: RawEvent): EspnMatch {
  const comp = (e.competitions ?? [])[0] ?? {};
  const competitors: EspnCompetitor[] = (comp.competitors ?? []).map((c) => {
    const espnId = String(c.team?.id ?? "");
    return {
      espnId,
      code: ESPN_TEAM_CODE_BY_ID[espnId] ?? null,
      score: Number(c.score ?? 0),
      winner: !!c.winner,
      homeAway: c.homeAway === "away" ? "away" : "home",
    };
  });
  const st = e.status?.type ?? {};
  const status = st.completed ? "FINISHED" : st.state === "in" ? "LIVE" : "SCHEDULED";
  return {
    espnId: String(e.id ?? ""),
    dateISO: e.date ?? "",
    status,
    competitors,
    events: [],
    pens: null,
    unknownTeam: competitors.length !== 2 || competitors.some((c) => !c.code),
  };
}

/** Turn a match summary's keyEvents into our normalised events (+ shootout tally). */
function parseSummaryEvents(
  summary: Record<string, unknown>,
  competitors: EspnCompetitor[],
): { events: EspnEvent[]; pens: Record<string, number> | null } {
  const codeByEspnId = new Map(competitors.map((c) => [c.espnId, c.code]));
  const codes = competitors.map((c) => c.code).filter(Boolean) as string[];
  const events: EspnEvent[] = [];
  const pens: Record<string, number> = {};

  for (const k of (summary.keyEvents as Record<string, unknown>[] | undefined) ?? []) {
    const typeId = String((k.type as { id?: string | number } | undefined)?.id ?? "");
    const parts = ((k.participants as { athlete?: { displayName?: string } }[] | undefined) ?? [])
      .map((p) => p.athlete?.displayName)
      .filter((n): n is string => !!n);
    const teamCode = codeByEspnId.get(String((k.team as { id?: string | number } | undefined)?.id ?? "")) ?? null;
    const minute = minuteOf(k);
    const isShootout = !!k.shootout;

    let type: EspnEventType | null = null;
    let code = teamCode;
    let assist: string | null = null;

    if (GOAL_TYPE_IDS.has(typeId)) {
      type = "GOAL";
      assist = parts[1] ?? null;
    } else if (typeId === "98") {
      type = "PENALTY_GOAL";
    } else if (typeId === "97") {
      type = "OWN_GOAL";
      // ESPN tags an own goal with the BENEFITING team; the culprit's team is the other side.
      code = codes.find((c) => c !== teamCode) ?? null;
    } else if (typeId === "94") {
      type = "YELLOW";
    } else if (RED_TYPE_IDS.has(typeId)) {
      type = "RED";
    } else {
      continue; // substitutions, kickoff, halftime, delays, etc.
    }

    if (!code) continue; // unmapped team — skip rather than mis-attribute

    if (isShootout) {
      // Shootout kicks decide the winner but are NOT goals: tally, don't emit as events.
      if (type === "GOAL" || type === "PENALTY_GOAL") pens[code] = (pens[code] ?? 0) + 1;
      continue;
    }
    events.push({ teamCode: code, type, player: parts[0] ?? null, assist, minute });
  }

  return { events, pens: Object.keys(pens).length ? pens : null };
}

/** Run async `fn` over `items` with at most `limit` in flight (be a polite API citizen). */
async function mapLimit<T>(items: T[], limit: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < items.length) await fn(items[i++]!);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Fetch every match across the tournament. For FINISHED matches we also pull the summary so
 * goals/cards/own-goals come through. `onlyFinished` skips the (many) summary calls for
 * not-yet-played fixtures. Windows fetch in parallel; summaries fetch 8-at-a-time.
 */
export async function fetchEspnMatches(opts?: { onlyFinished?: boolean }): Promise<EspnMatch[]> {
  const windows = await Promise.all(DATE_WINDOWS.map((w) => getJson(`${SITE}/scoreboard?dates=${w}`)));
  const byId = new Map<string, RawEvent>();
  for (const d of windows) {
    for (const e of (d.events as RawEvent[] | undefined) ?? []) byId.set(String(e.id), e);
  }

  const all = [...byId.values()].map(parseScoreboardEvent);
  const list = opts?.onlyFinished ? all.filter((m) => m.status === "FINISHED") : all;

  // A flaky single summary shouldn't sink the whole sync — that match keeps its score, loses events.
  const needSummary = list.filter((m) => m.status === "FINISHED" && !m.unknownTeam);
  await mapLimit(needSummary, 8, async (m) => {
    try {
      const summary = await getJson(`${SITE}/summary?event=${m.espnId}`);
      const { events, pens } = parseSummaryEvents(summary, m.competitors);
      m.events = events;
      m.pens = pens;
    } catch {
      /* keep the scoreline; events stay empty */
    }
  });

  return list;
}

/**
 * Find ONE finished ESPN match by our two team codes (order-independent) and pull its events.
 * Light: fetches the scoreboard windows, then a single summary. For the per-match admin fetch.
 */
export async function fetchEspnMatchByCodes(homeCode: string, awayCode: string): Promise<EspnMatch | null> {
  const windows = await Promise.all(DATE_WINDOWS.map((w) => getJson(`${SITE}/scoreboard?dates=${w}`)));
  const byId = new Map<string, RawEvent>();
  for (const d of windows) {
    for (const e of (d.events as RawEvent[] | undefined) ?? []) byId.set(String(e.id), e);
  }

  const want = new Set([homeCode, awayCode]);
  for (const raw of byId.values()) {
    const m = parseScoreboardEvent(raw);
    if (m.status !== "FINISHED") continue;
    const codes = m.competitors.map((c) => c.code);
    if (codes.length !== 2 || !codes.every((c) => c && want.has(c))) continue;
    const summary = await getJson(`${SITE}/summary?event=${m.espnId}`);
    const { events, pens } = parseSummaryEvents(summary, m.competitors);
    m.events = events;
    m.pens = pens;
    return m;
  }
  return null;
}
