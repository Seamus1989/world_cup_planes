/**
 * Pull real World Cup results from ESPN into the DB. Runs against whatever DATABASE_URL points at.
 *
 *   bun scripts/espn-sync.ts --dry        PREVIEW — fetch + match + diff, write NOTHING (always safe)
 *   FORCE=1 bun scripts/espn-sync.ts       APPLY  — required when DATABASE_URL is a remote DB
 *
 * Dry-run workflow for a cloned prod DB:
 *   DATABASE_URL="postgres://…clone…" bun scripts/espn-sync.ts --dry   # inspect the report
 *   DATABASE_URL="postgres://…clone…" FORCE=1 bun scripts/espn-sync.ts # apply to the clone, eyeball the app
 */
import { syncFromEspn } from "@/lib/espn-sync";

const dry = process.argv.includes("--dry") || process.argv.includes("-n");

// Safety net (mirrors timemachine): refuse to WRITE to a remote DB unless explicitly forced.
if (!dry && process.env.DATABASE_URL && process.env.FORCE !== "1") {
  const host = process.env.DATABASE_URL.match(/@([^/:?]+)/)?.[1] ?? "remote DB";
  console.error(`⛔ A live sync would WRITE to the remote database at ${host}.`);
  console.error(`   Preview first:  bun scripts/espn-sync.ts --dry`);
  console.error(`   To apply:       FORCE=1 bun scripts/espn-sync.ts`);
  process.exit(1);
}

async function main() {
  const r = await syncFromEspn({ dryRun: dry });

  console.log(`\n  ESPN sync ${dry ? "— DRY RUN (nothing written)" : "— APPLIED"}`);
  console.log(
    `  finished on ESPN: ${r.espnFinished} · matched ${r.matched} · changed ${r.changed} · unchanged ${r.unchanged}`,
  );

  const shown = dry ? r.changes : r.changes.filter((c) => c.applied);
  if (shown.length) {
    console.log(`\n  ${dry ? "Would update" : "Updated"}:`);
    for (const c of shown) {
      console.log(`   ${c.fixture.padEnd(16)}  ${c.before.padEnd(18)} →  ${c.after}   (${c.events} events)`);
    }
  }
  if (r.unmatched.length) {
    console.log(`\n  ⚠ unmatched (${r.unmatched.length}):`);
    for (const u of r.unmatched) console.log(`   ${u.fixture}  [${u.espnId}] — ${u.reason}`);
  }
  console.log(r.recomputed ? "\n  ✓ eliminations recomputed.\n" : "\n");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
