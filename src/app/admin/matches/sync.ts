"use server";

import { requireAdmin } from "@/lib/session";
import { syncFromEspn, type SyncReport } from "@/lib/espn-sync";

/** Preview what an ESPN sync would change — writes nothing. */
export async function previewEspnSync(): Promise<SyncReport> {
  await requireAdmin();
  return syncFromEspn({ dryRun: true });
}

/** Pull the latest results from ESPN and write them in. */
export async function applyEspnSync(): Promise<SyncReport> {
  await requireAdmin();
  return syncFromEspn({ dryRun: false });
}
