import Link from "next/link";
import { requireActive } from "@/lib/session";
import { getLoungeData, type LoungeTeam, type LoungeFixture } from "@/lib/lounge";
import { getPrizes } from "@/lib/prizes";
import { SiteNav } from "@/components/SiteNav";

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

export default async function LoungePage() {
  const me = await requireActive();

  if (!me) {
    return (
      <Shell>
        <div className="mt-20 text-center">
          <h1 className="font-display text-4xl font-extrabold text-ink">Departure Lounge</h1>
          <p className="mt-3 font-board text-xs uppercase tracking-[0.3em] text-ink-dim">
            Not checked in — open <Link href="/dev" className="text-amber underline">/dev</Link> and “Login as” a player
          </p>
        </div>
      </Shell>
    );
  }

  const { teams, alive, total } = await getLoungeData(me.id);
  const { goldenBoot } = await getPrizes();
  const bootLeader = goldenBoot[0];
  const allOut = total > 0 && alive === 0;

  return (
    <Shell me={me}>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4">
        <div className="flex items-center gap-3">
          {me.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.image} alt="" className="h-11 w-11 rounded-full border border-hairline" />
          )}
          <div>
            <h1 className="font-display text-2xl font-extrabold leading-none text-ink">
              {me.name ?? "Player"}
            </h1>
            <p className="mt-1 font-board text-[11px] uppercase tracking-[0.25em] text-ink-dim">
              Departure Lounge
            </p>
          </div>
        </div>
        <nav className="flex items-center gap-4 font-board text-[11px] uppercase tracking-widest text-ink-dim">
          <span className="text-ink">
            <span className={alive > 0 ? "text-boarding" : "text-cancelled"}>{alive}</span> / {total} airborne
          </span>
          <span className="text-ink-dim">£{total * 5} staked</span>
        </nav>
      </header>

      {bootLeader && (
        <Link
          href="/side-quests"
          className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-board border border-hairline bg-board px-4 py-3 transition hover:border-amber/40"
        >
          <span className="text-lg" aria-hidden>🥾</span>
          <span className="font-board text-[10px] uppercase tracking-widest text-ink-dim">Golden Boot</span>
          <span className="font-display text-sm font-semibold text-ink">
            {bootLeader.flag} {bootLeader.player}
          </span>
          {bootLeader.owner && (
            <span className="font-board text-[10px] uppercase tracking-wider text-ink-dim">· {bootLeader.owner}</span>
          )}
          <span className="ml-auto font-board text-xs uppercase tracking-wider text-amber">
            {bootLeader.value} ⚽ · all prizes →
          </span>
        </Link>
      )}

      {allOut && (
        <div className="mt-5 rounded-board border border-cancelled/40 bg-cancelled/5 px-5 py-4 text-center">
          <p className="font-display text-lg font-bold text-cancelled">All your flights are grounded ✈︎✗</p>
          <p className="mt-1 font-board text-[11px] uppercase tracking-[0.25em] text-ink-dim">
            Bad luck. Side-quests &amp; predictions are coming to keep you in it.
          </p>
        </div>
      )}

      {total === 0 ? (
        <p className="mt-16 text-center font-board text-sm uppercase tracking-[0.3em] text-ink-dim">
          No teams yet · the draw hasn’t been run
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {teams.map((t) => (
            <TeamCard key={t.code} team={t} />
          ))}
        </div>
      )}
    </Shell>
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
  const tone =
    f.outcome === "W" ? "text-boarding" : f.outcome === "L" ? "text-cancelled" : "text-ink-dim";
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <span className={`w-10 shrink-0 font-board text-xs ${done ? tone : "text-amber"}`}>
        {done ? f.outcome ?? "FT" : fmt.format(f.when).split(",")[0]}
      </span>
      <span className="text-ink-dim">{done ? "" : "v"}</span>
      <span aria-hidden>{f.oppFlag}</span>
      <span className="flex-1 truncate text-ink">{f.oppName}</span>
      {f.oppOwner && (
        <span className="hidden font-board text-[10px] uppercase tracking-wider text-ink-dim sm:inline">
          {f.oppOwner}
        </span>
      )}
      <span className="w-12 text-right font-board tabular-nums text-ink">
        {done ? `${f.forScore ?? 0}–${f.oppScore ?? 0}` : fmt.format(f.when).split(",")[1]?.trim()}
      </span>
    </li>
  );
}
