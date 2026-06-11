import { getBracket, type BracketMatch, type BracketTeam } from "@/lib/bracket";
import { requireActive } from "@/lib/session";
import { SiteNav } from "@/components/SiteNav";

export const dynamic = "force-dynamic";

export default async function BracketPage() {
  const me = await requireActive();
  const rounds = await getBracket();
  const byKey = new Map<string, BracketMatch>();
  for (const r of rounds) for (const m of r.matches) byKey.set(`${m.stage}-${m.index}`, m);
  const get = (stage: string, index: number) => byKey.get(`${stage}-${index}`);
  const hasKO = rounds.length > 0;

  return (
    <main className="min-h-screen bg-tarmac text-ink">
      <SiteNav current="knockout" user={me} />
      <div className="mx-auto max-w-[1500px] px-4 py-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4">
          <div>
            <h1 className="font-board text-lg uppercase tracking-[0.3em] text-amber">✈ Knockout bracket</h1>
            <p className="mt-1 font-board text-[11px] uppercase tracking-[0.25em] text-ink-dim">
              Last team flying wins the Duty Free
            </p>
          </div>
        </header>

        {!hasKO ? (
          <p className="mt-16 text-center font-board text-sm uppercase tracking-[0.3em] text-ink-dim">
            Bracket not set up yet · seed it in /dev
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto pb-4">
            <div className="flex h-[40rem] min-w-[1340px] items-stretch">
              {/* LEFT half — flows inward to the right */}
              <RoundCol label="R32" stage="R32" indices={[1, 2, 3, 4, 5, 6, 7, 8]} side="left" hasChildren={false} get={get} />
              <RoundCol label="R16" stage="R16" indices={[1, 2, 3, 4]} side="left" hasChildren get={get} />
              <RoundCol label="QF" stage="QF" indices={[1, 2]} side="left" hasChildren get={get} />
              <RoundCol label="SF" stage="SF" indices={[1]} side="left" hasChildren get={get} />

              {/* CENTRE — the Final + 3rd place */}
              <Centre final={get("FINAL", 1)} third={get("THIRD", 1)} />

              {/* RIGHT half — mirrored, flows inward to the left */}
              <RoundCol label="SF" stage="SF" indices={[2]} side="right" hasChildren get={get} />
              <RoundCol label="QF" stage="QF" indices={[3, 4]} side="right" hasChildren get={get} />
              <RoundCol label="R16" stage="R16" indices={[5, 6, 7, 8]} side="right" hasChildren get={get} />
              <RoundCol label="R32" stage="R32" indices={[9, 10, 11, 12, 13, 14, 15, 16]} side="right" hasChildren={false} get={get} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function RoundCol({
  label,
  stage,
  indices,
  side,
  hasChildren,
  get,
}: {
  label: string;
  stage: string;
  indices: number[];
  side: "left" | "right";
  hasChildren?: boolean;
  get: (s: string, i: number) => BracketMatch | undefined;
}) {
  return (
    <div className="flex w-[150px] shrink-0 flex-col">
      <div className={`mb-1 font-board text-[10px] uppercase tracking-[0.2em] text-ink-dim ${side === "right" ? "text-right" : "text-left"} px-2`}>
        {label}
      </div>
      <div className="flex flex-1 flex-col">
        {indices.map((i) => (
          <Cell key={`${stage}-${i}`} m={get(stage, i)} side={side} hasChildren={!!hasChildren} />
        ))}
      </div>
    </div>
  );
}

function Cell({ m, side, hasChildren }: { m: BracketMatch | undefined; side: "left" | "right"; hasChildren: boolean }) {
  const left = side === "left";
  return (
    <div className="relative flex flex-1 items-center px-3">
      {/* connector to children */}
      {hasChildren && (
        <>
          <div className={`absolute top-1/4 h-1/2 w-px bg-hairline ${left ? "left-0" : "right-0"}`} />
          <div className={`absolute top-1/2 h-px w-3 bg-hairline ${left ? "left-0" : "right-0"}`} />
        </>
      )}
      {/* connector toward parent (centre-ward) */}
      <div className={`absolute top-1/2 h-px w-3 bg-hairline ${left ? "right-0" : "left-0"}`} />
      <MatchBox m={m} />
    </div>
  );
}

function Centre({ final, third }: { final: BracketMatch | undefined; third: BracketMatch | undefined }) {
  return (
    <div className="flex w-[190px] shrink-0 flex-col items-center justify-center gap-4 px-2">
      <div className="text-3xl" aria-hidden>🏆</div>
      <div className="w-full">
        <div className="mb-1 text-center font-board text-[10px] uppercase tracking-[0.3em] text-glory">Final</div>
        <div className="rounded-board border border-glory/60 bg-board shadow-[0_0_28px_-8px_var(--color-glory)]">
          <MatchBox m={final} big />
        </div>
      </div>
      {third && (
        <div className="w-full opacity-80">
          <div className="mb-1 text-center font-board text-[9px] uppercase tracking-[0.25em] text-ink-dim">3rd place</div>
          <div className="rounded border border-hairline bg-board">
            <MatchBox m={third} />
          </div>
        </div>
      )}
    </div>
  );
}

function MatchBox({ m, big }: { m: BracketMatch | undefined; big?: boolean }) {
  if (!m) {
    return (
      <div className="w-full rounded border border-dashed border-hairline/60 bg-board/40 px-2 py-3 text-center font-board text-[10px] uppercase tracking-wider text-ink-dim">
        TBD
      </div>
    );
  }
  return (
    <div className={`w-full overflow-hidden rounded border bg-board ${big ? "border-transparent" : "border-hairline"}`}>
      <Side team={m.home} label={m.homeLabel} score={m.homeScore} pens={m.homePens} winner={!!m.winnerTeamId && m.winnerTeamId === m.homeTeamId} big={big} />
      <div className="h-px bg-hairline/70" />
      <Side team={m.away} label={m.awayLabel} score={m.awayScore} pens={m.awayPens} winner={!!m.winnerTeamId && m.winnerTeamId === m.awayTeamId} big={big} />
    </div>
  );
}

function Side({
  team,
  label,
  score,
  pens,
  winner,
  big,
}: {
  team: BracketTeam;
  label: string | null;
  score: number | null;
  pens: number | null;
  winner: boolean;
  big?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 px-2 ${big ? "py-2" : "py-1.5"} ${winner ? "bg-amber/10" : ""}`}>
      {team ? (
        <>
          <span className="text-sm" aria-hidden>{team.flag}</span>
          <span className={`min-w-0 flex-1 truncate font-display font-semibold ${big ? "text-sm" : "text-[11px]"} ${winner ? "text-amber" : "text-ink"}`}>
            {team.name}
          </span>
        </>
      ) : (
        <span className="flex-1 truncate font-board text-[9px] uppercase tracking-wider text-ink-dim">{label ?? "TBD"}</span>
      )}
      <span className={`font-board tabular-nums ${big ? "text-sm" : "text-[11px]"} ${winner ? "text-amber" : "text-ink-dim"}`}>
        {score ?? ""}
        {pens != null && <span className="ml-0.5 text-[9px] text-ink-dim">({pens})</span>}
      </span>
    </div>
  );
}
