# Design

## Theme

Dark — a **night departures hall**. Scene: 9pm in an airport terminal, a big amber split-flap board
glowing over a dark concourse, a boarding pass in hand. Mood: anticipation and arrivals/departures
drama, with a premium-arcade edge. Dark is chosen (not defaulted): the board glows because the hall is
dark, and the big-screen reveal needs to sit on black.

## Color

Strategy: **Committed-dark.** A deep near-black tarmac surface carries the whole product; a single
signature **amber** is the brand; green/red are strictly functional status.

| Token | Value | Role |
| --- | --- | --- |
| `--color-tarmac` | `#07090d` | page background |
| `--color-board` | `#0f141c` | board / card surface |
| `--color-board-raised` | `#161d28` | raised rows, inputs |
| `--color-hairline` | `#222c3a` | borders, separators |
| `--color-ink` | `#e8edf5` | primary text (~13:1 on tarmac) |
| `--color-ink-dim` | `#9aa6b8` | secondary text (~6:1, AA) |
| `--color-amber` | `#ffb000` | signature brand / split-flap (~9:1) |
| `--color-boarding` | `#2fd07a` | ON TIME / BOARDING |
| `--color-delayed` | `#ffd23f` | DELAYED |
| `--color-cancelled` | `#ff5252` | FLIGHT CANCELLED |
| `--color-glory` | `#d8b15a` | gold — winners / First Class |

## Typography

Deliberately off the reflex defaults (no Inter / Space Grotesk / IBM Plex). Two families:

- **Archivo** (`--font-display`, weights 400/500/700/900) — a confident grotesque with signage energy.
  Headlines, team names, structure, body/UI.
- **Doto** (`--font-board`, variable) — a dot-matrix LED face: the literal voice of a departures board.
  Times, scores, gate codes, status, big numbers. Used ≥14px, never for long-form text.

Fluid `clamp()` headings, ≥1.25 step ratio, display ceiling ≤ 6rem, letter-spacing ≥ -0.04em.

## Components

- **Split-flap row** — player · team · gate · status, with a flip-in on value change (the signature motion).
- **Status pill** — color + icon + word (never color alone).
- **Flag chip** — flag + 3-letter code.
- **Boarding pass** — perforated edge, gate/group/seat fields, a barcode, a holographic foil sheen on reveal.
- **Buttons** — amber solid (primary), hairline ghost (secondary). Label = verb + object.
- **Stat tile** — used sparingly; not the hero-metric template.

## Layout

- App content max-width ~1100px; full-bleed for the board and the reveal.
- Prefer the board pattern over card grids.
- Reveal / `/reveal/stage`: full-viewport, one dominant idea, paced for a room.

## Motion

- **Split-flap flip** for board values — the signature.
- **Reveal choreography** — a glowing great-circle arc draws from London to the drawn team's country,
  the boarding pass mints and flips, the flag lands. Staggered, one person at a time.
- Ease-out (expo/quart), no bounce/elastic.
- `prefers-reduced-motion`: flips become crossfades, the globe stops auto-rotating, arcs appear instantly.
