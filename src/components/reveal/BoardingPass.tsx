"use client";

import { motion } from "motion/react";
import type { RevealTeam } from "@/lib/reveal";

const BAR_PATTERN = [1, 3, 1, 2, 4, 1, 1, 3, 2, 1, 4, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 4, 1, 1, 3];

function gateCode(t: RevealTeam) {
  const n = (t.code.charCodeAt(2) % 30) + 1;
  return `${t.group ?? "G"}${String(n).padStart(2, "0")}`;
}

export function BoardingPass({
  userName,
  teams,
  large = false,
}: {
  userName: string;
  teams: RevealTeam[];
  large?: boolean;
}) {
  const multi = teams.length > 1;
  const first = teams[0];

  return (
    <motion.div
      initial={{ rotateY: -72, opacity: 0, y: 24 }}
      animate={{ rotateY: 0, opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16, transition: { duration: 0.25 } }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformPerspective: 1200 }}
      className={`pointer-events-none relative overflow-hidden rounded-2xl border border-amber/30 bg-board shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)] ${
        large ? "w-[min(94vw,780px)]" : "w-[min(92vw,560px)]"
      }`}
    >
      <motion.div
        aria-hidden
        initial={{ x: "-130%" }}
        animate={{ x: "150%" }}
        transition={{ delay: 0.5, duration: 1.1, ease: "easeOut" }}
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-amber/20 to-transparent"
      />
      <div className="flex">
        <div className="flex-1 p-5 sm:p-6">
          <div className="flex items-center justify-between font-board text-[11px] uppercase tracking-[0.3em] text-amber">
            <span>✈ Gate to Glory</span>
            <span className="text-ink-dim">{multi ? `Boarding passes · ${teams.length}` : "Boarding pass"}</span>
          </div>

          <div className="mt-4 font-board text-[10px] uppercase tracking-[0.25em] text-ink-dim">Passenger</div>
          <div className={`font-display font-extrabold leading-none text-ink ${large ? "text-5xl" : "text-3xl"}`}>
            {userName}
          </div>

          {multi ? (
            <ul className="mt-5 flex flex-col gap-2">
              {teams.map((t) => (
                <li
                  key={t.code}
                  className="flex items-center gap-3 border-t border-hairline/70 pt-2 first:border-t-0 first:pt-0"
                >
                  <span className={large ? "text-4xl" : "text-3xl"} aria-hidden>
                    {t.flag}
                  </span>
                  <span
                    className={`font-display font-extrabold uppercase leading-none text-amber ${large ? "text-3xl" : "text-2xl"} ${t.eliminated ? "text-cancelled line-through" : ""}`}
                  >
                    {t.team}
                  </span>
                  <span className="ml-auto font-board text-[11px] uppercase tracking-widest text-ink-dim">
                    GRP {t.group ?? "?"}
                    {t.type === "STANDBY" && <span className="text-amber"> ✦</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            first && (
              <>
                <div className="mt-5 flex items-end gap-4">
                  <div className={large ? "text-7xl" : "text-5xl"} aria-hidden>
                    {first.flag}
                  </div>
                  <div>
                    <div className="font-board text-[10px] uppercase tracking-[0.25em] text-ink-dim">Destination</div>
                    <div className={`font-display font-extrabold uppercase leading-none text-amber ${large ? "text-5xl" : "text-3xl"}`}>
                      {first.team}
                    </div>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3 font-board">
                  <Field label="Group" value={first.group ?? "—"} />
                  <Field label="Gate" value={gateCode(first)} />
                  <Field label="Seat" value="1A" />
                </div>
              </>
            )
          )}
        </div>

        <div className="relative w-0 shrink-0 border-l border-dashed border-amber/40" aria-hidden />

        <div className="flex w-20 shrink-0 flex-col items-center justify-between p-4 sm:w-24">
          <div className="font-board text-[10px] uppercase tracking-[0.2em] text-ink-dim [writing-mode:vertical-rl]">
            {multi ? `${teams.length} FLIGHTS` : `${first?.code ?? ""} · GRP ${first?.group ?? "?"}`}
          </div>
          <div className="flex h-14 items-stretch gap-[2px]">
            {BAR_PATTERN.map((w, i) => (
              <span key={i} className="bg-ink/85" style={{ width: w }} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.2em] text-ink-dim">{label}</div>
      <div className="text-lg text-ink">{value}</div>
    </div>
  );
}
