"use client";

import { useState, useTransition } from "react";
import { previewEspnSync, applyEspnSync } from "./sync";
import type { SyncReport } from "@/lib/espn-sync";

export function SyncPanel() {
  const [report, setReport] = useState<SyncReport | null>(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (apply: boolean) =>
    start(async () => {
      setError(null);
      try {
        const r = apply ? await applyEspnSync() : await previewEspnSync();
        setReport(r);
        setApplied(apply);
      } catch (e) {
        setError((e as Error).message || "Sync failed");
      }
    });

  return (
    <section className="mt-4 rounded-board border border-hairline bg-board p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-board text-[11px] uppercase tracking-[0.3em] text-amber">Sync from ESPN</h2>
        <span className="font-board text-[10px] uppercase tracking-widest text-ink-dim">
          structured feed · no AI · the real results
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => run(false)}
            disabled={pending}
            className="rounded border border-hairline px-3 py-1.5 font-board text-xs uppercase tracking-wider transition hover:border-amber/50 disabled:opacity-50"
          >
            {pending && !applied ? "Checking…" : "Preview"}
          </button>
          <button
            onClick={() => run(true)}
            disabled={pending}
            className="rounded bg-amber px-3 py-1.5 font-board text-xs font-semibold uppercase tracking-wider text-tarmac transition hover:brightness-110 disabled:opacity-50"
          >
            {pending && applied ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded border border-cancelled/50 px-3 py-1.5 font-board text-[11px] uppercase tracking-wider text-cancelled">
          {error}
        </p>
      )}

      {report && (
        <div className="mt-3 border-t border-hairline/60 pt-3">
          <p className="font-board text-[11px] uppercase tracking-wider text-ink-dim">
            {report.dryRun ? "Preview" : "Applied"} · ESPN finished {report.espnFinished} · matched {report.matched} ·{" "}
            <span className="text-amber">{report.changed} {report.dryRun ? "would change" : "updated"}</span> ·{" "}
            {report.unchanged} unchanged
            {report.unmatched.length > 0 && <span className="text-cancelled"> · {report.unmatched.length} unmatched</span>}
          </p>

          {report.changes.length > 0 && (
            <ul className="mt-2 max-h-64 divide-y divide-hairline/50 overflow-y-auto font-board text-[11px]">
              {report.changes.map((c) => (
                <li key={c.espnId} className="flex items-center gap-2 py-1.5">
                  <span className="w-32 shrink-0 font-semibold text-ink">{c.fixture}</span>
                  <span className="text-ink-dim">{c.before}</span>
                  <span className="text-ink-dim">→</span>
                  <span className="text-boarding">{c.after}</span>
                  <span className="ml-auto shrink-0 text-ink-dim">{c.events} ev</span>
                </li>
              ))}
            </ul>
          )}

          {report.unmatched.length > 0 && (
            <ul className="mt-2 font-board text-[11px] text-cancelled">
              {report.unmatched.map((u) => (
                <li key={u.espnId}>
                  {u.fixture} — {u.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
