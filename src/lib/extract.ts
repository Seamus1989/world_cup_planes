import { generateObject, generateText } from "ai";
import { z } from "zod";

export const EVENT_TYPES = ["GOAL", "PENALTY_GOAL", "OWN_GOAL", "PENALTY_MISS", "YELLOW", "RED"] as const;

const ExtractSchema = z.object({
  // true ONLY if the source explicitly reports this fixture's result
  found: z.boolean(),
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
  status: z.enum(["SCHEDULED", "FINISHED"]),
  events: z.array(
    z.object({
      team: z.enum(["HOME", "AWAY"]),
      type: z.enum(["GOAL", "PENALTY_GOAL", "OWN_GOAL", "PENALTY_MISS", "YELLOW", "RED"]),
      player: z.string(),
      assist: z.string().nullable(),
      minute: z.number().int().nullable(),
    }),
  ),
  // Penalty SHOOTOUT result (after a draw, to decide the winner). NOT goals.
  shootout: z.object({ home: z.number().int(), away: z.number().int() }).nullable(),
  summary: z.string(),
});

export type MatchExtract = z.infer<typeof ExtractSchema> & {
  sourceUrl: string;
  mock?: boolean;
  error?: string;
};

const blankExtract = (sourceUrl: string): MatchExtract => ({
  found: false,
  homeScore: null,
  awayScore: null,
  status: "SCHEDULED",
  events: [],
  shootout: null,
  summary: "",
  sourceUrl,
});

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Shared rules for turning a source into our schema. */
const STRUCTURE_RULES = (homeTeam: string, awayTeam: string) => `- "team": HOME for ${homeTeam}, AWAY for ${awayTeam}.
- type: GOAL (open play), PENALTY_GOAL (penalty scored during play), OWN_GOAL, PENALTY_MISS, YELLOW (yellow card), RED (red card or second yellow).
- OWN_GOAL: set "team" to the side whose player scored into his OWN net (the culprit), "player" to that player. The goal counts in the OPPOSITION's scoreline.
- "player": who scored or was carded. "assist": the assisting player for a goal, else null.
- "minute": the match minute as a number, or null.
- status: FINISHED if the match has ended, else SCHEDULED.
- A penalty SHOOTOUT (after a draw, to decide the winner) is NOT goals: put it in "shootout" as { home, away }, do NOT add shootout kicks to events, and the scoreline stays the draw. No shootout → null.`;

/**
 * URL mode: fetch one page, strip it, and extract the match from that text only.
 */
export async function extractMatchFromUrl(opts: {
  url: string;
  homeTeam: string;
  awayTeam: string;
}): Promise<MatchExtract> {
  const { url, homeTeam, awayTeam } = opts;

  if (!process.env.AI_GATEWAY_API_KEY) return mockExtract(url, homeTeam, awayTeam);

  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; GateToGlory/1.0)" },
  });
  if (!res.ok) throw new Error(`Couldn't fetch that URL (HTTP ${res.status})`);
  // Wikipedia group pages (all 6 matches + tables + refs) run long; the match you want is
  // often past the old 16k cut-off — which is what made it invent scores.
  const text = stripHtml(await res.text()).slice(0, 120000);

  const blank = blankExtract(url);
  if (text.length < 400) {
    return {
      ...blank,
      error:
        "That page had almost no readable text (it's probably JavaScript-rendered). Try a server-rendered report (e.g. Wikipedia) or enter the result by hand.",
    };
  }

  const { object } = await generateObject({
    model: process.env.AI_MODEL ?? "anthropic/claude-sonnet-4.5",
    schema: ExtractSchema,
    prompt: `You extract football (soccer) match data from the PAGE TEXT below. The match is ${homeTeam} (HOME) vs ${awayTeam} (AWAY).

CRITICAL — do not hallucinate:
- You have NO prior knowledge of this match; it is from a tournament AFTER your training cutoff.
- Use ONLY facts written explicitly in the PAGE TEXT. Never infer, estimate, recall, or invent anything.
- The page may list SEVERAL matches (e.g. a whole group's fixtures and tables). Read ONLY the ${homeTeam} vs ${awayTeam} fixture and ignore every other match on the page.
- Set "found" = true ONLY if the PAGE TEXT explicitly shows THIS exact fixture WITH its scoreline. Seeing the teams in a fixture list or table is NOT enough. Otherwise "found" = false, status SCHEDULED, null scores, empty events, null shootout.
- When unsure, "found" = false. A made-up scoreline is far worse than admitting you couldn't find it.

When found = true:
${STRUCTURE_RULES(homeTeam, awayTeam)}
- IN-GAME penalties (with a minute) ARE goals → PENALTY_GOAL, counting in the scoreline.

PAGE TEXT:
${text}`,
  });

  if (!object.found) {
    return {
      ...blank,
      summary: "Couldn't find this match's result on that page — nothing extracted. Try another link or enter it by hand.",
    };
  }
  return { ...object, sourceUrl: url };
}

/**
 * Search mode (no URL): Perplexity Sonar searches the live web for the fixture and returns
 * grounded, cited findings; a second pass structures them into our schema. Far better for a
 * live tournament than scraping one page — the model actually goes and finds the result.
 */
export async function searchMatchResult(opts: {
  homeTeam: string;
  awayTeam: string;
  dateISO?: string;
}): Promise<MatchExtract> {
  const { homeTeam, awayTeam, dateISO } = opts;

  if (!process.env.AI_GATEWAY_API_KEY) return { ...mockExtract("web-search", homeTeam, awayTeam) };

  // 1) Sonar — live web search, grounded + cited findings as plain text.
  const { text: findings } = await generateText({
    model: process.env.AI_SEARCH_MODEL ?? "perplexity/sonar",
    prompt: `Find the result of the 2026 FIFA World Cup match ${homeTeam} vs ${awayTeam}${
      dateISO ? ` (played on or around ${dateISO})` : ""
    }.
Report, using ONLY verifiable web sources:
- the final score,
- every goal: scorer, minute, which team, and whether it was a penalty or own goal.
If the match has not been played yet, or you cannot verify it from sources, reply exactly "NOT FOUND".`,
  });

  // 2) Structure those verified findings into our schema (no web here — just reshape).
  const { object } = await generateObject({
    model: process.env.AI_MODEL ?? "anthropic/claude-sonnet-4.5",
    schema: ExtractSchema,
    prompt: `Convert this verified match summary into structured data for ${homeTeam} (HOME) vs ${awayTeam} (AWAY).
Use ONLY what the summary states — do not add, infer or invent anything.
- If the summary is "NOT FOUND" or has no final score, set "found" = false, status SCHEDULED, null scores, empty events, null shootout.
${STRUCTURE_RULES(homeTeam, awayTeam)}

SUMMARY:
${findings}`,
  });

  if (!object.found) {
    return {
      ...blankExtract("web-search"),
      summary: "Couldn't verify this result from a web search — try a URL, or enter it by hand.",
    };
  }
  return { ...object, sourceUrl: "web-search" };
}

function mockExtract(url: string, home: string, away: string): MatchExtract {
  const hs = Math.floor(Math.random() * 4);
  const as = Math.floor(Math.random() * 4);
  const events: MatchExtract["events"] = [];
  for (let i = 0; i < hs; i++)
    events.push({ team: "HOME", type: "GOAL", player: `${home} forward`, assist: i ? `${home} midfielder` : null, minute: 12 + i * 19 });
  for (let i = 0; i < as; i++)
    events.push({ team: "AWAY", type: "GOAL", player: `${away} striker`, assist: null, minute: 21 + i * 17 });
  events.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  return {
    found: true,
    homeScore: hs,
    awayScore: as,
    status: "FINISHED",
    events,
    shootout: null,
    summary: `${home} ${hs}–${as} ${away} · MOCK data (set AI_GATEWAY_API_KEY for real extraction)`,
    sourceUrl: url,
    mock: true,
  };
}
