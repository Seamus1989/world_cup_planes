import { getPrizes, type PrizeRow } from "@/lib/prizes";
import { requireActive } from "@/lib/session";
import { SiteNav } from "@/components/SiteNav";

export const dynamic = "force-dynamic";

export default async function PrizesPage() {
  const me = await requireActive();
  const { goldenBoot, playmaker, penalties, totalGoals } = await getPrizes();

  return (
    <main className="min-h-screen bg-runway">
      <SiteNav current="side-quests" user={me} />
      <div className="mx-auto max-w-4xl px-4 py-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4">
          <div>
            <h1 className="font-board text-lg uppercase tracking-[0.3em] text-amber">✈ Bonus prizes</h1>
            <p className="mt-1 font-board text-[11px] uppercase tracking-[0.25em] text-ink-dim">
              Side-quests · the owner of each leader takes the pot
            </p>
          </div>
        </header>

        {totalGoals === 0 ? (
          <p className="mt-16 text-center font-board text-sm uppercase tracking-[0.3em] text-ink-dim">
            No goals yet — prizes light up as results come in.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Prize title="Golden Boot" icon="🥾" unit="goals" rows={goldenBoot} className="sm:col-span-2" />
            <Prize title="Playmaker" icon="🅰️" unit="assists" rows={playmaker} />
            <Prize title="Penalty King" icon="🎯" unit="pens" rows={penalties} />
          </div>
        )}
      </div>
    </main>
  );
}

function Prize({
  title,
  icon,
  unit,
  rows,
  className = "",
}: {
  title: string;
  icon: string;
  unit: string;
  rows: PrizeRow[];
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-board border border-hairline bg-board ${className}`}>
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <span className="text-xl" aria-hidden>{icon}</span>
        <h2 className="font-display text-base font-bold text-ink">{title}</h2>
        <span className="ml-auto font-board text-[10px] uppercase tracking-widest text-ink-dim">{unit}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-4 font-board text-[11px] uppercase tracking-widest text-ink-dim">No data yet</p>
      ) : (
        <ul className="divide-y divide-hairline/60">
          {rows.map((r, i) => (
            <li key={`${r.player}-${i}`} className={`flex items-center gap-3 px-4 py-2.5 ${i === 0 ? "bg-amber/5" : ""}`}>
              <span className={`w-5 text-center font-board text-xs tabular-nums ${i === 0 ? "text-glory" : "text-ink-dim"}`}>{i + 1}</span>
              <span aria-hidden>{r.flag}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-sm font-semibold text-ink">{r.player}</span>
                <span className="block truncate font-board text-[10px] uppercase tracking-wider text-ink-dim">
                  {r.team}
                  {r.owner && <span className="text-amber"> · {r.owner}</span>}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="font-board text-lg tabular-nums text-amber">{r.value}</span>
                {r.sub && <span className="ml-1 font-board text-[10px] uppercase text-ink-dim">{r.sub}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
