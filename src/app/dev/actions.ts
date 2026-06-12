"use server";

import { revalidatePath } from "next/cache";
import { seedTeams, seedRandomUsers, resetAll, seedFixtures, simulateResults, seedKnockout, autofillR32 } from "@/lib/dev";
import { commitPrimaryDraw, openStandbyAndDraw, markRandomEliminations } from "@/lib/draw";
import { loginAs, logout } from "@/lib/session";

/** Dev harness only. Every action throws in production so nothing here can touch live data. */
function assertDevTools() {
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_DEV_TOOLS) {
    throw new Error("Dev tools are disabled in production.");
  }
}

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

export async function actSeedTeams() {
  assertDevTools();
  await seedTeams();
  revalidatePath("/dev");
}

export async function actSeedFixtures() {
  assertDevTools();
  await seedFixtures();
  revalidatePath("/dev");
}

export async function actSimulate(formData: FormData) {
  assertDevTools();
  await simulateResults(clamp(formData.get("k"), 1, 72, 12));
  revalidatePath("/dev");
}

export async function actSeedKnockout() {
  assertDevTools();
  await seedKnockout();
  revalidatePath("/dev");
  revalidatePath("/knockout");
}

export async function actAutofillR32() {
  assertDevTools();
  await autofillR32();
  revalidatePath("/dev");
  revalidatePath("/knockout");
}

export async function actSeedUsers(formData: FormData) {
  assertDevTools();
  await seedRandomUsers(clamp(formData.get("n"), 1, 60, 20));
  revalidatePath("/dev");
}

export async function actRunDraw() {
  assertDevTools();
  await commitPrimaryDraw();
  revalidatePath("/dev");
}

export async function actStandby() {
  assertDevTools();
  await openStandbyAndDraw();
  revalidatePath("/dev");
}

export async function actEliminate(formData: FormData) {
  assertDevTools();
  await markRandomEliminations(clamp(formData.get("k"), 1, 48, 4));
  revalidatePath("/dev");
}

export async function actReset() {
  assertDevTools();
  await resetAll();
  revalidatePath("/dev");
}

export async function actLoginAs(formData: FormData) {
  assertDevTools();
  const id = String(formData.get("userId") ?? "");
  if (id) await loginAs(id);
  revalidatePath("/dev");
}

export async function actLogout() {
  assertDevTools();
  await logout();
  revalidatePath("/dev");
}
