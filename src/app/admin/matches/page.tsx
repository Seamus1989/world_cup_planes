import Link from "next/link";
import { getBoardFixtures } from "@/lib/board";
import { requireAdmin } from "@/lib/session";
import { SyncPanel } from "./SyncPanel";

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

export default async function AdminMatchesPage() {
  await requireAdmin();
  const fixtures = await getBoardFixtures();

  return (
    <main className="min-h-screen bg-tarmac text-ink">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <header className="flex items-center justify-between border-b border-hairline pb-4">
          <h1 className="font-board text-lg uppercase tracking-[0.3em] text-amber">✈ Score console</h1>
          <Link href="/admin" className="font-board text-[11px] uppercase tracking-widest text-ink-dim transition hover:text-amber">
            Admin
          </Link>
        </header>

        <SyncPanel />

        {fixtures.length === 0 ? (
          <p className="mt-16 text-center font-board text-sm uppercase tracking-[0.3em] text-ink-dim">
            No fixtures · seed them in /dev
          </p>
        ) : (
          <ul className="mt-4 overflow-hidden rounded-board border border-hairline bg-board">
            {fixtures.map((m) => {
              const done = m.status === "FINISHED";
              return (
                <li key={m.id}>
                  <Link
                    href={`/admin/matches/${m.id}`}
                    className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-hairline/70 px-4 py-3 transition last:border-0 hover:bg-board-raised"
                  >
                    <span className="w-28 font-board text-[11px] text-ink-dim">{fmt.format(m.kickoffUtc)}</span>
                    <span className="truncate">
                      {m.home?.flag} {m.home?.name} <span className="text-ink-dim">v</span> {m.away?.name} {m.away?.flag}
                    </span>
                    <span className="font-board tabular-nums text-ink">
                      {done ? `${m.homeScore ?? 0}–${m.awayScore ?? 0}` : <span className="text-ink-dim">—</span>}
                    </span>
                    <span className={`font-board text-[10px] uppercase tracking-wider ${done ? "text-boarding" : "text-amber"}`}>
                      {done ? "FT" : "Enter ›"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
