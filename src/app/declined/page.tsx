import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { signOutAction } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

export default async function DeclinedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.status === "ACTIVE") redirect("/fixtures");
  if (user.status === "PENDING") redirect("/waiting");

  return (
    <main className="bg-runway flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex items-center justify-center gap-2 font-mono text-sm tracking-[0.3em] text-amber">
          <span aria-hidden>✈</span> GATE TO GLORY
        </div>
        <div className="rounded-board border border-hairline bg-board px-6 py-10">
          <p className="font-board text-2xl uppercase tracking-[0.2em] text-cancelled">
            Flight cancelled
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-dim">
            Your check-in wasn&apos;t approved for this sweepstake. If you think that&apos;s a
            mistake, have a word with the gate agent.
          </p>
          <form action={signOutAction} className="mt-6">
            <button
              type="submit"
              className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-dim transition hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
