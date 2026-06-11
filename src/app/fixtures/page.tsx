import { getBoardFixtures, type BoardMatch, type BoardTeam } from "@/lib/board";
import { requireActive } from "@/lib/session";
import { SiteNav } from "@/components/SiteNav";

export const dynamic = "force-dynamic";

const fmtTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const fmtDay = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  day: "2-digit",
  month: "short",
});

export default async function BoardPage() {
  const me = await requireActive();
  const fixtures = await getBoardFixtures();

  // group by UK calendar day, preserving kickoff order
  const days = new Map<string, BoardMatch[]>();
  for (const m of fixtures) {
    const key = fmtDay.format(m.kickoffUtc);
    if (!days.has(key)) days.set(key, []);
    days.get(key)!.push(m);
  }

  return (
    <main className="min-h-screen bg-tarmac">
      <SiteNav current="fixtures" user={me} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4">
          <div>
            <h1 className="font-board text-lg uppercase tracking-[0.3em] text-amber">✈ Departures</h1>
            <p className="mt-1 font-board text-[11px] uppercase tracking-[0.25em] text-ink-dim">
              World Cup 2026 · all times UK
            </p>
          </div>
        </header>

        {days.size === 0 ? (
          <p className="mt-16 text-center font-board text-sm uppercase tracking-[0.3em] text-ink-dim">
            No fixtures yet · seed them in /dev
          </p>
        ) : (
          <div className="mt-6 space-y-6" style={{ perspective: 900 }}>
            {[...days.entries()].map(([day, ms]) => (
              <section key={day}>
                <div className="mb-2 flex items-center gap-3">
                  <h2 className="font-board text-xs uppercase tracking-[0.35em] text-ink">{day}</h2>
                  <span className="h-px flex-1 bg-hairline" />
                  <span className="font-board text-[10px] uppercase tracking-widest text-ink-dim">
                    {ms.length} {ms.length === 1 ? "flight" : "flights"}
                  </span>
                </div>
                <div className="overflow-hidden rounded-board border border-hairline bg-board">
                  {ms.map((m, i) => (
                    <Row key={m.id} m={m} idx={i} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ m, idx }: { m: BoardMatch; idx: number }) {
  const finished = m.status === "FINISHED";
  const live = m.status === "LIVE";
  return (
    <div
      className="animate-flap grid grid-cols-[3rem_1.6rem_1fr_auto_1fr_4rem] items-baseline gap-2 border-b border-hairline/70 px-3 py-3 last:border-0 sm:gap-3 sm:px-4"
      style={{ animationDelay: `${Math.min(idx, 14) * 0.03}s` }}
    >
      <span className="font-board text-sm tabular-nums text-amber">{fmtTime.format(m.kickoffUtc)}</span>
      <span className="font-board text-[11px] text-ink-dim">{m.group ?? ""}</span>

      <TeamCell team={m.home} align="right" />

      <span className="px-1 text-center font-board text-base tabular-nums text-ink">
        {finished ? (
          <>
            {m.homeScore ?? 0}–{m.awayScore ?? 0}
            {m.homePens != null && m.awayPens != null && (
              <span className="ml-1 text-[9px] text-ink-dim">p{m.homePens}-{m.awayPens}</span>
            )}
          </>
        ) : (
          <span className="text-ink-dim">v</span>
        )}
      </span>

      <TeamCell team={m.away} align="left" />

      <span
        className={`text-right font-board text-[11px] uppercase tracking-wider ${
          finished ? "text-boarding" : live ? "text-amber" : "text-ink-dim"
        }`}
      >
        {finished ? "FT" : live ? "● Live" : "On time"}
      </span>
    </div>
  );
}

function TeamCell({ team, align }: { team: BoardTeam | null; align: "left" | "right" }) {
  if (!team) return <span className="text-ink-dim">—</span>;
  const right = align === "right";
  return (
    <div className={right ? "text-right" : "text-left"}>
      <div className={`flex items-center gap-2 ${right ? "justify-end" : "justify-start"}`}>
        {!right && <span aria-hidden>{team.flag}</span>}
        <span
          className={`truncate font-display font-semibold ${team.eliminated ? "text-ink-dim" : "text-ink"}`}
        >
          {team.name}
        </span>
        {right && <span aria-hidden>{team.flag}</span>}
      </div>
      <div className={`font-board text-[10px] uppercase tracking-wider text-ink-dim ${right ? "text-right" : "text-left"}`}>
        {team.owner ?? "—"}
      </div>
    </div>
  );
}
