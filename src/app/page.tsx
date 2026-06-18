import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { signInWithGoogle } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

const PREVIEW_BOARD = [
  { player: "SEAMUS", team: "IRAQ", gate: "C12", status: "ON TIME", tone: "boarding" },
  { player: "PAUL", team: "ENGLAND", gate: "C09", status: "BOARDING", tone: "amber" },
  { player: "PRIYA", team: "ARGENTINA", gate: "A04", status: "ON TIME", tone: "boarding" },
  { player: "DAVE", team: "BRAZIL", gate: "F21", status: "CANCELLED", tone: "cancelled" },
] as const;

const toneClass: Record<string, string> = {
  boarding: "text-boarding",
  amber: "text-amber",
  cancelled: "text-cancelled line-through decoration-2",
};

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    if (user.status === "ACTIVE") redirect("/lounge");
    if (user.status === "PENDING") redirect("/waiting");
    if (user.status === "DECLINED") redirect("/declined");
  }

  return (
    <main className="bg-runway min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2 font-mono text-sm tracking-[0.3em] text-amber">
            <span aria-hidden>✈</span> GATE TO GLORY
          </div>
          <div className="font-mono text-xs uppercase tracking-[0.25em] text-ink-dim">
            Planes · World Cup 2026
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16">
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-amber/80">
            Now boarding
          </p>
          <h1 className="mt-4 font-display text-6xl font-bold leading-[0.95] tracking-tight text-ink sm:text-7xl">
            48 teams.
            <br />
            One <span className="text-amber">gate to glory.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-dim">
            The Planes office sweepstake for the 2026 World Cup. Check in with Google, get
            drawn a team in the big reveal, then watch the tournament unfold with your flights
            front and centre.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <form action={signInWithGoogle}>
              <button
                type="submit"
                className="inline-flex items-center gap-3 rounded-xl bg-amber px-6 py-3.5 font-mono text-sm font-semibold uppercase tracking-wider text-tarmac transition hover:brightness-110"
              >
                <GoogleMark />
                Check in with Google
              </button>
            </form>
            <span className="font-mono text-xs uppercase tracking-widest text-ink-dim">
              Approval required · £5 a seat
            </span>
          </div>
        </section>

        <section className="pb-12">
          <div className="overflow-hidden rounded-board border border-hairline bg-board">
            <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber">
                Departures
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-dim">
                Gate · Status
              </span>
            </div>
            <ul className="divide-y divide-hairline">
              {PREVIEW_BOARD.map((row) => (
                <li
                  key={row.player}
                  className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 px-5 py-3.5 font-mono"
                >
                  <span className="text-sm tracking-widest text-ink-dim">{row.player}</span>
                  <span className="text-base tracking-[0.2em] text-ink">{row.team}</span>
                  <span className="flex items-center gap-4 text-sm">
                    <span className="tabular-nums text-ink-dim">{row.gate}</span>
                    <span className={`w-28 text-right tracking-widest ${toneClass[row.tone]}`}>
                      {row.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-[0.3em] text-ink-dim">
            Get knocked out and your flight is cancelled
          </p>
        </section>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}
