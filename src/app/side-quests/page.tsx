import { eq } from "drizzle-orm";
import {
  getPrizes,
  getMainPrizes,
  PRIZES,
  PRIZE_TOTAL,
  type PrizeRow,
  type Finisher,
} from "@/lib/prizes";
import { requireActive } from "@/lib/session";
import { db, schema } from "@/db";
import { HOUSE_USER } from "@/lib/draw";
import { SiteNav } from "@/components/SiteNav";
import { setChampionPick } from "./actions";
import { PickForm } from "./PickForm";

export const dynamic = "force-dynamic";

type Team = typeof schema.teams.$inferSelect;

export default async function PrizesPage() {
  const me = await requireActive();
  const [{ goldenBoot, playmaker, conceded, defence, zinedine, ownGoals }, main, teams, voters] = await Promise.all([
    getPrizes(),
    getMainPrizes(),
    db.select().from(schema.teams),
    db
      .select({ name: schema.users.name, email: schema.users.email, pick: schema.users.championPick })
      .from(schema.users)
      .where(eq(schema.users.status, "ACTIVE")),
  ]);

  const teamByCode = new Map(teams.map((t) => [t.code, t]));
  const byTeam = new Map<string, { team: Team; backers: string[] }>();
  for (const v of voters) {
    if (!v.pick || !v.name || v.email === HOUSE_USER.email) continue;
    const t = teamByCode.get(v.pick);
    if (!t) continue;
    let g = byTeam.get(v.pick);
    if (!g) {
      g = { team: t, backers: [] };
      byTeam.set(v.pick, g);
    }
    g.backers.push(v.name);
  }
  const board = [...byTeam.values()].sort(
    (a, b) => b.backers.length - a.backers.length || a.team.name.localeCompare(b.team.name),
  );
  const totalPicks = board.reduce((n, b) => n + b.backers.length, 0);
  const myPick = me.championPick ? teamByCode.get(me.championPick) : null;
  const teamsByName = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  const mainRows = [
    { label: "Champion", icon: "🏆", blurb: "Own the team that lifts the trophy", prize: PRIZES.champion, who: main.champion },
    { label: "Runner-up", icon: "🥈", blurb: "Own the beaten finalist", prize: PRIZES.runnerUp, who: main.runnerUp },
    { label: "Third", icon: "🥉", blurb: "Own the 3rd-place play-off winner", prize: PRIZES.third, who: main.third },
    { label: "Fourth", icon: "🎖️", blurb: "Own the 4th-placed side", prize: PRIZES.fourth, who: main.fourth },
  ];

  return (
    <main className="min-h-screen bg-runway">
      <SiteNav current="side-quests" user={me} />
      <div className="mx-auto max-w-4xl px-4 py-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4">
          <div>
            <h1 className="font-board text-lg uppercase tracking-[0.3em] text-amber">✈ Prizes</h1>
            <p className="mt-1 font-board text-[11px] uppercase tracking-[0.25em] text-ink-dim">
              Own the right team and the cash is yours
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-extrabold leading-none text-ink">£{PRIZE_TOTAL}</div>
            <div className="font-board text-[10px] uppercase tracking-widest text-ink-dim">total pot</div>
          </div>
        </header>

        {/* Main prizes — the big money */}
        <section className="mt-6">
          <h2 className="font-board text-sm uppercase tracking-[0.3em] text-ink">The big money</h2>
          <div className="mt-3 overflow-hidden rounded-board border border-hairline bg-board">
            {mainRows.map((r) => (
              <div key={r.label} className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-0">
                <span className="text-xl" aria-hidden>{r.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm font-semibold text-ink">{r.label}</div>
                  <div className="truncate font-board text-[10px] uppercase tracking-wider text-ink-dim">{r.blurb}</div>
                </div>
                <Holder who={r.who} />
                <span className="w-14 shrink-0 text-right font-board text-lg tabular-nums text-amber">£{r.prize}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Crystal Ball — silly fun, no money, just bragging rights */}
        <section className="mt-6 overflow-hidden rounded-board border border-hairline bg-board">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-hairline px-4 py-3">
            <span className="text-xl" aria-hidden>🔮</span>
            <h2 className="font-display text-base font-bold text-ink">Crystal Ball</h2>
            <span className="font-board text-[10px] uppercase tracking-widest text-ink-dim">
              who lifts the trophy? · no money, pure bragging rights
            </span>
            <span className="ml-auto font-board text-[10px] uppercase tracking-widest text-ink-dim">
              {totalPicks} {totalPicks === 1 ? "call" : "calls"}
            </span>
          </div>

          {me.championPick ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-4">
              <span className="font-board text-[11px] uppercase tracking-widest text-ink-dim">Your call</span>
              <span className="font-display text-sm font-semibold text-ink">
                {myPick?.flagEmoji} {myPick?.name ?? me.championPick}
                {myPick?.eliminated && <span className="text-cancelled"> · busted</span>}
              </span>
              <span className="font-board text-[10px] uppercase tracking-widest text-amber">🔒 Locked in</span>
            </div>
          ) : (
            <PickForm
              action={setChampionPick}
              teams={teamsByName.map((t) => ({ code: t.code, name: t.name, flag: t.flagEmoji ?? "" }))}
            />
          )}

          {board.length === 0 ? (
            <p className="px-4 py-4 font-board text-[11px] uppercase tracking-widest text-ink-dim">
              No calls yet — be the first to back a winner.
            </p>
          ) : (
            <ul className="max-h-72 divide-y divide-hairline/60 overflow-y-auto overscroll-contain">
              {board.map(({ team, backers }, i) => (
                <li key={team.code} className={`flex items-center gap-3 px-4 py-2.5 ${i === 0 ? "bg-amber/5" : ""}`}>
                  <span className={team.eliminated ? "opacity-40 grayscale" : ""} aria-hidden>
                    {team.flagEmoji}
                  </span>
                  <span
                    className={`shrink-0 font-display text-sm font-semibold ${
                      team.eliminated ? "text-cancelled line-through decoration-2" : "text-ink"
                    }`}
                  >
                    {team.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-right font-board text-[10px] uppercase tracking-wider text-ink-dim">
                    {backers.join(", ")}
                  </span>
                  <span className="shrink-0 font-board text-lg tabular-nums text-amber">{backers.length}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Bonus prizes — always shown so everyone knows what they are */}
        <section className="mt-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-board text-sm uppercase tracking-[0.3em] text-ink">Bonus prizes</h2>
            <span className="font-board text-[10px] uppercase tracking-widest text-ink-dim">
              the owner of each leader takes the pot
            </span>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Prize
              title="Welcome Aboard"
              icon="🚪"
              prize={PRIZES.conceded}
              blurb="Most goals conceded — they let absolutely anyone in."
              rows={conceded}
            />
            <Prize
              title="Border Control"
              icon="🛂"
              prize={PRIZES.defence}
              blurb="Fewest goals conceded per game played — fair on early casualties."
              rows={defence}
            />
            <Prize
              title="Friendly Fire"
              icon="🤦"
              prize={PRIZES.ownGoals}
              blurb="Most own goals — keep finding their own net."
              rows={ownGoals}
            />
            <Prize
              title="The Zinedine"
              icon="🟥"
              prize={PRIZES.zinedine}
              blurb="Most yellow and red cards — the headbutt memorial trophy."
              rows={zinedine}
            />
            <Prize
              title="Golden Boot"
              icon="🥾"
              prize={PRIZES.goldenBoot}
              blurb="Own the team of the tournament's top scorer."
              rows={goldenBoot}
            />
            <Prize
              title="Playmaker"
              icon="🅰️"
              prize={PRIZES.playmaker}
              blurb="Own the team of the assist king."
              rows={playmaker}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function Holder({ who }: { who: Finisher }) {
  if (!who) {
    return <span className="font-board text-[10px] uppercase tracking-widest text-ink-dim">TBD</span>;
  }
  return (
    <span className="hidden truncate text-right font-display text-sm text-ink sm:inline">
      {who.flag} {who.owner ?? "—"}
    </span>
  );
}

function Prize({
  title,
  icon,
  prize,
  blurb,
  rows,
  className = "",
}: {
  title: string;
  icon: string;
  prize: number;
  blurb: string;
  rows: PrizeRow[];
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-board border border-hairline bg-board ${className}`}>
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <span className="text-xl" aria-hidden>{icon}</span>
        <h3 className="font-display text-base font-bold text-ink">{title}</h3>
        <span className="ml-auto font-board text-lg tabular-nums text-amber">£{prize}</span>
      </div>
      <p className="border-b border-hairline px-4 py-2 font-board text-[10px] uppercase tracking-wider text-ink-dim">
        {blurb}
      </p>
      {rows.length === 0 ? (
        <p className="px-4 py-4 font-board text-[11px] uppercase tracking-widest text-ink-dim">
          Lights up as results come in
        </p>
      ) : (
        // max-h cuts the ~5th row in half on purpose — the peek says "scroll for more"
        <ul className="max-h-60 divide-y divide-hairline/60 overflow-y-auto overscroll-contain">
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
