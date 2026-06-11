"use server";

import { signIn, signOut } from "@/auth";

export async function signInWithGoogle() {
  // Land on "/", which routes by approval status (→ /waiting or → /board).
  await signIn("google", { redirectTo: "/" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
