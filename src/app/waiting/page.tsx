import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { signOutAction } from "@/lib/auth-actions";
import { db, schema } from "@/db";

export const dynamic = "force-dynamic";

export default async function WaitingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.status === "ACTIVE") redirect("/fixtures");
  if (user.status === "DECLINED") redirect("/declined");

  const [cfg] = await db.select().from(schema.settings).limit(1);
  const closed = !!cfg?.drawCommittedAt; // check-in closes once the draw is committed

  return (
    <main className="bg-runway flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 font-mono text-sm tracking-[0.3em] text-amber">
          <span aria-hidden>✈</span> GATE TO GLORY
        </div>

        <div className="overflow-hidden rounded-board border border-hairline bg-board">
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber">
              Boarding pass · Standby
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-dim">Seq —</span>
          </div>

          <div className="px-5 py-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-dim">Passenger</p>
            <p className="mt-1 font-display text-2xl font-bold text-ink">{user.name ?? user.email}</p>
            <p className="mt-0.5 font-mono text-xs text-ink-dim">{user.email}</p>

            {closed ? (
              <div className="mt-6 rounded-lg border border-cancelled/30 bg-cancelled/5 px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cancelled">Status</p>
                <p className="mt-1 font-board text-xl uppercase tracking-[0.2em] text-cancelled">
                  Check-in closed
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-dim">
                  The draw has already taken place, so check-in for this sweepstake is closed. If you
                  think you should be in it, have a word with the organiser.
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-amber/30 bg-amber/5 px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber">Status</p>
                <p className="mt-1 font-board text-xl uppercase tracking-[0.2em] text-amber">
                  Awaiting clearance
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-dim">
                  You&apos;re checked in and on the standby list. A gate agent needs to approve you
                  before the draw — you&apos;ll get your team in the big reveal once you&apos;re cleared.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-hairline px-5 py-3">
            <a
              href="/waiting"
              className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-dim transition hover:text-ink"
            >
              ⟳ Refresh status
            </a>
            <form action={signOutAction}>
              <button
                type="submit"
                className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-dim transition hover:text-cancelled"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.3em] text-ink-dim">
          {closed ? "This flight has departed" : "Please remain in the departure lounge"}
        </p>
      </div>
    </main>
  );
}
