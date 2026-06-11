"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireActive } from "@/lib/session";

/**
 * Crystal Ball side-quest: nominate the team you reckon wins it all (no money, just bragging rights).
 * One-shot — once you've picked, it's locked. Enforced server-side so it can't be overridden.
 */
export async function setChampionPick(formData: FormData) {
  const me = await requireActive();
  if (me.championPick) return; // already locked in
  const code = String(formData.get("team") ?? "").trim().toUpperCase();
  if (!code) return;
  await db
    .update(schema.users)
    .set({ championPick: code })
    // isNull guard makes the lock atomic even against a double-submit
    .where(and(eq(schema.users.id, me.id), isNull(schema.users.championPick)));
  revalidatePath("/side-quests");
}
