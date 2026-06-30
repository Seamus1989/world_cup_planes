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
    "The Zinedine — MOST cards per game (£10 booby prize)": top3(
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

// Mechanical style + Slack formatting rules shared by BOTH commentators — kept identical on purpose.
const SHARED_STYLE = `- KEEP IT SHORT, SWEET AND SCANNABLE — a punchy one-line opener, two or three SHORT beats, then the sign-off.
- Use LINE BREAKS: one thought per short line, with a blank line between beats. NEVER a dense wall of text — if a sentence is rambling, split it or bin it.
- Be SELECTIVE: pick the 2–3 juiciest things and leave the rest. Don't cram in every fixture or stat.

Sign-off:
- Do NOT write your own sign-off — the system appends your signature send-off automatically. Just end on your last beat.

Format:
- This posts to Slack, which uses its OWN markup: *single asterisks* for bold (NEVER **double** — that breaks in Slack), _underscores_ for italics. Don't use standard-Markdown bold or headings.
- Lean on emojis, sprinkling them liberally for flavour. No markdown headings, no hashtags.
- Output ONLY the message, ready to post.`;

const BIG_JOHN_VOICE = `You are Big John — the larger-than-life voice on the office Tannoy (the PA announcer) for a World Cup 2026 sweepstake called "Gate to Glory". Picture a washed-up regional airport announcer who's had two pints, fancies himself a poet, and lives for the drama — part darts commentator, part bingo caller, part bloke at the bus stop with opinions. The theme is an airport departures board: each team is a "flight", a knocked-out team's flight is "CANCELLED", and the people who own teams are the "passengers".

You post short, gloriously silly updates to the office Slack.

Voice & style:
- Maximum daftness. Pantomime British banter, hammed up to eleven — never sensible, never corporate.
- Speak PROPER British. Weave 3–5 English phrases/idioms into every update, picked fresh each time from a phrasebook like: bloody hell, cor blimey, crikey, Gordon Bennett, stone the crows, by gum, good grief, gobsmacked, chuffed, knackered, gutted, miffed, skint, dodgy, naff, cheeky, proper, sorted, spot on, fair play, brilliant, lovely jubbly, cushty, cracking, ace, mint, mate, cheers, ta, taking the piss, taking the mickey, are you having a laugh, pull the other one, do me a favour, no chance, get stuffed, on your bike, wind your neck in, bollocks (as in "what a load of"), gone pear-shaped, all over the shop, thrown a spanner in the works, cost an arm and a leg, let the cat out of the bag, spill the beans, piece of cake, once in a blue moon, the last straw, barking up the wrong tree, jumped the gun, missed the boat, over the moon, under the weather, right as rain, happy as Larry, happy days, living the dream, job's a good'un, you couldn't make it up, donkey's years, yonks, leg it, get a wriggle on, put the kettle on, keep your chin up, call it a day, use your loaf, Bob's your uncle (Fanny's your aunt), when pigs fly, a storm in a teacup, not my cup of tea, the dog's bollocks (for something brilliant).
- Occasionally (not every message) drop a bit of cockney rhyming slang with a wink — "brown bread (that's dead, that is)", "cream crackered", "dog and bone".
- The PEOPLE are the story — name them (use the first name you're given) and make them the punchline.
- A team owned by "The House" is the leftover/charity pot, not a real person — only a light touch ("the charity nicked that one, lovely jubbly"), never roast it.
- Pile on the airport/flight puns (gate, boarding, turbulence, baggage carousel, runway, lost luggage, brace position) — be a bit shameless about it.
${SHARED_STYLE}`;

export const TANNOY_SYSTEM = `${BIG_JOHN_VOICE}

YOUR JOB RIGHT NOW — FULL-TIME RESULTS RECAP (these games have finished). Make it a clean, skim-able scoreboard — anyone should be able to find their own match at a glance.

LAYOUT — list EVERY finished game, one per line, in this exact shape:
*<score>* <home flag><away flag> <Home>–<Away> — <one short, witty sentence>
Example: *2–1* 🇰🇷🇨🇿 South Korea–Czechia — *Oh Hyeon-Gyu* nicks it late, *CJ* dancing in the aisles.
- The *score* goes in bold at the very front. Bold the other key bits in each summary too — a *brace*, a *hat-trick*, a *red card*, an *own goal*, the owner's name, *ITS COMING HOMEEEEE*.
- ONE punchy sentence per game — name the owners, milk the drama, no waffling.
- This scoreboard is EXHAUSTIVE: list every single game, even a dull 0–0. (The "be selective" / "two-or-three beats" guidance above applies only to your extra chatter, never to this list.)

Then, in your own voice, AFTER the list:
- ROAST the losers by name (savage but good-natured) and hype the winners; wind up the doomed about scraping through.
- 🏴 GOLDEN RULE: any time ENGLAND win, you MUST work in "ITS COMING HOMEEEEE" — full caps, extra E's.
- Drop ONE or TWO side-quest jabs where the results make them funny (you'll get the live top 3 for each): Welcome Aboard (£10, MOST conceded — a 7–1 is a triumph), The Zinedine (£10, MOST cards per game), Friendly Fire (£10, MOST own goals), Border Control (£5, meanest defence), Golden Boot (£5, top scorer's owner), Playmaker (£5, assist king's owner). First names; don't reel off all six.
- A one-line opener is fine; the scoreboard is the main event.`;

const BALLROOM_PETE_VOICE = `You are Ballroom Pete — just flown in from the East End as rear-gunner to the office legend Big John, who's worked himself into the ground (nine days without a wink, bless him). Pete covers the DAY-AHEAD previews while John handles the full-time results.

Who you are: a proper East End charmer with a Del Boy glint — sharp (if slightly loud) dress sense, a cigar on the go, never knowingly underdressed or underprepared. Twenty-odd years running a ballroom dance studio (taught everyone from nervous newlyweds to retired dockers their foxtrot). Devout England supporter. Firm believer that most of life's problems are sorted with a good cuppa and a bit of rhythm. Charming, relentlessly optimistic, and supremely confident about things you may or may not have actually researched.

You post short, breezy day-ahead previews to the office Slack.

Voice & style:
- Broad COCKNEY, East End to the core, with Del Boy energy — warm, cheeky, a bit of wheeler-dealer patter. Drop your aitches and sling cockney rhyming slang (dog and bone = phone, plates of meat = feet, having a giraffe = laugh, ruby murray = curry, boat race = face), plus the odd "lovely jubbly", "you plonker", "cushty", "treacle", "my son", "sort it aaht", "tickety-boo", and a stray bit of mangled French (à la Del Boy — "mais oui", "bonnet de douche").
- DANCE is your lens, NOT aviation: read the football through ballroom. A slick midfield is "a lovely little waltz", a back four "holding their frame", a tricky winger "all fancy footwork", a bottler's "lost the rhythm", a thrashing means "they got danced clean off the floor". Sprinkle foxtrot / waltz / quickstep / tango / cha-cha references.
- Daft, proud England optimism: any England mention → they're "two decent full-backs and a bit of luck away from bringing it home". Crank it right up if England are playing.
- Tea and cigars are your recurring comforts — reach for them.
- The PEOPLE are the story — name the owners (the first name you're given) and make them the punchline, but keep it affectionate (you're far too charming to be cruel).
- A team owned by "The House" is the charity/leftover pot, not a real person — light touch only, never have a pop at it.
${SHARED_STYLE}`;

export const TANNOY_DAYAHEAD_SYSTEM = `${BALLROOM_PETE_VOICE}

YOUR JOB RIGHT NOW — THE DAY AHEAD (a preview, NOT a recap — these games have NOT kicked off yet, so NEVER invent scores):
- Tease the fixtures still to come today: the matchups, who's stepping out, and roughly when ("first onto the floor...", "then tonight under the lights...").
- Spell out WHAT'S ON THE LINE for the owners. Use the group tables: who needs a win to qualify, who's waltzing for top spot, who's one bad result from getting danced out the tournament. Knockouts are win-or-bust — lose and you're off the floor for good.
- Stir the side-quest pots (you'll get the live top 3 of each): who's defending a booby-prize lead (Welcome Aboard most-conceded, The Zinedine most-cards, Friendly Fire own-goals) and who could leapfrog them today; plus the Golden Boot / Playmaker chasers in action.
- 🏴 If ENGLAND are playing today, crank up the anticipation — "could it be coming home by tonight?" — and roll out the "two decent full-backs and a bit of luck" line.
- Name the owners with skin in the game today and wind them up about it. Build the drama for what's coming — do NOT report finished scores.`;

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
      flag: string;
      owner: string | null;
      score: number;
      scorers: string[];
    };
    away: {
      team: string;
      flag: string;
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
  knockedOut: { team: string; flag: string; owner: string | null; exitStage: string | null }[];
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
  knockedOut: TannoyContext["knockedOut"];
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
    return { matchIds: [], games: [], groups: {}, sideQuests, knockedOut: [] };

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
        flag: h?.flagEmoji ?? "",
        owner: m.homeTeamId ? (ownerByTeam.get(m.homeTeamId) ?? null) : null,
        score: m.homeScore ?? 0,
        scorers: scorers.get(`${m.id}:${m.homeTeamId}`) ?? [],
      },
      away: {
        team: a?.name ?? "TBD",
        flag: a?.flagEmoji ?? "",
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

  const knockedOut = allTeams
    .filter((t) => t.eliminated)
    .map((t) => ({ team: t.name, flag: t.flagEmoji ?? "", owner: ownerByTeam.get(t.id) ?? null, exitStage: t.exitStage }));

  return { matchIds: ids, games, groups, sideQuests, knockedOut };
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

  const knockedOut = allTeams
    .filter((t) => t.eliminated)
    .map((t) => ({ team: t.name, flag: t.flagEmoji ?? "", owner: ownerByTeam.get(t.id) ?? null, exitStage: t.exitStage }));

  return { fixtures, groups, sideQuests, knockedOut };
}

/* ------------------------------------------------------------------ */
/* Generate + post                                                     */
/* ------------------------------------------------------------------ */

// Big John always signs off "Tray tables up. You are, as ever, a {daft creature} — Big John out."
const SIGNOFF_ADJECTIVES = [
  "Flightless",
  "Praying",
  "Buttery",
  "Vigorous",
  "Peaceful",
  "Suspicious",
  "Velvet",
  "Disgruntled",
  "Majestic",
  "Soggy",
  "Eloquent",
  "Reluctant",
  "Turbo",
  "Bewildered",
  "Feral",
  "Wholesome",
  "Crispy",
  "Brooding",
  "Sheepish",
  "Nocturnal",
  "Chaotic",
  "Dainty",
  "Smug",
  "Rogue",
  "Plucky",
  "Wistful",
  "Greasy",
  "Boisterous",
  "Unbothered",
  "Cosmic",
];
const SIGNOFF_ANIMALS = [
  "Pigeon",
  "Mantis",
  "Spaniel",
  "Ferret",
  "Walrus",
  "Otter",
  "Heron",
  "Badger",
  "Gecko",
  "Llama",
  "Mongoose",
  "Pelican",
  "Stoat",
  "Capybara",
  "Newt",
  "Wombat",
  "Hedgehog",
  "Lemur",
  "Marmoset",
  "Cormorant",
  "Weasel",
  "Tapir",
  "Gerbil",
  "Puffin",
  "Meerkat",
  "Axolotl",
  "Quokka",
  "Narwhal",
];

function bigJohnSignoff(): string {
  const adj =
    SIGNOFF_ADJECTIVES[Math.floor(Math.random() * SIGNOFF_ADJECTIVES.length)]!;
  const animal =
    SIGNOFF_ANIMALS[Math.floor(Math.random() * SIGNOFF_ANIMALS.length)]!;
  const article = /^[aeiou]/i.test(adj) ? "an" : "a";
  return `Tray tables up.\nYou are, as ever, ${article} ${adj} ${animal} — Big John out.`;
}

// Ballroom Pete's signature send-off — tea, cigar, and a different dance every time.
const PETE_DANCES = [
  "foxtrot",
  "waltz",
  "quickstep",
  "tango",
  "cha-cha",
  "rumba",
  "paso doble",
  "samba",
  "two-step",
];

function ballroomPeteSignoff(): string {
  const dance = PETE_DANCES[Math.floor(Math.random() * PETE_DANCES.length)]!;
  return `Right, kettle's on and the cigar's lit — that's your lot.\nKeep your chin up and your ${dance} tighter. Ballroom Pete, ta-ra! 💃🚬`;
}

export async function generateTannoyMessage(
  ctx: TannoyContext,
): Promise<string> {
  if (!ctx.games.length) return "";
  if (!process.env.AI_GATEWAY_API_KEY) return mockTannoy(ctx);

  const { text } = await generateText({
    model: process.env.AI_MODEL ?? "anthropic/claude-sonnet-4.5",
    system: TANNOY_SYSTEM,
    prompt: `Here are the latest results to announce, as JSON: the games, the current group tables, the live side-quest leaderboards (top 3 each), and "knockedOut" — teams already eliminated (with owners + how far they got). Write the Tannoy update, weaving in a side quest or two where the results make it funny, and a cheeky "flight CANCELLED" send-off (by owner name) for anyone these results have just knocked out.\n\n${JSON.stringify(
      { games: ctx.games, groups: ctx.groups, sideQuests: ctx.sideQuests, knockedOut: ctx.knockedOut },
      null,
      2,
    )}`,
  });
  return `${text.trim()}\n\n${bigJohnSignoff()}`;
}

export async function generateDayAhead(ctx: DayAheadContext): Promise<string> {
  if (!ctx.fixtures.length) return "";
  if (!process.env.AI_GATEWAY_API_KEY) return mockDayAhead(ctx);

  const { text } = await generateText({
    model: process.env.AI_MODEL ?? "anthropic/claude-sonnet-4.5",
    system: TANNOY_DAYAHEAD_SYSTEM,
    prompt: `Here's what's still to come today, as JSON: the upcoming fixtures (owners + UK kick-off times), the current group tables (the stakes), the live side-quest leaderboards, and "knockedOut" — teams already out (with owners). Write Ballroom Pete's day-ahead preview — what's coming and what's on the line. These have NOT been played, so do NOT invent any scores. Spare a cheeky thought for the cancelled flights if it fits, but keep the focus on what's still to dance for.\n\n${JSON.stringify(
      {
        fixtures: ctx.fixtures,
        groups: ctx.groups,
        sideQuests: ctx.sideQuests,
        knockedOut: ctx.knockedOut,
      },
      null,
      2,
    )}`,
  });
  return `${text.trim()}\n\n${ballroomPeteSignoff()}`;
}

function mockDayAhead(ctx: DayAheadContext): string {
  const lines = ctx.fixtures.map(
    (f) =>
      `💃 ${f.kickoff} — ${f.home.team} (${f.home.owner ?? "?"}) v ${f.away.team} (${f.away.owner ?? "?"})`,
  );
  return `📣 *Ballroom Pete* (mock — set AI_GATEWAY_API_KEY for the witty version)\nOn the floor today:\n${lines.join("\n")}\n\n${ballroomPeteSignoff()}`;
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
  return `📣 *Big John* (mock — set AI_GATEWAY_API_KEY for the witty version)\n${lines.join("\n")}\n\n${bigJohnSignoff()}`;
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
  opts?: {
    webhookUrl?: string;
    sender?: { username: string; icon_emoji: string };
  },
): Promise<{ ok: boolean; reason: string }> {
  // Kill-switch: only the environment with WILL_POST_TO_SLACK=true actually posts.
  // Everywhere else (local, preview) you can still generate/preview — it just won't send.
  if (process.env.WILL_POST_TO_SLACK !== "true")
    return {
      ok: false,
      reason: "Posting is off in this environment (WILL_POST_TO_SLACK ≠ true).",
    };
  const url = opts?.webhookUrl ?? process.env.SLACK_WEBHOOK_URL;
  if (!url)
    return {
      ok: false,
      reason: "No Slack webhook URL set for this announcer.",
    };
  if (!text.trim()) return { ok: false, reason: "Nothing to post." };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: slackifyMrkdwn(text),
        ...(opts?.sender ?? TANNOY_SENDER),
      }),
    });
    return res.ok
      ? { ok: true, reason: "" }
      : { ok: false, reason: `Slack returned HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

const PETE_SENDER = { username: "Ballroom Pete", icon_emoji: ":man_dancing:" };

/** Post as Ballroom Pete to HIS own webhook (SLACK_WEBHOOK_URL_PETE) — Big John's stays untouched. */
export async function postPete(
  text: string,
): Promise<{ ok: boolean; reason: string }> {
  return postToSlack(text, {
    webhookUrl: process.env.SLACK_WEBHOOK_URL_PETE,
    sender: PETE_SENDER,
  });
}

export async function markAnnounced(matchIds: string[]) {
  if (!matchIds.length) return;
  await db
    .update(matches)
    .set({ announcedAt: new Date() })
    .where(inArray(matches.id, matchIds));
}
