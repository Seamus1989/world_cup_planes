"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireActive } from "@/lib/session";

/** Crystal Ball side-quest: nominate the team you reckon wins it all (no money, just bragging rights). */
export async function setChampionPick(formData: FormData) {
  const me = await requireActive();
  const code = String(formData.get("team") ?? "").trim().toUpperCase();
  await db
    .update(schema.users)
    .set({ championPick: code || null })
    .where(eq(schema.users.id, me.id));
  revalidatePath("/side-quests");
}
