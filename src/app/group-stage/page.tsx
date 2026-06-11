import { getStandings, type StandingRow } from "@/lib/standings";
import { requireActive } from "@/lib/session";
import { SiteNav } from "@/components/SiteNav";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const me = await requireActive();
  const groups = await getStandings();
  const anyPlayed = groups.some((g) => g.played > 0);

  return (
    <main className="min-h-screen bg-tarmac text-ink">
      <SiteNav current="group-stage" user={me} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4">
          <div>
            <h1 className="font-board text-lg uppercase tracking-[0.3em] text-amber">✈ Group standings</h1>
            <p className="mt-1 font-board text-[11px] uppercase tracking-[0.25em] text-ink-dim">
              <span className="text-boarding">■</span> top 2 qualify ·{" "}
              <span className="text-delayed">■</span> best 8 third-placed also advance
            </p>
          </div>
        </header>

        {!anyPlayed && (
          <p className="mt-4 font-board text-[11px] uppercase tracking-[0.25em] text-ink-dim">
            No results yet — tables fill in as games finish.
          </p>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <section key={g.group} className="overflow-hidden rounded-board border border-hairline bg-board">
              <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
                <h2 className="font-board text-xs uppercase tracking-[0.3em] text-ink">Group {g.group}</h2>
                <span className="font-board text-[10px] uppercase tracking-widest text-ink-dim">{g.played}/6</span>
              </div>
              <table className="w-full font-board text-xs">
                <thead>
                  <tr className="text-[9px] uppercase tracking-wider text-ink-dim">
                    <th className="py-1 pl-2 text-left font-normal">#</th>
                    <th className="py-1 text-left font-normal">Team</th>
                    <th className="w-5 text-center font-normal">P</th>
                    <th className="w-5 text-center font-normal">GD</th>
                    <th className="w-6 pr-2 text-center font-normal">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r, i) => (
                    <Row key={r.code} r={r} pos={i + 1} />
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

function Row({ r, pos }: { r: StandingRow; pos: number }) {
  const tone =
    pos <= 2 ? "border-l-boarding" : pos === 3 ? "border-l-delayed" : "border-l-transparent";
  return (
    <tr className={`border-l-2 ${tone} border-b border-hairline/50 last:border-b-0`}>
      <td className="py-1.5 pl-2 text-ink-dim tabular-nums">{pos}</td>
      <td className="py-1.5">
        <span className="flex items-center gap-1.5">
          <span aria-hidden>{r.flag}</span>
          <span className={`font-display text-[13px] font-semibold ${r.eliminated ? "text-ink-dim" : "text-ink"}`}>
            {r.name}
          </span>
        </span>
        {r.owner && <span className="block pl-5 text-[9px] uppercase tracking-wider text-ink-dim">{r.owner}</span>}
      </td>
      <td className="text-center tabular-nums text-ink-dim">{r.p}</td>
      <td className="text-center tabular-nums text-ink-dim">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
      <td className="pr-2 text-center font-bold tabular-nums text-amber">{r.pts}</td>
    </tr>
  );
}
