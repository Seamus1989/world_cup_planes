"use client";

import { useEffect, useState } from "react";

// Daft departures-board ticker. Gentle fade between lines — no flashing.
const QUIPS = [
  "📣 Big John's having a kip — Ballroom Pete's on the mic 💃",
  "🎲 Reminder: being absolutely rubbish pays £10",
  "✈ Get knocked out and your flight is CANCELLED",
  "🟥 The Zinedine table does not reward good manners",
  "☕ Put the kettle on — kickoff's never far away",
  "🥾 Golden Boot race: sharper than a butler's crease",
  "🤦 Friendly Fire: scoring for the other lot since 1930",
  "🚪 Welcome Aboard — let 'em all in, lovely jubbly",
  "🕺 Pete reckons the waltz is basically a midfield triangle",
  "🏆 £120 in the pot — mind how you go",
  "😴 Nine days awake… somebody check on Big John",
  "🛄 Lost luggage: someone's defensive shape",
];

export function RotatingBanner() {
  const [i, setI] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setShow(false);
      const t = setTimeout(() => {
        setI((n) => (n + 1) % QUIPS.length);
        setShow(true);
      }, 350);
      return () => clearTimeout(t);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="overflow-hidden rounded-board border border-hairline bg-board px-4 py-2">
      <p
        className={`truncate text-center font-board text-[11px] uppercase tracking-[0.2em] text-ink-dim transition-opacity duration-300 ${
          show ? "opacity-100" : "opacity-0"
        }`}
      >
        {QUIPS[i]}
      </p>
    </div>
  );
}
