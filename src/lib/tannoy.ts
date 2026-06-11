import { db, ensureSchema, schema } from "@/db";
import { generateText } from "ai";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { getStandings } from "./standings";
import { HOUSE_USER } from "./draw";

const { matches, matchEvents, teams, seats, users } = schema;

/** Owners are referred to by first name only: "Seamus Keanu Reeves" → "Seamus", "CJ Daniel-Neild" → "CJ". */
const firstName = (name: string | null): string | null => {
  if (!name) return null;
  if (name === HOUSE_USER.name) return name; // keep "The House" whole
  return name.trim().split(/\s+/)[0] || name;
};

/* ------------------------------------------------------------------ */
/* The voice                                                           */
/* ------------------------------------------------------------------ */

export const TANNOY_SYSTEM = `You are Big John — the larger-than-life voice on the office Tannoy (the PA announcer) for a World Cup 2026 sweepstake called "Gate to Glory". Picture a washed-up airport announcer with far too much personality and a soft spot for carnage. The theme is an airport departures board: each team is a "flight", a knocked-out team's flight is "CANCELLED", and the people who own teams are the "passengers".

You post short, funny match updates to the office Slack.

Voice & style:
- Big, daft, gloriously over-the-top British banter — like a mate who's had two pints and got hold of the mic.
- ROAST the losers. Go in on the people whose teams lost, by name — savage but good-natured (mates winding each other up, never genuinely nasty or personal). Milk thrashings, own goals and red cards for all they're worth.
- Hype the winners with equal drama, and wind up the doomed about whether they can still scrape through ("clinging on by their bootlaces", "needs a miracle and a stiff tailwind").
- 🏴 GOLDEN RULE: any time ENGLAND win a match, you MUST work in "ITS COMING HOMEEEEE" — exactly like that, full caps and the extra E's.
- The PEOPLE are the story — name them (use the first name you're given) and make them the punchline.
- A team owned by "The House" is the leftover/charity pot, not a real person — only a light touch ("the charity nicked that one"), never roast it.
- Pile on the airport/flight puns (gate, boarding, turbulence, baggage carousel, runway, lost luggage, brace position) — be a bit shameless about it.
- Punchy: 2–5 sentences for the whole update, even across a few games. A Slack message, not a match report.

Sign-off:
- ALWAYS finish on its own line with a cheesy Big John sign-off, and VARY it every time — e.g. "Big John, over and out! ✈", "This is Big John, returning you to your scheduled programming.", "Big John out — mind the closing doors.", "Tray tables up — Big John signing off."

Format:
- Plain text for Slack. Slack mrkdwn is fine (*bold*) — and lean on emojis, sprinkling them liberally for flavour (⚽ 🛫 🎉 😬 💀 🏆 🔥 🙈). No markdown headings, no hashtags.
- Mention the scores and the owners; weave in the group situation only where it adds spice.
- Output ONLY the message, ready to post.`;

/* ------------------------------------------------------------------ */
/* Gather the context (unannounced finished results)                   */
/* ------------------------------------------------------------------ */

export type TannoyContext = {
  matchIds: string[];
  games: {
    stage: string;
    group: string | null;
    home: {
      team: string;
      owner: string | null;
      score: number;
      scorers: string[];
    };
    away: {
      team: string;
      owner: string | null;
      score: number;
      scorers: string[];
    };
    pens?: { home: number; away: number };
  }[];
  groups: Record<
    string,
    {
      pos: number;
      team: string;
      owner: string | null;
      played: number;
      pts: number;
      gd: number;
    }[]
  >;
};

export async function getTannoyContext(): Promise<TannoyContext> {
  await ensureSchema();
  const [allTeams, ownerRows, finished, standings] = await Promise.all([
    db.select().from(teams),
    db
      .select({ teamId: seats.teamId, owner: users.name })
      .from(seats)
      .innerJoin(users, eq(users.id, seats.userId)),
    db
      .select()
      .from(matches)
      .where(and(eq(matches.status, "FINISHED"), isNull(matches.announcedAt)))
      .orderBy(asc(matches.matchNumber), asc(matches.kickoffUtc)),
    getStandings(),
  ]);

  if (finished.length === 0) return { matchIds: [], games: [], groups: {} };

  const teamById = new Map(allTeams.map((t) => [t.id, t]));
  const ownerByTeam = new Map(ownerRows.map((r) => [r.teamId, firstName(r.owner)]));

  const ids = finished.map((m) => m.id);
  const events = await db
    .select()
    .from(matchEvents)
    .where(inArray(matchEvents.matchId, ids));
  const scorers = new Map<string, string[]>(); // `${matchId}:${teamId}` → names
  for (const e of events) {
    if ((e.type !== "GOAL" && e.type !== "PENALTY_GOAL") || !e.teamId) continue;
    const k = `${e.matchId}:${e.teamId}`;
    const arr = scorers.get(k) ?? [];
    arr.push(
      e.type === "PENALTY_GOAL"
        ? `${e.playerName ?? "someone"} (pen)`
        : (e.playerName ?? "someone"),
    );
    scorers.set(k, arr);
  }

  const affected = new Set<string>();
  const games: TannoyContext["games"] = finished.map((m) => {
    if (m.groupLetter) affected.add(m.groupLetter);
    const h = m.homeTeamId ? teamById.get(m.homeTeamId) : null;
    const a = m.awayTeamId ? teamById.get(m.awayTeamId) : null;
    return {
      stage: m.stage,
      group: m.groupLetter,
      home: {
        team: h?.name ?? "TBD",
        owner: m.homeTeamId ? (ownerByTeam.get(m.homeTeamId) ?? null) : null,
        score: m.homeScore ?? 0,
        scorers: scorers.get(`${m.id}:${m.homeTeamId}`) ?? [],
      },
      away: {
        team: a?.name ?? "TBD",
        owner: m.awayTeamId ? (ownerByTeam.get(m.awayTeamId) ?? null) : null,
        score: m.awayScore ?? 0,
        scorers: scorers.get(`${m.id}:${m.awayTeamId}`) ?? [],
      },
      pens:
        m.homePens != null && m.awayPens != null
          ? { home: m.homePens, away: m.awayPens }
          : undefined,
    };
  });

  const groups: TannoyContext["groups"] = {};
  for (const g of standings) {
    if (!affected.has(g.group)) continue;
    groups[g.group] = g.rows.map((r, i) => ({
      pos: i + 1,
      team: r.name,
      owner: firstName(r.owner),
      played: g.played,
      pts: r.pts,
      gd: r.gd,
    }));
  }

  return { matchIds: ids, games, groups };
}

/* ------------------------------------------------------------------ */
/* Generate + post                                                     */
/* ------------------------------------------------------------------ */

export async function generateTannoyMessage(
  ctx: TannoyContext,
): Promise<string> {
  if (!ctx.games.length) return "";
  if (!process.env.AI_GATEWAY_API_KEY) return mockTannoy(ctx);

  const { text } = await generateText({
    model: process.env.AI_MODEL ?? "anthropic/claude-sonnet-4.5",
    system: TANNOY_SYSTEM,
    prompt: `Here are the latest results to announce, as JSON (games + the current group tables for the affected groups). Write the Tannoy update.\n\n${JSON.stringify(
      { games: ctx.games, groups: ctx.groups },
      null,
      2,
    )}`,
  });
  return text.trim();
}

function mockTannoy(ctx: TannoyContext): string {
  const lines = ctx.games.map((g) => {
    const { home: h, away: a } = g;
    if (h.score === a.score)
      return `✈ ${h.team} ${h.score}–${a.score} ${a.team} — honours even (${h.owner ?? "?"} vs ${a.owner ?? "?"}).`;
    const win = h.score > a.score ? h : a;
    const lose = h.score > a.score ? a : h;
    return `✈ ${win.team} saw off ${lose.team} ${Math.max(h.score, a.score)}–${Math.min(h.score, a.score)} — grand for ${win.owner ?? "?"}, gutter for ${lose.owner ?? "?"}.`;
  });
  return `📣 *Big John* (mock — set AI_GATEWAY_API_KEY for the witty version)\n${lines.join("\n")}\n\nBig John, over and out! ✈`;
}

/**
 * Who the Tannoy posts as. NB: app-based Slack webhooks may ignore these and use the
 * Slack app's own name/icon — so also rename the Slack app to "Big John" to be sure.
 */
const TANNOY_SENDER = { username: "Big John", icon_emoji: ":loudspeaker:" };

export async function postToSlack(
  text: string,
): Promise<{ ok: boolean; reason: string }> {
  // Kill-switch: only the environment with WILL_POST_TO_SLACK=true actually posts.
  // Everywhere else (local, preview) you can still generate/preview — it just won't send.
  if (process.env.WILL_POST_TO_SLACK !== "true")
    return { ok: false, reason: "Posting is off in this environment (WILL_POST_TO_SLACK ≠ true)." };
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return { ok: false, reason: "No SLACK_WEBHOOK_URL set." };
  if (!text.trim()) return { ok: false, reason: "Nothing to post." };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...TANNOY_SENDER }),
    });
    return res.ok
      ? { ok: true, reason: "" }
      : { ok: false, reason: `Slack returned HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

export async function markAnnounced(matchIds: string[]) {
  if (!matchIds.length) return;
  await db
    .update(matches)
    .set({ announcedAt: new Date() })
    .where(inArray(matches.id, matchIds));
}
