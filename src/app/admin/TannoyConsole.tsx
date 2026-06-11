"use client";

import { useState, useTransition } from "react";

type PreviewResult = { text: string; matchIds: string[]; count: number };

/** Generate the banter, let the admin tweak it, then post to Slack. */
export function TannoyConsole({
  pending,
  live,
  preview,
  post,
}: {
  pending: number;
  live: boolean;
  preview: () => Promise<PreviewResult>;
  post: (text: string, matchIds: string[]) => Promise<{ ok: boolean; reason: string }>;
}) {
  const [text, setText] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [busy, start] = useTransition();

  const onGenerate = () =>
    start(async () => {
      setStatus("Writing…");
      const r = await preview();
      setText(r.text);
      setIds(r.matchIds);
      setStatus(r.count ? "" : "No new results to announce — enter some scores first.");
    });

  const onPost = () =>
    start(async () => {
      setStatus("Posting…");
      const r = await post(text, ids);
      if (r.ok) {
        setText("");
        setIds([]);
        setStatus("Posted to Slack ✓");
      } else {
        setStatus(r.reason || "Couldn't post.");
      }
    });

  const btn =
    "rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition disabled:opacity-40";

  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-board text-sm uppercase tracking-[0.3em] text-ink">📣 Big John</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-dim">
          {pending} new {pending === 1 ? "result" : "results"}
        </span>
      </div>

      <div className="mt-3 rounded-board border border-hairline bg-board p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="max-w-md text-sm text-ink-dim">
            Enter results in the Score console, then generate a banter update for the new ones, tweak
            it, and post it to Slack.
          </p>
          {live ? (
            <span className="shrink-0 rounded-md bg-amber/15 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-amber">
              ● Live · this will post to Slack
            </span>
          ) : (
            <span className="shrink-0 rounded-md border border-hairline px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-dim">
              Preview only · won&apos;t post from here
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onGenerate}
            disabled={busy || pending === 0}
            className={`${btn} bg-amber text-tarmac hover:brightness-110`}
          >
            ✍ Generate
          </button>
          {!!text && (
            <button
              type="button"
              onClick={onPost}
              disabled={busy || !ids.length || !live}
              className={`${btn} bg-boarding/20 text-boarding hover:bg-boarding/30`}
            >
              {live ? "Post to Slack" : "Posting off here"}
            </button>
          )}
          {status && <span className="font-mono text-[11px] uppercase tracking-widest text-ink-dim">{status}</span>}
        </div>

        {!!text && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="mt-3 w-full rounded-lg border border-hairline bg-board-raised px-3 py-2 text-sm leading-relaxed text-ink"
            placeholder="The Tannoy's words appear here — edit freely before posting."
          />
        )}
      </div>
    </section>
  );
}
