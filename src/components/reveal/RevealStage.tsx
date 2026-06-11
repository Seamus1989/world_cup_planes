"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import type { RevealGroup } from "@/lib/reveal";
import { FLAG_COLORS } from "@/lib/flag-colors";
import { BoardingPass } from "./BoardingPass";

const Globe = dynamic(() => import("./Globe"), { ssr: false });

type Phase = "idle" | "rolling" | "flying" | "landed";

const ROLL_MS = 1600;

export function RevealStage({
  groups,
  mode = "control",
}: {
  groups: RevealGroup[];
  mode?: "control" | "stage";
}) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [auto, setAuto] = useState(false);
  const n = groups.length;
  const current = idx > 0 ? groups[idx - 1] : null;
  const large = mode === "stage";

  const legCount = current?.teams.length ?? 1;
  const flightSec = 2.0 + 1.5 * legCount;
  const flyMs = flightSec * 1000 + 300;

  const inFlight = phase === "flying" || phase === "landed";
  const legs = inFlight && current ? current.teams.map((t) => ({ code: t.code, flag: t.flag, lat: t.lat, lng: t.lng })) : [];
  const landedCount = phase === "landed" ? idx : idx - 1;
  const pastDots = groups
    .slice(0, Math.max(0, landedCount))
    .flatMap((g) => g.teams)
    .map((t) => ({ code: t.code, lat: t.lat, lng: t.lng }));

  const begin = useCallback(
    (next: number) => {
      if (next < 1 || next > n) return;
      setIdx(next);
      setPhase("rolling");
    },
    [n],
  );

  useEffect(() => {
    if (phase === "rolling") {
      const t = setTimeout(() => setPhase("flying"), ROLL_MS);
      return () => clearTimeout(t);
    }
    if (phase === "flying") {
      const t = setTimeout(() => setPhase("landed"), flyMs);
      return () => clearTimeout(t);
    }
  }, [phase, idx, flyMs]);

  const firedFor = useRef(0);
  useEffect(() => {
    if (phase !== "landed" || !current || firedFor.current === idx) return;
    firedFor.current = idx;
    const colors = Array.from(
      new Set(current.teams.flatMap((t) => FLAG_COLORS[t.code] ?? ["#ffb000", "#ffffff"])),
    );
    const fire = (opts: Parameters<typeof confetti>[0]) =>
      confetti({ disableForReducedMotion: true, colors, ...opts });
    fire({ particleCount: 120, spread: 82, startVelocity: 52, origin: { y: 0.6 } });
    fire({ particleCount: 60, angle: 60, spread: 65, origin: { x: 0, y: 0.7 } });
    fire({ particleCount: 60, angle: 120, spread: 65, origin: { x: 1, y: 0.7 } });
  }, [phase, idx, current]);

  useEffect(() => {
    if (!auto) return;
    if (phase === "idle" && idx === 0 && n > 0) {
      const t = setTimeout(() => begin(1), 700);
      return () => clearTimeout(t);
    }
    if (phase === "landed" && idx < n) {
      const t = setTimeout(() => begin(idx + 1), 3200);
      return () => clearTimeout(t);
    }
  }, [auto, phase, idx, n, begin]);

  const reset = () => {
    setIdx(0);
    setPhase("idle");
    setAuto(false);
    firedFor.current = 0;
  };
  const done = idx >= n && phase === "landed";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-tarmac text-ink">
      <div className="absolute inset-0">
        <Globe phase={phase} flightKey={idx} legs={legs} pastDots={pastDots} flightSec={flightSec} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-5">
        <div className="font-board text-xs uppercase tracking-[0.35em] text-amber">
          ✈ Gate to Glory · The Draw
        </div>
        <div className="font-board text-sm tabular-nums text-ink-dim">
          {idx} / {n}
        </div>
      </div>

      <AnimatePresence>
        {phase === "flying" && current && (
          <motion.div
            key={`enroute-${idx}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 top-16 flex flex-col items-center"
          >
            <div className="font-board text-xs uppercase tracking-[0.4em] text-amber">
              ✈ {current.userName} · en route
            </div>
            <div className="mt-1 font-board text-[10px] uppercase tracking-[0.3em] text-ink-dim">
              {legCount > 1 ? `collecting ${legCount} teams…` : "departing London…"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center px-4"
        style={{ perspective: 1200 }}
      >
        <AnimatePresence mode="wait">
          {phase === "idle" && <Idle key="idle" n={n} large={large} />}
          {phase === "rolling" && current && (
            <Rolling key={`roll-${idx}`} name={current.userName} large={large} />
          )}
          {phase === "landed" && current && <Landed key={`land-${idx}`} group={current} large={large} />}
        </AnimatePresence>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-3 p-6">
        {idx === 0 && n > 0 && (
          <Button primary onClick={() => begin(1)}>
            Start the draw
          </Button>
        )}
        {phase === "landed" && idx < n && (
          <Button primary onClick={() => begin(idx + 1)}>
            Reveal next
          </Button>
        )}
        {(phase === "rolling" || phase === "flying") && <Button disabled>Revealing…</Button>}
        {n > 0 && idx > 0 && !done && (
          <Button onClick={() => setAuto((a) => !a)}>{auto ? "Pause" : "Auto-play"}</Button>
        )}
        {done && (
          <Button primary onClick={reset}>
            Replay
          </Button>
        )}
        {idx > 0 && !done && <Button onClick={reset}>Reset</Button>}
      </div>
    </div>
  );
}

function Idle({ n, large }: { n: number; large?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
      <div className={`font-display font-extrabold tracking-tight text-ink ${large ? "text-6xl" : "text-4xl"}`}>
        {n ? "The Draw" : "No draw yet"}
      </div>
      <div className="mt-3 font-board text-xs uppercase tracking-[0.3em] text-ink-dim">
        {n ? `${n} passengers ready at the gate` : "Run the draw in /dev first"}
      </div>
    </motion.div>
  );
}

function Rolling({ name, large }: { name: string; large?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="rounded-2xl bg-tarmac/55 px-10 py-8 text-center backdrop-blur-sm"
    >
      <div className="font-board text-xs uppercase tracking-[0.4em] text-ink-dim">Next passenger</div>
      <div className={`mt-3 font-display font-extrabold tracking-tight text-ink ${large ? "text-7xl" : "text-5xl"}`}>
        {name}
      </div>
      <div className="mt-6 flex items-center justify-center gap-3 text-4xl">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ y: [0, -14, 0], rotate: [-8, 8, -8] }}
            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
          >
            🥁
          </motion.span>
        ))}
      </div>
      <div className="mt-3 font-board text-sm uppercase tracking-[0.3em] text-amber">Drum roll…</div>
    </motion.div>
  );
}

function Landed({ group, large }: { group: RevealGroup; large?: boolean }) {
  const multi = group.teams.length > 1;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-5"
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="rounded-2xl bg-tarmac/55 px-6 py-3 text-center backdrop-blur-sm"
      >
        <div className="font-board text-xs uppercase tracking-[0.4em] text-boarding">Touchdown · now boarding</div>
        {multi ? (
          <>
            <div className={`mt-1 ${large ? "text-6xl" : "text-4xl"}`}>{group.teams.map((t) => t.flag).join(" ")}</div>
            <div className={`mt-1 font-display font-extrabold uppercase leading-none text-amber ${large ? "text-4xl" : "text-2xl"}`}>
              {group.userName}&apos;s squad
            </div>
          </>
        ) : (
          <div className={`mt-1 flex items-center justify-center gap-3 font-display font-extrabold uppercase leading-none text-amber ${large ? "text-7xl" : "text-5xl"}`}>
            <span aria-hidden>{group.teams[0]?.flag}</span>
            <span>{group.teams[0]?.team}</span>
          </div>
        )}
      </motion.div>
      <BoardingPass userName={group.userName} teams={group.teams} large={large} />
    </motion.div>
  );
}

function Button({
  children,
  onClick,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`pointer-events-auto rounded-lg px-5 py-3 font-board text-sm uppercase tracking-wider transition disabled:cursor-default disabled:opacity-50 ${
        primary
          ? "bg-amber text-tarmac hover:brightness-110"
          : "border border-hairline text-ink hover:border-amber/50"
      }`}
    >
      {children}
    </button>
  );
}
