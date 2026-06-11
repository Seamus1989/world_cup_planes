"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/session";
import { commitPrimaryDraw, openStandbyAndDraw, HOUSE_USER } from "@/lib/draw";
import { getTannoyContext, generateTannoyMessage, postToSlack, markAnnounced } from "@/lib/tannoy";

export async function setUserStatus(userId: string, status: "ACTIVE" | "PENDING" | "DECLINED") {
  await requireAdmin();
  await db.update(schema.users).set({ status }).where(eq(schema.users.id, userId));
  revalidatePath("/admin");
}

/** Run the draw: one team to every approved player, then leftovers as standby seats. */
export async function runDrawAction(formData?: FormData) {
  await requireAdmin();
  const cap = Math.min(3, Math.max(1, Number(formData?.get("cap")) || 3)); // teams per player
  await commitPrimaryDraw();
  await openStandbyAndDraw(cap);
  for (const p of ["/admin", "/reveal", "/reveal/stage", "/lounge", "/group-stage", "/fixtures"]) {
    revalidatePath(p);
  }
}

/** Buy an extra team for a player (£5, added to the pot) — reassigns a spare/House team, bypassing the cap. */
export async function grantExtraSeat(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  const pricePennies = Math.max(0, Math.round((Number(formData.get("price")) || 5) * 100));
  const [allSeats, allTeams, house] = await Promise.all([
    db.select().from(schema.seats),
    db.select().from(schema.teams),
    db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, HOUSE_USER.email)).limit(1),
  ]);
  const houseId = house[0]?.id;
  const houseSeat = houseId ? allSeats.find((s) => s.userId === houseId) : undefined;
  if (houseSeat) {
    // take a team off The House and give it to the player at full stake
    await db
      .update(schema.seats)
      .set({ userId, stakePennies: pricePennies, type: "STANDBY", multiplier: 1 })
      .where(eq(schema.seats.id, houseSeat.id));
  } else {
    const owned = new Set(allSeats.map((s) => s.teamId));
    const free = allTeams.find((t) => !owned.has(t.id));
    if (!free) return; // no spare teams left
    await db.insert(schema.seats).values({ userId, teamId: free.id, type: "STANDBY", stakePennies: pricePennies, multiplier: 1 });
  }
  for (const p of ["/admin", "/squads", "/lounge", "/group-stage", "/fixtures"]) revalidatePath(p);
}

/** The Tannoy: draft a banter message for all finished-but-unannounced results. Does NOT post. */
export async function previewTannoy() {
  await requireAdmin();
  const ctx = await getTannoyContext();
  const text = await generateTannoyMessage(ctx);
  return { text, matchIds: ctx.matchIds, count: ctx.games.length };
}

/** Post the (possibly edited) message to Slack, then mark those results announced. */
export async function postTannoy(text: string, matchIds: string[]) {
  await requireAdmin();
  const slack = await postToSlack(text);
  if (slack.ok) {
    await markAnnounced(matchIds);
    revalidatePath("/admin");
  }
  return slack;
}
