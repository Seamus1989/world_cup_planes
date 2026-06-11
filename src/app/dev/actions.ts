"use server";

import { revalidatePath } from "next/cache";
import { seedTeams, seedRandomUsers, resetAll, seedFixtures, simulateResults, seedKnockout, autofillR32 } from "@/lib/dev";
import { commitPrimaryDraw, openStandbyAndDraw, markRandomEliminations } from "@/lib/draw";
import { loginAs, logout } from "@/lib/session";

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

export async function actSeedTeams() {
  await seedTeams();
  revalidatePath("/dev");
}

export async function actSeedFixtures() {
  await seedFixtures();
  revalidatePath("/dev");
}

export async function actSimulate(formData: FormData) {
  await simulateResults(clamp(formData.get("k"), 1, 72, 12));
  revalidatePath("/dev");
}

export async function actSeedKnockout() {
  await seedKnockout();
  revalidatePath("/dev");
  revalidatePath("/knockout");
}

export async function actAutofillR32() {
  await autofillR32();
  revalidatePath("/dev");
  revalidatePath("/knockout");
}

export async function actSeedUsers(formData: FormData) {
  await seedRandomUsers(clamp(formData.get("n"), 1, 60, 20));
  revalidatePath("/dev");
}

export async function actRunDraw() {
  await commitPrimaryDraw();
  revalidatePath("/dev");
}

export async function actStandby() {
  await openStandbyAndDraw();
  revalidatePath("/dev");
}

export async function actEliminate(formData: FormData) {
  await markRandomEliminations(clamp(formData.get("k"), 1, 48, 4));
  revalidatePath("/dev");
}

export async function actReset() {
  await resetAll();
  revalidatePath("/dev");
}

export async function actLoginAs(formData: FormData) {
  const id = String(formData.get("userId") ?? "");
  if (id) await loginAs(id);
  revalidatePath("/dev");
}

export async function actLogout() {
  await logout();
  revalidatePath("/dev");
}
