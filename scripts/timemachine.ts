/**
 * Gate to Glory — "time machine" seeding. Step through t=0 → Final and inspect at each stop.
 * Runs against whatever DATABASE_URL points at (local PGlite, or your Neon).
 *
 *   bun scripts/timemachine.ts reset          wipe + seed teams, fixtures, empty bracket
 *   bun scripts/timemachine.ts users 12       create fake players
 *   bun scripts/timemachine.ts draw           primary + standby draw (reveal ready)
 *   bun scripts/timemachine.ts groups         play ALL group games → standings + fill R32
 *   bun scripts/timemachine.ts advance        play the NEXT knockout round
 *   bun scripts/timemachine.ts play <stage> n play n scheduled matches of a stage
 *   bun scripts/timemachine.ts status         where is the tournament
 *   bun scripts/timemachine.ts all [n]        everything end-to-end
 *
 * (Local PGlite: stop `bun dev` first so the file DB isn't locked. Neon: no need.)
 */
import { eq } from "drizzle-orm";
import { db, ensureSchema, schema } from "@/db";
import { resetAll, seedTeams, seedRandomUsers, seedFixtures, seedKnockout, autofillR32 } from "@/lib/dev";
import { commitPrimaryDraw, openStandbyAndDraw } from "@/lib/draw";
import { playMatches, recomputeEliminations } from "@/lib/play";

const cmd = process.argv[2] ?? "help";
const arg = process.argv[3];

async function status() {
  await ensureSchema();
  const [teams, users, seats, ms] = await Promise.all([
    db.select().from(schema.teams),
    db.select().from(schema.users),
    db.select().from(schema.seats),
    db.select().from(schema.matches),
  ]);
  const played = ms.filter((m) => m.status === "FINISHED");
  const groupPlayed = played.filter((m) => m.stage === "GROUP").length;
  const ko = ms.filter((m) => m.stage !== "GROUP");
  const koPlayed = ko.filter((m) => m.status === "FINISHED").length;
  console.log(
    `\n  teams ${teams.length} (${teams.filter((t) => t.eliminated).length} knocked out) · users ${users.length} · seats ${seats.length}`,
  );
  console.log(`  group games ${groupPlayed}/72 · knockout ${koPlayed}/${ko.length} played\n`);
}

async function main() {
  switch (cmd) {
    case "reset":
      await resetAll();
      await seedTeams();
      await seedFixtures();
      await seedKnockout();
      console.log("✈  reset — 48 teams, 72 fixtures, empty bracket");
      break;
    case "fixtures":
      // Re-seed the real calendar without touching teams/users/seats.
      await db.delete(schema.matchEvents);
      await db.delete(schema.matches);
      console.log("✈  reseed fixtures", await seedFixtures(), await seedKnockout());
      break;
    case "users":
      console.log("✈  seed users", await seedRandomUsers(Number(arg) || 12));
      break;
    case "draw": {
      const cap = arg ? Number(arg) : 3;
      await commitPrimaryDraw();
      await openStandbyAndDraw(cap);
      console.log(`✈  primary + standby draw complete (cap ${cap}) — reveal is ready`);
      break;
    }
    case "groups":
      console.log("✈  playing all group games…", await playMatches("groups"));
      await autofillR32();
      console.log("   standings computed · qualifiers placed into R32");
      break;
    case "advance":
      console.log("✈  next round", await playMatches("next", arg ? Number(arg) : undefined));
      break;
    case "play":
      console.log("✈  play", await playMatches(arg ?? "all", Number(process.argv[4]) || undefined));
      break;
    case "recompute":
      await recomputeEliminations();
      console.log("✈  eliminations recomputed from results");
      break;
    case "all":
      await resetAll();
      await seedTeams();
      await seedFixtures();
      await seedKnockout();
      await seedRandomUsers(Number(arg) || 12);
      await commitPrimaryDraw();
      await openStandbyAndDraw();
      await playMatches("groups");
      await autofillR32();
      for (let i = 0; i < 6; i++) {
        const r = await playMatches("next");
        if (!r.played) break;
      }
      console.log("✈  full tournament simulated end-to-end");
      break;
    default:
      console.log(
        "Gate to Glory time machine:\n  reset · fixtures · users [n] · draw · groups · advance [n] · play <stage> [n] · recompute · status · all [n]",
      );
  }
  await status();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
