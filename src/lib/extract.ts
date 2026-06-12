import { generateObject } from "ai";
import { z } from "zod";

export const EVENT_TYPES = [
  "GOAL",
  "PENALTY_GOAL",
  "OWN_GOAL",
  "PENALTY_MISS",
  "YELLOW",
  "RED",
] as const;

const ExtractSchema = z.object({
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

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function extractMatchFromUrl(opts: {
  url: string;
  homeTeam: string;
  awayTeam: string;
}): Promise<MatchExtract> {
  const { url, homeTeam, awayTeam } = opts;

  // No AI key locally → return a plausible mock so the whole flow is usable.
  if (!process.env.AI_GATEWAY_API_KEY) {
    return mockExtract(url, homeTeam, awayTeam);
  }

  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; GateToGlory/1.0)" },
  });
  if (!res.ok) throw new Error(`Couldn't fetch that URL (HTTP ${res.status})`);
  const text = stripHtml(await res.text()).slice(0, 14000);

  const { object } = await generateObject({
    model: process.env.AI_MODEL ?? "anthropic/claude-sonnet-4.5",
    schema: ExtractSchema,
    prompt: `Extract football (soccer) match data from this web page.
The match is ${homeTeam} (HOME) vs ${awayTeam} (AWAY).
Extract the final score and every goal and card.
Rules:
- "team": HOME for ${homeTeam}, AWAY for ${awayTeam}.
- OWN_GOAL: set "team" to the side whose player scored into his OWN net (the culprit), and "player" to that player. The goal itself counts in the OPPOSITION's scoreline.
- type: GOAL (open play), PENALTY_GOAL, OWN_GOAL, PENALTY_MISS, YELLOW, RED.
- "player": who scored / was carded. "assist": the assisting player for a goal, else null.
- "minute": the match minute as a number, or null.
- status: FINISHED if the match has ended, else SCHEDULED.
- IN-GAME penalties (taken during play, with a minute) ARE goals → type PENALTY_GOAL, and they count in the scoreline.
- A penalty SHOOTOUT (after a draw, to decide the winner) is NOT goals: put it in "shootout" as { home, away }, and do NOT add shootout kicks to events. The scoreline stays the draw. If there was no shootout, "shootout" is null.
If the page does not clearly describe THIS match, return null scores, an empty events array, and null shootout.

PAGE TEXT:
${text}`,
  });

  return { ...object, sourceUrl: url };
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
