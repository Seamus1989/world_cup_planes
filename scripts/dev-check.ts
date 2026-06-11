/**
 * Standalone end-to-end check of the seed + draw engine against PGlite.
 * Run with the dev server stopped:  bun run scripts/dev-check.ts
 */
import { resetAll, seedTeams, seedRandomUsers, getStateSummary } from "@/lib/dev";
import { commitPrimaryDraw, openStandbyAndDraw, markRandomEliminations } from "@/lib/draw";

async function main() {
  console.log("→ reset            ", await resetAll().then(() => "ok"));
  console.log("→ seed teams       ", await seedTeams());
  console.log("→ seed users       ", await seedRandomUsers(30));
  console.log("→ primary draw     ", await commitPrimaryDraw());
  console.log("→ standby draw     ", await openStandbyAndDraw());
  console.log("→ eliminate        ", await markRandomEliminations(6));

  const s = await getStateSummary();
  console.log("\nCounts:", s.counts);
  console.log("Draw committed:", !!s.drawCommittedAt, "· standby open:", s.standbyOpen);
  console.log("\nTop of roster:");
  for (const u of s.roster.slice(0, 10)) {
    const teams = u.teams
      .map((t) => `${t.flag}${t.name}${t.type === "STANDBY" ? "✦" : ""}${t.eliminated ? "(out)" : ""}`)
      .join(", ");
    console.log(`  ${u.name.padEnd(20)} ${teams || "—"}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
