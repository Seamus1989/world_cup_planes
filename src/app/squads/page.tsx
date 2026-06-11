import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireActive } from "@/lib/session";
import { SiteNav } from "@/components/SiteNav";

export const dynamic = "force-dynamic";

type Squad = {
  userId: string;
  name: string;
  image: string | null;
  teams: { name: string; flag: string; group: string | null; standby: boolean; multiplier: number; eliminated: boolean }[];
};

export default async function SquadsPage() {
  const me = await requireActive();

  const rows = await db
    .select({
      userId: schema.seats.userId,
      name: schema.users.name,
      image: schema.users.image,
      type: schema.seats.type,
      multiplier: schema.seats.multiplier,
      teamName: schema.teams.name,
      flag: schema.teams.flagEmoji,
      group: schema.teams.groupLetter,
      eliminated: schema.teams.eliminated,
    })
    .from(schema.seats)
    .innerJoin(schema.users, eq(schema.users.id, schema.seats.userId))
    .innerJoin(schema.teams, eq(schema.teams.id, schema.seats.teamId))
    .orderBy(asc(schema.seats.revealOrder));

  const byUser = new Map<string, Squad>();
  for (const r of rows) {
    let s = byUser.get(r.userId);
    if (!s) {
      s = { userId: r.userId, name: r.name ?? "Player", image: r.image, teams: [] };
      byUser.set(r.userId, s);
    }
    s.teams.push({
      name: r.teamName,
      flag: r.flag ?? "",
      group: r.group,
      standby: r.type === "STANDBY",
      multiplier: r.multiplier,
      eliminated: r.eliminated,
    });
  }

  const squads = [...byUser.values()].sort((a, b) => {
    const aAlive = a.teams.filter((t) => !t.eliminated).length;
    const bAlive = b.teams.filter((t) => !t.eliminated).length;
    return bAlive - aAlive || b.teams.length - a.teams.length || a.name.localeCompare(b.name);
  });

  return (
    <main className="min-h-screen bg-tarmac text-ink">
      <SiteNav current="squads" user={me} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <header className="border-b border-hairline pb-4">
          <h1 className="font-board text-lg uppercase tracking-[0.3em] text-amber">✈ Squads</h1>
          <p className="mt-1 font-board text-[11px] uppercase tracking-[0.25em] text-ink-dim">
            Who&apos;s flying who · {squads.length} passengers
          </p>
        </header>

        {squads.length === 0 ? (
          <p className="mt-16 text-center font-board text-sm uppercase tracking-[0.3em] text-ink-dim">
            No teams assigned yet · the draw hasn&apos;t been run
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {squads.map((s) => {
              const alive = s.teams.filter((t) => !t.eliminated).length;
              const isMe = s.userId === me.id;
              return (
                <section
                  key={s.userId}
                  className={`overflow-hidden rounded-board border bg-board ${
                    isMe ? "border-amber/50" : "border-hairline"
                  }`}
                >
                  <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
                    {s.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt="" className="h-8 w-8 rounded-full border border-hairline" />
                    )}
                    <span className="flex-1 truncate font-display text-sm font-semibold text-ink">
                      {s.name}
                      {isMe && <span className="ml-1 text-amber">★</span>}
                    </span>
                    <span className="font-board text-[10px] uppercase tracking-widest">
                      <span className={alive > 0 ? "text-boarding" : "text-cancelled"}>{alive}</span>
                      <span className="text-ink-dim">/{s.teams.length}</span>
                    </span>
                  </div>
                  <ul className="divide-y divide-hairline/60">
                    {s.teams.map((t, i) => (
                      <li key={i} className="flex items-center gap-2 px-4 py-2 text-sm">
                        <span className={t.eliminated ? "opacity-40 grayscale" : ""} aria-hidden>
                          {t.flag}
                        </span>
                        <span
                          className={`flex-1 truncate font-display ${
                            t.eliminated ? "text-cancelled line-through decoration-2" : "text-ink"
                          }`}
                        >
                          {t.name}
                        </span>
                        {t.standby && (
                          <span className="font-board text-[9px] uppercase tracking-wider text-amber">
                            ✦ ×{t.multiplier}
                          </span>
                        )}
                        <span className="font-board text-[10px] uppercase tracking-widest text-ink-dim">
                          {t.group ?? ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
