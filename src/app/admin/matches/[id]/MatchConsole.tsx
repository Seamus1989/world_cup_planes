"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { runExtract, searchResult, saveMatch, type DraftEvent } from "./actions";

const EVENT_TYPES = ["GOAL", "PENALTY_GOAL", "OWN_GOAL"] as const;

type TeamOpt = { id: string; name: string; flag: string };
type MatchInfo = {
  id: string;
  group: string | null;
  isKnockout: boolean;
  homeLabel: string | null;
  awayLabel: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
};

const inputCls =
  "rounded border border-hairline bg-board-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-amber/60";

export function MatchConsole({
  match,
  allTeams,
  initial,
  defaultUrl,
}: {
  match: MatchInfo;
  allTeams: TeamOpt[];
  initial: {
    homeScore: number | null;
    awayScore: number | null;
    homePens: number | null;
    awayPens: number | null;
    status: string;
    events: DraftEvent[];
  };
  defaultUrl: string;
}) {
  const [url, setUrl] = useState(defaultUrl);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [homeTeamId, setHomeTeamId] = useState<string | null>(match.homeTeamId);
  const [awayTeamId, setAwayTeamId] = useState<string | null>(match.awayTeamId);
  const [home, setHome] = useState<string>(initial.homeScore?.toString() ?? "");
  const [away, setAway] = useState<string>(initial.awayScore?.toString() ?? "");
  const [homePens, setHomePens] = useState<string>(initial.homePens?.toString() ?? "");
  const [awayPens, setAwayPens] = useState<string>(initial.awayPens?.toString() ?? "");
  const [status, setStatus] = useState(initial.status);
  const [events, setEvents] = useState<DraftEvent[]>(initial.events);
  const [summary, setSummary] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: string; text: string } | null>(null);
  const [pending, start] = useTransition();

  const byId = new Map(allTeams.map((t) => [t.id, t]));
  const homeT = homeTeamId ? byId.get(homeTeamId) : null;
  const awayT = awayTeamId ? byId.get(awayTeamId) : null;
  const homeName = homeT?.name ?? match.homeLabel ?? "Home";
  const awayName = awayT?.name ?? match.awayLabel ?? "Away";

  function applyResult(r: Awaited<ReturnType<typeof runExtract>>) {
    if (r.error) return setNotice({ kind: "error", text: r.error });
    if (!r.found) {
      setSummary(r.summary);
      return setNotice({ kind: "error", text: r.summary || "Couldn't find this result." });
    }
    setHome(r.homeScore?.toString() ?? "");
    setAway(r.awayScore?.toString() ?? "");
    setStatus(r.status);
    setEvents(r.events.map((e) => ({ team: e.team, type: e.type, player: e.player, minute: e.minute })));
    setHomePens(r.shootout ? String(r.shootout.home) : "");
    setAwayPens(r.shootout ? String(r.shootout.away) : "");
    setSourceUrl(r.sourceUrl);
    setSummary(r.summary);
    setNotice(
      r.mock
        ? { kind: "mock", text: "Mock data (no AI key) — real extraction kicks in once AI_GATEWAY_API_KEY is set" }
        : { kind: "info", text: "Filled in — review & save" },
    );
  }

  function applySearch() {
    setNotice({ kind: "info", text: "Searching the web…" });
    start(async () => {
      applyResult(await searchResult(match.id));
    });
  }

  function applyExtract() {
    if (!url.trim()) {
      setNotice({ kind: "error", text: "Paste a match-report URL first" });
      return;
    }
    setNotice(null);
    start(async () => {
      applyResult(await runExtract(match.id, url.trim()));
    });
  }

  function save() {
    setNotice(null);
    start(async () => {
      const r = await saveMatch(match.id, {
        homeScore: home === "" ? null : Number(home),
        awayScore: away === "" ? null : Number(away),
        homePens: homePens === "" ? null : Number(homePens),
        awayPens: awayPens === "" ? null : Number(awayPens),
        status,
        sourceUrl: sourceUrl ?? undefined,
        homeTeamId,
        awayTeamId,
        events,
      });
      setNotice(r.ok ? { kind: "ok", text: `Saved · ${r.saved} events` } : { kind: "error", text: "Save failed" });
    });
  }

  const setEv = (i: number, patch: Partial<DraftEvent>) =>
    setEvents((evs) => evs.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const noticeTone =
    notice?.kind === "error" ? "border-cancelled/50 text-cancelled"
      : notice?.kind === "ok" ? "border-boarding/50 text-boarding"
        : notice?.kind === "mock" ? "border-delayed/50 text-delayed"
          : "border-amber/50 text-amber";

  return (
    <main className="min-h-screen bg-tarmac text-ink">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <nav className="font-board text-[11px] uppercase tracking-widest text-ink-dim">
          <Link href="/admin/matches" className="transition hover:text-amber">← All fixtures</Link>
        </nav>

        <header className="mt-3 flex items-center justify-between gap-3 border-b border-hairline pb-4">
          {match.isKnockout ? (
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <TeamPicker value={homeTeamId} onChange={setHomeTeamId} label={match.homeLabel} teams={allTeams} />
              <span className="text-ink-dim">v</span>
              <TeamPicker value={awayTeamId} onChange={setAwayTeamId} label={match.awayLabel} teams={allTeams} />
            </div>
          ) : (
            <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <span aria-hidden>{homeT?.flag}</span> {homeName}
              <span className="px-1 text-ink-dim">v</span>
              {awayName} <span aria-hidden>{awayT?.flag}</span>
            </h1>
          )}
          <span className="shrink-0 font-board text-xs uppercase tracking-widest text-ink-dim">
            {match.isKnockout ? "Knockout" : `Grp ${match.group ?? "?"}`}
          </span>
        </header>

        <section className="mt-5 rounded-board border border-hairline bg-board p-4">
          <h2 className="font-board text-[11px] uppercase tracking-[0.3em] text-amber">Auto-fill the result</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={applySearch} disabled={pending} className="rounded bg-amber px-4 py-1.5 font-board text-sm font-semibold text-tarmac transition hover:brightness-110 disabled:opacity-50">
              {pending ? "Working…" : "🔎 Fetch result (web)"}
            </button>
            <span className="font-board text-[11px] uppercase tracking-widest text-ink-dim">searches the live web · no URL needed</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-hairline/60 pt-3">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…or paste a report URL" className={`${inputCls} min-w-64 flex-1`} />
            <button onClick={applyExtract} disabled={pending} className="rounded border border-hairline px-4 py-1.5 font-board text-sm transition hover:border-amber/50 disabled:opacity-50">
              {pending ? "Working…" : "Fetch from URL"}
            </button>
          </div>
          {sourceUrl && (
            <p className="mt-2 truncate font-board text-[11px] text-ink-dim">
              Source: <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-amber underline">{sourceUrl}</a>
            </p>
          )}
          {summary && <p className="mt-1 text-sm text-ink-dim">{summary}</p>}
          {notice && <p className={`mt-2 rounded border px-3 py-1.5 font-board text-[11px] uppercase tracking-wider ${noticeTone}`}>{notice.text}</p>}
        </section>

        <section className="mt-4 flex items-end gap-4 rounded-board border border-hairline bg-board p-4">
          <ScoreInput label={homeName} value={home} onChange={setHome} />
          <span className="pb-2 text-ink-dim">–</span>
          <ScoreInput label={awayName} value={away} onChange={setAway} />
          <label className="ml-auto flex flex-col gap-1">
            <span className="font-board text-[10px] uppercase tracking-widest text-ink-dim">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="SCHEDULED">Scheduled</option>
              <option value="LIVE">Live</option>
              <option value="FINISHED">Finished</option>
            </select>
          </label>
        </section>

        {match.isKnockout && (
          <section className="mt-3 flex flex-wrap items-center gap-3 rounded-board border border-hairline bg-board px-4 py-3">
            <span className="font-board text-[11px] uppercase tracking-[0.2em] text-ink-dim">
              Shootout <span className="opacity-60">(only if drawn)</span>
            </span>
            <input value={homePens} onChange={(e) => setHomePens(e.target.value.replace(/[^0-9]/g, ""))} placeholder="–" inputMode="numeric" className={`${inputCls} w-14 text-center`} />
            <span className="font-board text-[11px] uppercase tracking-widest text-ink-dim">pens</span>
            <input value={awayPens} onChange={(e) => setAwayPens(e.target.value.replace(/[^0-9]/g, ""))} placeholder="–" inputMode="numeric" className={`${inputCls} w-14 text-center`} />
            <span className="font-board text-[10px] uppercase tracking-wider text-ink-dim">shootout kicks don&apos;t count as goals</span>
          </section>
        )}

        <section className="mt-4 rounded-board border border-hairline bg-board p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-board text-[11px] uppercase tracking-[0.3em] text-amber">Events</h2>
            <button onClick={() => setEvents((e) => [...e, { team: "HOME", type: "GOAL", player: "", minute: null }])} className="font-board text-[11px] uppercase tracking-widest text-ink-dim transition hover:text-amber">
              + Add event
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {events.length === 0 && <p className="font-board text-[11px] uppercase tracking-widest text-ink-dim">No events yet</p>}
            {events.map((ev, i) => (
              <div key={i} className="grid grid-cols-[4rem_5.5rem_1fr_3.5rem_1.5rem] items-center gap-2">
                <select value={ev.team} onChange={(e) => setEv(i, { team: e.target.value as "HOME" | "AWAY" })} className={inputCls}>
                  <option value="HOME">{homeName}</option>
                  <option value="AWAY">{awayName}</option>
                </select>
                <select value={ev.type} onChange={(e) => setEv(i, { type: e.target.value })} className={inputCls}>
                  {EVENT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ").toLowerCase()}</option>)}
                </select>
                <input value={ev.player} onChange={(e) => setEv(i, { player: e.target.value })} placeholder="Player" className={inputCls} />
                <input value={ev.minute ?? ""} onChange={(e) => setEv(i, { minute: e.target.value === "" ? null : Number(e.target.value) })} placeholder="min" inputMode="numeric" className={inputCls} />
                <button onClick={() => setEvents((evs) => evs.filter((_, idx) => idx !== i))} className="text-ink-dim transition hover:text-cancelled">✕</button>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-5 flex justify-end">
          <button onClick={save} disabled={pending} className="rounded-lg bg-amber px-6 py-2.5 font-board text-sm font-semibold uppercase tracking-wider text-tarmac transition hover:brightness-110 disabled:opacity-50">
            {pending ? "Saving…" : "Save result"}
          </button>
        </div>
      </div>
    </main>
  );
}

function TeamPicker({ value, onChange, label, teams }: { value: string | null; onChange: (v: string | null) => void; label: string | null; teams: TeamOpt[] }) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={`${inputCls} max-w-44 font-display font-semibold`}>
      <option value="">— {label ?? "TBD"} —</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  );
}

function ScoreInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="max-w-28 truncate font-board text-[10px] uppercase tracking-widest text-ink-dim">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))} placeholder="–" inputMode="numeric" className={`${inputCls} w-16 text-center font-board text-xl`} />
    </label>
  );
}
