import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/session";
import { setUserStatus, runDrawAction, grantExtraSeat, previewTannoy, postTannoy } from "./actions";
import { DrawForm } from "./DrawForm";
import { TannoyConsole } from "./TannoyConsole";
import { HOUSE_USER } from "@/lib/draw";

export const dynamic = "force-dynamic";

type User = typeof schema.users.$inferSelect;

export default async function AdminPage() {
  const me = await requireAdmin();
  const all = await db.select().from(schema.users).orderBy(asc(schema.users.createdAt));
  const pending = all.filter((u) => u.status === "PENDING");
  const active = all.filter((u) => u.status === "ACTIVE");
  const declined = all.filter((u) => u.status === "DECLINED");

  const [settingsRow] = await db.select().from(schema.settings).limit(1);
  const seatRows = await db.select().from(schema.seats);
  const primaries = seatRows.filter((s) => s.type === "PRIMARY").length;
  const standbys = seatRows.length - primaries;
  const drawn = !!settingsRow?.drawCommittedAt;
  const potGbp = seatRows.reduce((a, s) => a + (s.stakePennies ?? 0), 0) / 100;
  const players = active.filter((u) => u.email !== HOUSE_USER.email);
  const houseUser = all.find((u) => u.email === HOUSE_USER.email);
  const houseSeatCount = houseUser ? seatRows.filter((s) => s.userId === houseUser.id).length : 0;
  const teamCount = (await db.select().from(schema.teams)).length;
  const spareTeams = houseSeatCount + (teamCount - new Set(seatRows.map((s) => s.teamId)).size);
  const unannounced = (
    await db
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(and(eq(schema.matches.status, "FINISHED"), isNull(schema.matches.announcedAt)))
  ).length;
  const slackLive = process.env.WILL_POST_TO_SLACK === "true" && !!process.env.SLACK_WEBHOOK_URL;

  const tiles = [
    { href: "/admin/matches", label: "Score console", desc: "Enter results + auto-fill from a report URL" },
    { href: "/fixtures", label: "Departures board", desc: "Public fixtures + results" },
    { href: "/dev", label: "Dev cockpit", desc: "Seed, draw, simulate" },
  ];

  return (
    <main className="min-h-screen bg-tarmac text-ink">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <header className="border-b border-hairline pb-4">
          <h1 className="font-board text-lg uppercase tracking-[0.3em] text-amber">✈ Gate to Glory · Admin</h1>
          <p className="mt-1 font-board text-[11px] uppercase tracking-[0.25em] text-ink-dim">
            Signed in as {me.name ?? me.email}
          </p>
        </header>

        {/* Gate control — approve / decline check-ins */}
        <section className="mt-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-board text-sm uppercase tracking-[0.3em] text-ink">Gate control</h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-dim">
              {pending.length} awaiting · {active.length} cleared
            </span>
          </div>

          <div className="mt-3 overflow-hidden rounded-board border border-hairline bg-board">
            {pending.length === 0 && (
              <p className="px-5 py-4 font-mono text-xs uppercase tracking-wider text-ink-dim">
                No passengers awaiting clearance.
              </p>
            )}
            {pending.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3 last:border-b-0">
                <PassengerLabel u={u} />
                <div className="flex shrink-0 gap-2">
                  <form action={setUserStatus.bind(null, u.id, "ACTIVE")}>
                    <button className="rounded-md bg-boarding/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-boarding transition hover:bg-boarding/25">
                      Approve
                    </button>
                  </form>
                  <form action={setUserStatus.bind(null, u.id, "DECLINED")}>
                    <button className="rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-dim transition hover:text-cancelled">
                      Decline
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>

          {(active.length > 0 || declined.length > 0) && (
            <details className="mt-3 rounded-board border border-hairline bg-board">
              <summary className="cursor-pointer px-5 py-3 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-dim">
                Cleared & cancelled ({active.length + declined.length})
              </summary>
              <div className="border-t border-hairline">
                {active.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-2.5 last:border-b-0">
                    <PassengerLabel u={u} />
                    <div className="flex shrink-0 items-center gap-2">
                      {u.role === "ADMIN" && (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-amber">Agent</span>
                      )}
                      {u.id !== me.id && (
                        <form action={setUserStatus.bind(null, u.id, "DECLINED")}>
                          <button className="font-mono text-[10px] uppercase tracking-wider text-ink-dim transition hover:text-cancelled">
                            Revoke
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
                {declined.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-2.5 last:border-b-0">
                    <PassengerLabel u={u} dim />
                    <form action={setUserStatus.bind(null, u.id, "ACTIVE")}>
                      <button className="font-mono text-[10px] uppercase tracking-wider text-ink-dim transition hover:text-boarding">
                        Re-approve
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* Tournament control — draw + reveal */}
        <section className="mt-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-board text-sm uppercase tracking-[0.3em] text-ink">Tournament control</h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-dim">
              {drawn ? `${primaries} seats · ${standbys} standby · £${potGbp} pot` : "draw not run"}
            </span>
          </div>
          <div className="mt-3 rounded-board border border-hairline bg-board p-5">
            {!drawn ? (
              <>
                <p className="text-sm text-ink-dim">
                  Run the draw to give every approved player up to the chosen number of teams; any
                  leftovers go to The House (and can be sold on below). Do this once everyone is
                  cleared — it also closes new check-ins.
                </p>
                <div className="mt-4">
                  <DrawForm action={runDrawAction} playerCount={players.length} />
                </div>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
                  {players.length} players ready
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-dim">
                  Draw committed — {primaries} primary seats, {standbys} standby. Launch the reveal on the
                  big screen.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <a
                    href="/reveal/stage"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-amber px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-tarmac transition hover:brightness-110"
                  >
                    ✈ Launch reveal ↗
                  </a>
                </div>
                {players.length > 0 && spareTeams > 0 && (
                  <form
                    action={grantExtraSeat}
                    className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4"
                  >
                    <span className="font-mono text-[11px] uppercase tracking-widest text-ink-dim">
                      Sell spare team · {spareTeams} left:
                    </span>
                    <select
                      name="userId"
                      className="rounded border border-hairline bg-board-raised px-2 py-1.5 text-sm text-ink"
                    >
                      {players.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name ?? u.email}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
                      £
                      <input
                        name="price"
                        type="number"
                        step="0.5"
                        min="0"
                        defaultValue="5"
                        className="w-16 rounded border border-hairline bg-board-raised px-2 py-1.5 text-sm text-ink"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded-md border border-hairline px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-dim transition hover:border-amber/50 hover:text-amber"
                    >
                      + Add team
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </section>

        <TannoyConsole pending={unannounced} live={slackLive} preview={previewTannoy} post={postTannoy} />

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          {tiles.map((t) => (
            <Link key={t.href} href={t.href} className="rounded-board border border-hairline bg-board p-4 transition hover:border-amber/50">
              <div className="font-display text-lg font-bold text-ink">{t.label}</div>
              <div className="mt-1 font-board text-[11px] uppercase tracking-wider text-ink-dim">{t.desc}</div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}

function PassengerLabel({ u, dim }: { u: User; dim?: boolean }) {
  return (
    <div className={`min-w-0 ${dim ? "opacity-60" : ""}`}>
      <p className="truncate font-display text-sm font-semibold text-ink">{u.name ?? u.email}</p>
      <p className="truncate font-mono text-[11px] text-ink-dim">{u.email}</p>
    </div>
  );
}
