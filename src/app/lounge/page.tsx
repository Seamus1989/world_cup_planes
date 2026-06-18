import Link from "next/link";
import { requireActive } from "@/lib/session";
import { getLoungeData, getTodaysGames, type LoungeTeam, type LoungeFixture } from "@/lib/lounge";
import { getPrizes, getMainPrizes, PRIZES, PRIZE_TOTAL, type PrizeRow, type Finisher } from "@/lib/prizes";
import { type BoardMatch } from "@/lib/board";
import { SiteNav } from "@/components/SiteNav";
import { Confetti } from "@/components/Confetti";
import { RotatingBanner } from "@/components/RotatingBanner";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type Quest = { title: string; icon: string; prize: number; rows: PrizeRow[] };

export default async function LoungePage({
  searchParams,
}: {
  searchParams: Promise<{ confetti?: string }>;
}) {
  const me = await requireActive();
  const forceConfetti = (await searchParams).confetti === "true";
  const [{ teams, alive, total }, prizes, main, today] = await Promise.all([
    getLoungeData(me.id),
    getPrizes(),
    getMainPrizes(),
    getTodaysGames(),
  ]);
  const allOut = total > 0 && alive === 0;
  const myCodes = new Set(teams.map((t) => t.code));

  const mainRows: { label: string; icon: string; prize: number; who: Finisher }[] = [
    { label: "Champion", icon: "🏆", prize: PRIZES.champion, who: main.champion },
    { label: "Runner-up", icon: "🥈", prize: PRIZES.runnerUp, who: main.runnerUp },
    { label: "Third", icon: "🥉", prize: PRIZES.third, who: main.third },
    { label: "Fourth", icon: "🎖️", prize: PRIZES.fourth, who: main.fourth },
  ];
  const quests: Quest[] = [
    { title: "Welcome Aboard", icon: "🚪", prize: PRIZES.conceded, rows: prizes.conceded },
    { title: "The Zinedine", icon: "🟥", prize: PRIZES.zinedine, rows: prizes.zinedine },
    { title: "Friendly Fire", icon: "🤦", prize: PRIZES.ownGoals, rows: prizes.ownGoals },
    { title: "Border Control", icon: "🛂", prize: PRIZES.defence, rows: prizes.defence },
    { title: "Golden Boot", icon: "🥾", prize: PRIZES.goldenBoot, rows: prizes.goldenBoot },
    { title: "Playmaker", icon: "🅰️", prize: PRIZES.playmaker, rows: prizes.playmaker },
  ];

  // Which prizes is THIS player currently top of? (owner names come from the same users table)
  const mine = (owner: string | null | undefined) => !!owner && owner === me.name;
  const winning = [
    ...mainRows.filter((r) => mine(r.who?.owner)).map((r) => r.label),
    ...quests.filter((q) => mine(q.rows[0]?.owner)).map((q) => q.title),
  ];

  return (
    <Shell me={me}>
      <Confetti fire={winning.length > 0 || forceConfetti} />

      <RotatingBanner />

      <header className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4">
        <div className="flex items-center gap-3">
          {me.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.image} alt="" className="h-11 w-11 rounded-full border border-hairline" />
          )}
          <div>
            <h1 className="font-display text-2xl font-extrabold leading-none text-ink">{me.name ?? "Player"}</h1>
            <p className="mt-1 font-board text-[11px] uppercase tracking-[0.25em] text-ink-dim">Departure Lounge</p>
          </div>
        </div>
        <nav className="flex items-center gap-4 font-board text-[11px] uppercase tracking-widest text-ink-dim">
          <span className="text-ink">
            <span className={alive > 0 ? "text-boarding" : "text-cancelled"}>{alive}</span> / {total} airborne
          </span>
          <span className="text-ink-dim">£{PRIZE_TOTAL} pot</span>
        </nav>
      </header>

      {winning.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-board border border-amber/50 bg-amber/10 px-5 py-4">
          <p className="font-display text-lg font-extrabold text-amber">🎉 You&apos;re in the money!</p>
          <p className="mt-1 font-board text-[11px] uppercase tracking-[0.2em] text-ink">
            Currently top of: {winning.join(" · ")}
          </p>
        </div>
      )}

      {/* Today's games */}
      <section className="mt-6">
        <h2 className="font-board text-sm uppercase tracking-[0.3em] text-ink">Today&apos;s departures</h2>
        {today.length === 0 ? (
          <p className="mt-3 rounded-board border border-hairline bg-board px-4 py-3 text-center font-board text-[11px] uppercase tracking-widest text-ink-dim">
            Nothing on the board today — check fixtures for what&apos;s next ✈
          </p>
        ) : (
          <ul className="mt-3 overflow-hidden rounded-board border border-hairline bg-board">
            {today.map((g) => (
              <TodayRow
                key={g.id}
                g={g}
                mine={!!((g.home && myCodes.has(g.home.code)) || (g.away && myCodes.has(g.away.code)))}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Side-quest leaders */}
      <section className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-board text-sm uppercase tracking-[0.3em] text-ink">Side quests · who&apos;s leading</h2>
          <Link href="/side-quests" className="font-board text-[10px] uppercase tracking-widest text-amber hover:underline">
            all prizes →
          </Link>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {quests.map((q) => (
            <QuestCard key={q.title} q={q} mine={mine(q.rows[0]?.owner)} />
          ))}
        </div>
      </section>

      {allOut && (
        <div className="mt-6 rounded-board border border-cancelled/40 bg-cancelled/5 px-5 py-4 text-center">
          <p className="font-display text-lg font-bold text-cancelled">All your flights are grounded ✈︎✗</p>
          <p className="mt-1 font-board text-[11px] uppercase tracking-[0.25em] text-ink-dim">
            Bad luck — but a booby prize might still have your name on it.
          </p>
        </div>
      )}

      {/* Your flights */}
      <section className="mt-6">
        <h2 className="font-board text-sm uppercase tracking-[0.3em] text-ink">Your flights</h2>
        {total === 0 ? (
          <p className="mt-10 text-center font-board text-sm uppercase tracking-[0.3em] text-ink-dim">
            No teams yet · the draw hasn&apos;t been run
          </p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {teams.map((t) => (
              <TeamCard key={t.code} team={t} />
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}

function QuestCard({ q, mine }: { q: Quest; mine: boolean }) {
  const top = q.rows[0];
  return (
    <div
      className={`flex items-center gap-3 rounded-board border bg-board px-4 py-3 ${mine ? "border-amber ring-1 ring-amber/40" : "border-hairline"}`}
    >
      <span className="text-xl" aria-hidden>{q.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-ink">{q.title}</span>
          {mine && <span className="font-board text-[9px] uppercase tracking-widest text-amber">🎉 You</span>}
        </div>
        <div className="truncate font-board text-[10px] uppercase tracking-wider text-ink-dim">
          {top ? (
            <>
              {top.flag} {top.player}
              {top.owner && <span className="text-amber"> · {top.owner}</span>}
            </>
          ) : (
            "lights up as results come in"
          )}
        </div>
      </div>
      <span className="shrink-0 text-center font-board text-lg tabular-nums text-amber">£{q.prize}</span>
    </div>
  );
}

function TodayRow({ g, mine }: { g: BoardMatch; mine: boolean }) {
  const done = g.status === "FINISHED";
  const live = g.status === "LIVE";
  return (
    <li
      className={`grid grid-cols-[3rem_1fr_auto_1fr] items-center gap-2 border-b border-hairline/60 px-3 py-2 text-sm last:border-0 ${mine ? "bg-amber/5" : ""}`}
    >
      <span className={`font-board text-[10px] uppercase tracking-wider ${live ? "text-cancelled" : done ? "text-ink-dim" : "text-amber"}`}>
        {live ? "LIVE" : done ? "FT" : timeFmt.format(g.kickoffUtc)}
      </span>
      <span className="flex items-center justify-end gap-1.5 truncate text-right">
        <span className="truncate text-ink">{g.home?.name ?? "TBD"}</span>
        <span aria-hidden>{g.home?.flag}</span>
      </span>
      <span className="shrink-0 px-1 text-center font-board tabular-nums">
        {done || live ? (
          <span className="text-ink">
            {g.homeScore ?? 0}–{g.awayScore ?? 0}
          </span>
        ) : (
          <span className="text-ink-dim">v</span>
        )}
      </span>
      <span className="flex items-center gap-1.5 truncate">
        <span aria-hidden>{g.away?.flag}</span>
        <span className="truncate text-ink">{g.away?.name ?? "TBD"}</span>
      </span>
    </li>
  );
}

function Shell({
  children,
  me,
}: {
  children: React.ReactNode;
  me?: { name: string | null; role: string } | null;
}) {
  return (
    <main className="min-h-screen bg-runway">
      <SiteNav current="lounge" user={me} />
      <div className="mx-auto max-w-4xl px-4 py-6">{children}</div>
    </main>
  );
}

function TeamCard({ team }: { team: LoungeTeam }) {
  return (
    <div
      className={`relative overflow-hidden rounded-board border bg-board p-5 ${
        team.eliminated ? "border-cancelled/30" : "border-hairline"
      }`}
    >
      {team.eliminated && (
        <div className="pointer-events-none absolute right-3 top-3 rotate-[-9deg] rounded border-2 border-cancelled/80 px-2 py-1 font-board text-[10px] uppercase tracking-[0.2em] text-cancelled">
          ✗ Flight cancelled
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className={`text-4xl ${team.eliminated ? "opacity-50 grayscale" : ""}`} aria-hidden>
          {team.flag}
        </span>
        <div>
          <div
            className={`font-display text-xl font-extrabold leading-none ${
              team.eliminated ? "text-cancelled line-through decoration-2" : "text-ink"
            }`}
          >
            {team.name}
          </div>
          <div className="mt-1 flex items-center gap-2 font-board text-[10px] uppercase tracking-widest text-ink-dim">
            <span>Group {team.group ?? "?"}</span>
            <span className={team.eliminated ? "text-cancelled" : "text-boarding"}>
              {team.eliminated ? "Knocked out" : "In the hunt"}
            </span>
          </div>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-hairline/60 border-t border-hairline/60">
        {team.fixtures.length === 0 ? (
          <li className="py-2 font-board text-[11px] uppercase tracking-widest text-ink-dim">No fixtures</li>
        ) : (
          team.fixtures.map((f, i) => <FixtureRow key={i} f={f} />)
        )}
      </ul>
    </div>
  );
}

function FixtureRow({ f }: { f: LoungeFixture }) {
  const done = f.status === "FINISHED";
  const tone = f.outcome === "W" ? "text-boarding" : f.outcome === "L" ? "text-cancelled" : "text-ink-dim";
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <span className={`w-10 shrink-0 font-board text-xs ${done ? tone : "text-amber"}`}>
        {done ? f.outcome ?? "FT" : fmt.format(f.when).split(",")[0]}
      </span>
      <span className="text-ink-dim">{done ? "" : "v"}</span>
      <span aria-hidden>{f.oppFlag}</span>
      <span className="flex-1 truncate text-ink">{f.oppName}</span>
      {f.oppOwner && (
        <span className="hidden font-board text-[10px] uppercase tracking-wider text-ink-dim sm:inline">{f.oppOwner}</span>
      )}
      <span className="w-12 text-right font-board tabular-nums text-ink">
        {done ? `${f.forScore ?? 0}–${f.oppScore ?? 0}` : fmt.format(f.when).split(",")[1]?.trim()}
      </span>
    </li>
  );
}
