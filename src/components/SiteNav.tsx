import Link from "next/link";
import { signOutAction } from "@/lib/auth-actions";

const NAV = [
  { key: "fixtures", href: "/fixtures", label: "Fixtures" },
  { key: "group-stage", href: "/group-stage", label: "Group Stage" },
  { key: "knockout", href: "/knockout", label: "Knockout" },
  { key: "squads", href: "/squads", label: "Squads" },
  { key: "side-quests", href: "/side-quests", label: "Side Quests" },
  { key: "lounge", href: "/lounge", label: "Lounge" },
];

/** Shared top bar — identical on every page so navigation is predictable. */
export function SiteNav({
  current,
  user,
}: {
  current: string;
  user?: { name: string | null; role: string } | null;
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-hairline bg-tarmac/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <Link href="/fixtures" className="font-mono text-sm tracking-[0.3em] text-amber">
          ✈ GATE TO GLORY
        </Link>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 font-board text-[11px] uppercase tracking-widest">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              aria-current={current === n.key ? "page" : undefined}
              className={
                current === n.key
                  ? "text-amber"
                  : "text-ink-dim transition hover:text-ink"
              }
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 font-board text-[10px] uppercase tracking-widest text-ink-dim">
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="text-amber/80 transition hover:text-amber">
              Admin
            </Link>
          )}
          {user?.name && <span className="hidden text-ink sm:inline">{user.name}</span>}
          <form action={signOutAction}>
            <button type="submit" className="transition hover:text-cancelled">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
