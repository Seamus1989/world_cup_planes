# ✈️ Gate to Glory

> A Planes World Cup 2026 sweepstake game. *48 teams. One gate to glory.*

A web app for the Planes ([planes.studio](https://www.planes.studio/)) office sweepstake on the
2026 FIFA World Cup (USA / Canada / Mexico, **11 June – 19 July 2026**). First 48-team World Cup:
**12 groups of 4 (A–L), 104 matches**. Top 2 of each group + 8 best 3rd-placed teams → 32-team knockout.

---

## Theme — "Departures"

One coherent airport language across the whole app:


| Concept               | In the game                                                       |
| --------------------- | ----------------------------------------------------------------- |
| Your team             | A **flight** with a gate, status and departure time               |
| The reveal            | You're handed a **Boarding Pass** (team, group, gate)             |
| Fixtures & results    | The **Departures Board** — split-flap, *clack-clack-clack*        |
| Knocked out           | `**FLIGHT CANCELLED*`* — red split-flap stamp slaps over the flag |
| Leaderboard tiers     | **First Class / Business / Economy**                              |
| The prize pot         | The **Duty Free** fund                                            |
| Slack bot             | **The Tannoy** (the airport announcer)                            |
| Predictions side-game | **Flight Plan** (predict the bracket)                             |


---

## Locked decisions

- **Name:** Gate to Glory · airport *Departures* theme.
- **Headcount:** under ~40 players → teams left over → **Standby** second-seat draw is core.
- **Prize model:** big winner + side pots (Golden Boot, best predictor, Wooden Spoon booby prize).

---

## Team allocation — "one each, then Standby"

1. **Phase 1 — Everyone gets one.** Each approved + paid player gets **exactly one** randomly-drawn
  team at the reveal. Nobody doubles up until everyone is in. Fate chooses for you.
2. **Pay window.** Players have X days to deposit £5. Unpaid primary teams are reclaimed at the deadline.
3. **Phase 2 — Standby (opens after reveal *and* pay deadline).** Leftover + reclaimed teams form a
  **Standby pool**. Players buy extra seats (£5 each), **capped at 3 teams total** so nobody hoards.
   Standby teams are drawn **randomly again** in a short second reveal.
4. **Standby Upgrade twist.** Standby teams (usually the weaker leftovers) carry a **payout multiplier**
  if they overperform — a minnow on a run can out-earn a marquee first pick.
5. **If it ever flips to >48 players:** Syndicates (two people co-own a team, split stake + winnings).
  Build flexible with an admin toggle.

---

## Roles & lifecycle

- **Auth:** Google sign-in only (Auth.js).
- **User status:** `PENDING` (registered interest) → admin approves → `ACTIVE` (in the draw pool).
- **Roles:** `ADMIN` vs `PLAYER`.
- **Payments:** tracked per seat, `PENDING` / `PAID`, toggled manually by admin (£5 cash/transfer;
Stripe is an easy later add).

---

## The 3D reveal (the showstopper)

- Built with **React Three Fiber** + bloom/postprocessing.
- **Provably fair:** assignments are committed server-side first, then *played back* as animation.
Admin hits **START THE DRAW** — runs **live** (reveal one person at a time) or **auto-play**.
- **Big-screen — "The Globe Draw":** a 3D Earth; per person a glowing jet launches from London and
arcs to their team's country, planting an unfurling flag. A web of flight paths builds on screen.
- **Personal — "Boarding Pass Mint":** each reveal flips a 3D boarding pass that stamps with the team,
flag, group and gate (holographic foil) — screenshot-able for Slack.
- Dedicated big-screen route (`/reveal/stage`) for HDMI at the team meeting.

---

## Player experience

- **Departure Lounge** (`/lounge`) — your dashboard. **Your teams front and centre**, today's fixtures,
your side-quest standings. When a team is out, its card gets the `CANCELLED` stamp + grayscale.
All teams out → playful "all flights grounded" state that nudges you to the prediction games.
- **Departures Board** (`/board`) — every fixture & result, split-flap, who owns each team.
- **Standings & Bracket** (`/standings`) — groups + the knockout bracket.
- **Leaderboard** (`/leaderboard`) — First Class / Business / Economy tiers.
- **Flight Plan** (`/predictions`) — bracket + daily score predictor (keeps people engaged after their
team dies).

---

## Admin

- `/admin/approvals` — approve pending players.
- `/admin/players` — manage players, seats, payment toggles.
- `/admin/draw` — run the primary draw + Standby draw; big-screen controller.
- `/admin/matches` + `/admin/matches/[id]` — **score console**.
- `/admin/tannoy` — preview / approve / schedule AI Slack posts.
- `/admin/settings` — pot split %, key dates, seat cap.

### Score console — richer than goals

Each match logs **events**: `GOAL` / `OWN_GOAL` / `PEN_GOAL` / `PEN_MISS` / `ASSIST` / `YELLOW` / `RED`,
each with **player, team, minute and period** (`1H` / `2H` / `ET1` / `ET2` / `PENS`).
**Quick mode** (just the final score) or **Detailed mode** (full events) so logging is never a chore.
This event data is what powers the side quests.

---

## Side quests & bonus competitions

**Team-attached** (you win because your players do): 🥾 Golden Boot · 🧤 Golden Glove · 🎩 Hat-trick Hero
· 🅰️ Most Assists · ⚡ Fastest goal · ⏱️ Latest winner (90+').

**The weird ones:** most extra-time goals · most penalty goals · most own goals (cursed) · biggest win
· most red cards = **"The Early Bath."**

**Predictive (everyone, all tournament):** 🗺️ **Flight Plan** bracket prediction · 🎯 daily exact-score predictor.

**Booby:** 🥄 **Wooden Spoon** — first team eliminated / worst goal difference.

---

## The Tannoy — Slack + timezones + AI

- **Fixtures seeded** with kickoffs stored in **UTC**, rendered in **UK time** (Europe/London; BST/UTC+1
across the whole tournament).
- **"Today's Departures"** morning post: today's fixtures, UK kickoff times, **who owns each team**
— *"✈️ 20:00 — Seamus's 🇮🇶 Iraq vs Paul's 🏴 England."*
- **AI spicy matchup hype** (Anthropic API, server-side) when two colleagues' teams clash; **AI recap**
of yesterday's results drafted from entered scores — admin approves, it posts.
- **Optional live goal pings** when the admin enters a goal.
- Mechanism: Slack **incoming webhook** + **Vercel Cron** for the morning post.

---

## Prize model (default — configurable in admin)

£5/seat → the **Duty Free** pot. Example split: **Champion's owner 40%** · runner-up 15% ·
four semi-finalists share 10% · **Golden Boot owner 10%** · **best predictor 10%** ·
Wooden Spoon a token · remainder for weekly micro-prizes. Standby multipliers applied on payout.

---

## Tech stack

- **Next.js 15 (App Router) + TypeScript** — Vercel-native.
- **Tailwind** + the `impeccable` skill for the Departures design system.
- **React Three Fiber** (reveal) · **Framer Motion** (UI motion) · split-flap board component.
- **Auth.js** (Google provider).
- **Drizzle** → **Postgres** (Neon) - locally we can use a DB in the cloud
- **Anthropic API** via Vercel AI SDK Gateway for Tannoy copy · **Slack webhook** + **Vercel Cron**.

---

## Build milestones (today = 4 Jun · kickoff = 11 Jun)

- **M0 — Foundation:** scaffold app + Departures design system, Google auth, Prisma schema, seed the
48 teams + 12 groups.
- **M1 — Reveal-ready (for the team meeting, this week):** approval queue, payment toggle, the draw
engine, the 3D reveal + big-screen stage. *← this is what you demo.*
- **M2 — Tournament-ready (by 11 Jun):** fixtures w/ UTC kickoffs, score console, Departures Board,
"your teams" view w/ CANCELLED stamps, standings/bracket.
- **M3 — Engagement (rolling, Jun):** The Tannoy (daily fixtures + AI recaps + spicy matchups), Flight Plan.
- **M4 — Payouts (by knockouts, Jul):** side-quest scoring, Golden Boot etc., pot distribution,
leaderboard tiers, Standby multipliers.

---

## To verify / provide later

- **Real 2026 data:** confirm the official groups, qualified teams and exact kickoff times before
seeding (web-verify the FIFA schedule). *Until verified, seed structure with clearly-marked placeholders.*
- **Admin:** default admin = `seamus@planes.agency` (confirm).
- **Later (not needed for local):** Slack webhook URL + channel, Anthropic API key.

