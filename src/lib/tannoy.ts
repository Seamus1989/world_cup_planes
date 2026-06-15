import { db, ensureSchema, schema } from "@/db";
import { generateText } from "ai";
import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { HOUSE_USER } from "./draw";
import { getPrizes, type PrizeRow, type Prizes } from "./prizes";
import { getStandings } from "./standings";

const { matches, matchEvents, teams, seats, users } = schema;

/** Owners are referred to by first name only: "Seamus Keanu Reeves" → "Seamus", "CJ Daniel-Neild" → "CJ". */
const firstName = (name: string | null): string | null => {
  if (!name) return null;
  if (name === HOUSE_USER.name) return name; // keep "The House" whole
  return name.trim().split(/\s+/)[0] || name;
};

/** UK kick-off label, e.g. "Sat, 20:00". */
const ukTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Top 3 of each side-quest leaderboard, labelled for Big John (shared by recap + day-ahead). */
function buildSideQuests(prizes: Prizes): TannoyContext["sideQuests"] {
  const top3 = (rows: PrizeRow[]) =>
    rows.slice(0, 3).map((r) => ({
      leader: r.player,
      owner: firstName(r.owner),
      value: r.value,
      note: r.sub ?? null,
    }));
  return {
    "Welcome Aboard — MOST goals conceded (£10 booby prize)": top3(
      prizes.conceded,
    ),
    "The Zinedine — MOST yellow/red cards (£10 booby prize)": top3(
      prizes.zinedine,
    ),
    "Friendly Fire — MOST own goals (£10 booby prize)": top3(prizes.ownGoals),
    "Border Control — FEWEST conceded per game (£5)": top3(prizes.defence),
    "Golden Boot — most goals (£5)": top3(prizes.goldenBoot),
    "Playmaker — most assists (£5)": top3(prizes.playmaker),
  };
}

/* ------------------------------------------------------------------ */
/* The voice                                                           */
/* ------------------------------------------------------------------ */

const BIG_JOHN_VOICE = `You are Big John — the larger-than-life voice on the office Tannoy (the PA announcer) for a World Cup 2026 sweepstake called "Gate to Glory". Picture a washed-up regional airport announcer who's had two pints, fancies himself a poet, and lives for the drama — part darts commentator, part bingo caller, part bloke at the bus stop with opinions. The theme is an airport departures board: each team is a "flight", a knocked-out team's flight is "CANCELLED", and the people who own teams are the "passengers".

You post short, gloriously silly updates to the office Slack.

Voice & style:
- Maximum daftness. Pantomime British banter, hammed up to eleven — never sensible, never corporate.
- Speak PROPER British. Weave 3–5 English phrases/idioms into every update, picked fresh each time from a phrasebook like: bloody hell, cor blimey, crikey, Gordon Bennett, stone the crows, by gum, good grief, gobsmacked, chuffed, knackered, gutted, miffed, skint, dodgy, naff, cheeky, proper, sorted, spot on, fair play, brilliant, lovely jubbly, cushty, cracking, ace, mint, mate, cheers, ta, taking the piss, taking the mickey, are you having a laugh, pull the other one, do me a favour, no chance, get stuffed, on your bike, wind your neck in, bollocks (as in "what a load of"), gone pear-shaped, all over the shop, thrown a spanner in the works, cost an arm and a leg, let the cat out of the bag, spill the beans, piece of cake, once in a blue moon, the last straw, barking up the wrong tree, jumped the gun, missed the boat, over the moon, under the weather, right as rain, happy as Larry, happy days, living the dream, job's a good'un, you couldn't make it up, donkey's years, yonks, leg it, get a wriggle on, put the kettle on, keep your chin up, call it a day, use your loaf, Bob's your uncle (Fanny's your aunt), when pigs fly, a storm in a teacup, not my cup of tea, the dog's bollocks (for something brilliant).
- Occasionally (not every message) drop a bit of cockney rhyming slang with a wink — "brown bread (that's dead, that is)", "cream crackered", "dog and bone".
- The PEOPLE are the story — name them (use the first name you're given) and make them the punchline.
- A team owned by "The House" is the leftover/charity pot, not a real person — only a light touch ("the charity nicked that one, lovely jubbly"), never roast it.
- Pile on the airport/flight puns (gate, boarding, turbulence, baggage carousel, runway, lost luggage, brace position) — be a bit shameless about it.
- Use LINE BREAKS: one thought per short line, with a blank line between beats. NEVER a dense wall of text — if a sentence is rambling, split it or bin it.
- Be SELECTIVE: pick the 3–4 juiciest things (a thrashing, a big name on the line, one cheeky side-quest jab) and leave the rest. Don't cram in every stat.

Sign-off:
- ALWAYS finish on its own line with a cheesy Big John sign-off, and VARY it every time — e.g. "Big John, over and out! ✈", "Right, kettle's on — Big John signing off. 🫖", "Big John out — Bob's your uncle, Fanny's your aunt.", "Mind the closing doors — ta-ta from Big John.", "Tray tables up, cheers mate — Big John done."

Format:
- This posts to Slack, which uses its OWN markup: *single asterisks* for bold (NEVER **double** — that breaks in Slack), _underscores_ for italics. Don't use standard-Markdown bold or headings.
- Lean on emojis, sprinkling them liberally for flavour (⚽ 🛫 🎉 😬 💀 🏆 🔥 🙈 🫖). No markdown headings, no hashtags.
- Output ONLY the message, ready to post.`;

export const TANNOY_SYSTEM = `${BIG_JOHN_VOICE}

YOUR JOB RIGHT NOW — FULL-TIME RESULTS RECAP (these games have finished):
- ROAST the losers. Go in on the people whose teams lost, by name — savage but good-natured (mates winding each other up, never genuinely nasty or personal). Milk thrashings for all they're worth ("absolutely brown bread", "wants their money back", "couldn't hit a barn door").
- Hype the winners with equal drama, and wind up the doomed about whether they can still scrape through ("clinging on by their bootlaces", "needs a miracle and a stiff tailwind").
- 🏴 GOLDEN RULE: any time ENGLAND win a match, you MUST work in "ITS COMING HOMEEEEE" — exactly like that, full caps and the extra E's.
- Side quests (extra cash pots): some prizes REWARD being rubbish, so a hammering can be brilliant news for the owner — milk the irony. You'll be given the live top 3 for each:
  · Welcome Aboard (£10 booby): MOST goals conceded — a 7–1 shellacking is a triumph for that owner. "All aboard — let 'em all in!"
  · The Zinedine (£10 booby): MOST yellow/red cards — salute the dirtiest, most sent-off rabble.
  · Friendly Fire (£10 booby): MOST own goals — toast anyone smashing it into their own net.
  · Border Control (£5): FEWEST conceded per game — praise the meanest defence. Golden Boot (£5): top scorer's owner. Playmaker (£5): assist king's owner.
  Name the leaders by first name and weave in one or two where the result makes it funny — don't reel off all six like a spreadsheet.
- Mention the scores and the owners; weave in the group situation only where it adds spice.`;

export const TANNOY_DAYAHEAD_SYSTEM = `${BIG_JOHN_VOICE}

YOUR JOB RIGHT NOW — THE DAY AHEAD (a hype-up, NOT a recap — these games have NOT kicked off yet, so NEVER invent scores):
- Tease the fixtures still to come today: who's flying, the matchups, and roughly when ("first up...", "then tonight under the lights...").
- Spell out WHAT'S ON THE LINE for the passengers (owners). Use the group tables: who needs a win to qualify, who's scrapping for top spot, whose flight is one bad result from CANCELLED. Knockouts are win-or-bust — lose and you're going home.
- Stir the side-quest pots (you'll get the live top 3 of each): who's defending a booby-prize lead (Welcome Aboard most-conceded, The Zinedine most-cards, Friendly Fire own-goals) and who could leapfrog them today; plus the Golden Boot / Playmaker chasers in action.
- 🏴 If ENGLAND are playing today, crank up the anticipation — "could it be COMING HOMEEEEE by tonight?" (save the full-caps ITS COMING HOMEEEEE for an actual win).
- Name the passengers with skin in the game today and wind them up about it. Build the drama for what's coming — do NOT report finished scores.`;

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
  sideQuests: Record<
    string,
    {
      leader: string;
      owner: string | null;
      value: number;
      note: string | null;
    }[]
  >;
};

export type DayAheadContext = {
  fixtures: {
    stage: string;
    group: string | null;
    kickoff: string; // UK wall-clock label
    knockout: boolean;
    home: { team: string; owner: string | null };
    away: { team: string; owner: string | null };
  }[];
  groups: TannoyContext["groups"]; // tables for the groups in action today (the stakes)
  sideQuests: TannoyContext["sideQuests"];
};

export async function getTannoyContext(): Promise<TannoyContext> {
  await ensureSchema();
  const [allTeams, ownerRows, finished, standings, prizes] = await Promise.all([
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
    getPrizes(),
  ]);

  const sideQuests = buildSideQuests(prizes);

  if (finished.length === 0)
    return { matchIds: [], games: [], groups: {}, sideQuests };

  const teamById = new Map(allTeams.map((t) => [t.id, t]));
  const ownerByTeam = new Map(
    ownerRows.map((r) => [r.teamId, firstName(r.owner)]),
  );

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

  return { matchIds: ids, games, groups, sideQuests };
}

/* ------------------------------------------------------------------ */
/* The day ahead (upcoming fixtures + what's on the line)              */
/* ------------------------------------------------------------------ */

export async function getDayAheadContext(opts?: {
  now?: Date;
  hoursAhead?: number;
}): Promise<DayAheadContext> {
  await ensureSchema();
  const now = opts?.now ?? new Date();
  const horizon = new Date(
    now.getTime() + (opts?.hoursAhead ?? 18) * 3_600_000,
  );

  const [allTeams, ownerRows, upcoming, standings, prizes] = await Promise.all([
    db.select().from(teams),
    db
      .select({ teamId: seats.teamId, owner: users.name })
      .from(seats)
      .innerJoin(users, eq(users.id, seats.userId)),
    db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.status, "SCHEDULED"),
          gte(matches.kickoffUtc, now),
          lte(matches.kickoffUtc, horizon),
        ),
      )
      .orderBy(asc(matches.kickoffUtc)),
    getStandings(),
    getPrizes(),
  ]);

  const teamById = new Map(allTeams.map((t) => [t.id, t]));
  const ownerByTeam = new Map(
    ownerRows.map((r) => [r.teamId, firstName(r.owner)]),
  );
  const sideQuests = buildSideQuests(prizes);

  const affected = new Set<string>();
  const fixtures: DayAheadContext["fixtures"] = upcoming
    .filter((m) => m.homeTeamId && m.awayTeamId) // both teams known (knockout slots may still be TBD)
    .map((m) => {
      if (m.groupLetter) affected.add(m.groupLetter);
      const h = m.homeTeamId ? teamById.get(m.homeTeamId) : null;
      const a = m.awayTeamId ? teamById.get(m.awayTeamId) : null;
      return {
        stage: m.stage,
        group: m.groupLetter,
        kickoff: ukTime.format(m.kickoffUtc),
        knockout: m.stage !== "GROUP",
        home: {
          team: h?.name ?? "TBD",
          owner: m.homeTeamId ? (ownerByTeam.get(m.homeTeamId) ?? null) : null,
        },
        away: {
          team: a?.name ?? "TBD",
          owner: m.awayTeamId ? (ownerByTeam.get(m.awayTeamId) ?? null) : null,
        },
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

  return { fixtures, groups, sideQuests };
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
    prompt: `Here are the latest results to announce, as JSON: the games, the current group tables for the affected groups, and the live side-quest leaderboards (top 3 each). Write the Tannoy update, weaving in a side quest or two where the results make it funny.\n\n${JSON.stringify(
      { games: ctx.games, groups: ctx.groups, sideQuests: ctx.sideQuests },
      null,
      2,
    )}`,
  });
  return text.trim();
}

export async function generateDayAhead(ctx: DayAheadContext): Promise<string> {
  if (!ctx.fixtures.length) return "";
  if (!process.env.AI_GATEWAY_API_KEY) return mockDayAhead(ctx);

  const { text } = await generateText({
    model: process.env.AI_MODEL ?? "anthropic/claude-sonnet-4.5",
    system: TANNOY_DAYAHEAD_SYSTEM,
    prompt: `Here's what's still to come today, as JSON: the upcoming fixtures (owners + UK kick-off times), the current group tables for the groups in action (the stakes), and the live side-quest leaderboards. Write Big John's "day ahead" hype — what's coming and what's on the line. These have NOT been played, so do NOT invent any scores.\n\n${JSON.stringify(
      {
        fixtures: ctx.fixtures,
        groups: ctx.groups,
        sideQuests: ctx.sideQuests,
      },
      null,
      2,
    )}`,
  });
  return text.trim();
}

function mockDayAhead(ctx: DayAheadContext): string {
  const lines = ctx.fixtures.map(
    (f) =>
      `🛫 ${f.kickoff} — ${f.home.team} (${f.home.owner ?? "?"}) v ${f.away.team} (${f.away.owner ?? "?"})`,
  );
  return `📣 *Big John* (mock — set AI_GATEWAY_API_KEY for the witty version)\nComing up today:\n${lines.join("\n")}\n\nMind the closing doors — ta-ta from Big John. ✈`;
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

/**
 * Models write standard Markdown, but Slack mrkdwn uses *one* asterisk for bold, not two — so
 * `**bold**` arrives with literal asterisks. Convert to Slack's flavour right before posting.
 */
function slackifyMrkdwn(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "*_$1_*") // ***bold italic*** → Slack *_x_*
    .replace(/\*\*(.+?)\*\*/g, "*$1*") // **bold** → *bold*
    .replace(/__(.+?)__/g, "*$1*") // __bold__ → *bold*
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*"); // # heading → *heading*
}

export async function postToSlack(
  text: string,
): Promise<{ ok: boolean; reason: string }> {
  // Kill-switch: only the environment with WILL_POST_TO_SLACK=true actually posts.
  // Everywhere else (local, preview) you can still generate/preview — it just won't send.
  if (process.env.WILL_POST_TO_SLACK !== "true")
    return {
      ok: false,
      reason: "Posting is off in this environment (WILL_POST_TO_SLACK ≠ true).",
    };
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return { ok: false, reason: "No SLACK_WEBHOOK_URL set." };
  if (!text.trim()) return { ok: false, reason: "Nothing to post." };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: slackifyMrkdwn(text), ...TANNOY_SENDER }),
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
