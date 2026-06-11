import { notFound } from "next/navigation";
import { getStateSummary } from "@/lib/dev";
import { getCurrentUser } from "@/lib/session";
import { isLocalPglite } from "@/db";
import * as actions from "./actions";

export const dynamic = "force-dynamic";

export default async function DevPage() {
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_DEV_TOOLS) {
    notFound();
  }

  const [state, me] = await Promise.all([getStateSummary(), getCurrentUser()]);
  const c = state.counts;

  return (
    <main className="min-h-screen bg-tarmac px-6 py-8 font-mono text-ink">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4">
          <div>
            <h1 className="text-lg tracking-[0.3em] text-amber">✈ GATE TO GLORY · DEV COCKPIT</h1>
            <p className="mt-1 text-xs text-ink-dim">
              Auth-bypass test harness · {isLocalPglite ? "embedded PGlite DB" : "Neon Postgres"} ·{" "}
              {state.drawCommittedAt ? "draw committed" : "draw not run"} ·{" "}
              {state.standbyOpen ? "standby open" : "standby closed"}
            </p>
          </div>
          <div className="text-right text-xs">
            {me ? (
              <span className="text-boarding">
                Logged in as {me.name ?? me.email} ({me.role})
              </span>
            ) : (
              <span className="text-ink-dim">Not logged in</span>
            )}
            <form action={actions.actLogout} className="mt-1">
              <button className="text-ink-dim underline hover:text-ink" type="submit">
                log out
              </button>
            </form>
          </div>
        </header>

        <nav className="mt-3 flex flex-wrap gap-4 font-board text-xs uppercase tracking-widest text-ink-dim">
          <a className="transition hover:text-amber" href="/fixtures">→ Fixtures</a>
          <a className="transition hover:text-amber" href="/group-stage">→ Group Stage</a>
          <a className="transition hover:text-amber" href="/knockout">→ Knockout</a>
          <a className="transition hover:text-amber" href="/side-quests">→ Side Quests</a>
          <a className="transition hover:text-amber" href="/lounge">→ Lounge</a>
          <a className="transition hover:text-amber" href="/admin/matches">→ Score console</a>
          <a className="transition hover:text-amber" href="/reveal/stage">→ Reveal</a>
        </nav>

        {/* stats */}
        <section className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-board border border-hairline bg-hairline sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Users" value={c.users} sub={`${c.active} active · ${c.pending} pending`} />
          <Stat label="Teams" value={c.teams} sub={`${c.teamsAvailable} free`} />
          <Stat label="Eliminated" value={c.teamsEliminated} sub="flights cancelled" />
          <Stat label="Seats" value={c.seats} sub={`${c.primarySeats} primary`} />
          <Stat label="Standby" value={c.standbySeats} sub="bonus seats" />
          <Stat label="Pot" value={`£${c.potGbp}`} sub={`${c.paidSeats} paid seats`} />
        </section>

        {/* controls */}
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Panel title="1 · Seed">
            <Btn action={actions.actSeedTeams}>Seed 48 teams</Btn>
            <form action={actions.actSeedUsers} className="flex gap-2">
              <input
                name="n"
                type="number"
                defaultValue={20}
                min={1}
                max={60}
                className="w-20 rounded border border-hairline bg-board-raised px-2 py-2 text-sm"
              />
              <button className={btn} type="submit">Seed random users</button>
            </form>
          </Panel>

          <Panel title="2 · Draw">
            <Btn action={actions.actRunDraw}>Run primary draw (one each)</Btn>
            <Btn action={actions.actStandby}>Open standby + draw leftovers</Btn>
          </Panel>

          <Panel title="3 · Simulate / reset">
            <form action={actions.actEliminate} className="flex gap-2">
              <input
                name="k"
                type="number"
                defaultValue={4}
                min={1}
                max={48}
                className="w-20 rounded border border-hairline bg-board-raised px-2 py-2 text-sm"
              />
              <button className={btn} type="submit">Eliminate N teams</button>
            </form>
            <Btn action={actions.actReset} danger>
              Reset everything
            </Btn>
          </Panel>

          <Panel title="4 · Match data">
            <Btn action={actions.actSeedFixtures}>Seed 72 fixtures</Btn>
            <form action={actions.actSimulate} className="flex gap-2">
              <input
                name="k"
                type="number"
                defaultValue={12}
                min={1}
                max={72}
                className="w-20 rounded border border-hairline bg-board-raised px-2 py-2 text-sm"
              />
              <button className={btn} type="submit">Simulate results</button>
            </form>
            <Btn action={actions.actSeedKnockout}>Seed knockout bracket</Btn>
            <Btn action={actions.actAutofillR32}>Auto-fill R32 from standings</Btn>
          </Panel>
        </section>

        {/* login-as */}
        <section className="mt-6 rounded-board border border-hairline bg-board p-4">
          <h2 className="text-xs uppercase tracking-[0.3em] text-amber">Login as (auth bypass)</h2>
          <form action={actions.actLoginAs} className="mt-3 flex flex-wrap gap-2">
            <select
              name="userId"
              className="min-w-56 rounded border border-hairline bg-board-raised px-2 py-2 text-sm"
            >
              {state.roster.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role} · {u.teams.length} team(s)
                </option>
              ))}
            </select>
            <button className={btn} type="submit">Login</button>
          </form>
        </section>

        {/* roster */}
        <section className="mt-6 overflow-hidden rounded-board border border-hairline bg-board">
          <div className="border-b border-hairline px-4 py-3 text-xs uppercase tracking-[0.3em] text-amber">
            Roster · {state.roster.length}
          </div>
          <ul className="divide-y divide-hairline">
            {state.roster.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="w-44 shrink-0 truncate">
                  {u.name}
                  {u.role === "ADMIN" && <span className="ml-1 text-amber">★</span>}
                  {u.status === "PENDING" && (
                    <span className="ml-1 text-delayed">·pending</span>
                  )}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {u.teams.length === 0 ? (
                    <span className="text-ink-dim">—</span>
                  ) : (
                    u.teams.map((t, i) => (
                      <span
                        key={i}
                        className={`rounded border px-2 py-0.5 text-xs ${
                          t.eliminated
                            ? "border-cancelled/40 text-cancelled line-through"
                            : "border-hairline text-ink"
                        }`}
                        title={t.type === "STANDBY" ? `Standby ×${t.multiplier}` : "Primary"}
                      >
                        {t.flag} {t.name}
                        {t.type === "STANDBY" && <span className="text-amber"> ✦</span>}
                        {t.paid && <span className="text-boarding"> £</span>}
                      </span>
                    ))
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

const btn =
  "rounded bg-amber px-3 py-2 text-sm font-semibold text-tarmac transition hover:brightness-110";

function Btn({
  action,
  children,
  danger,
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        className={
          danger
            ? "w-full rounded border border-cancelled/50 px-3 py-2 text-sm text-cancelled transition hover:bg-cancelled/10"
            : `w-full ${btn}`
        }
      >
        {children}
      </button>
    </form>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-board border border-hairline bg-board p-4">
      <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-amber">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-board px-4 py-3">
      <div className="text-2xl tabular-nums text-ink">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-ink-dim">{label}</div>
      {sub && <div className="mt-0.5 text-[10px] text-ink-dim">{sub}</div>}
    </div>
  );
}
