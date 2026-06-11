"use client";

/** Champion picker — confirms before locking, since the pick can't be changed afterwards. */
export function PickForm({
  action,
  teams,
}: {
  action: (formData: FormData) => Promise<void>;
  teams: { code: string; name: string; flag: string }[];
}) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-4">
      <span className="font-board text-[11px] uppercase tracking-widest text-ink-dim">Your call</span>
      <select
        name="team"
        defaultValue=""
        className="rounded border border-hairline bg-board-raised px-2 py-1.5 text-sm text-ink"
      >
        <option value="">— pick a team —</option>
        {teams.map((t) => (
          <option key={t.code} value={t.code}>
            {t.flag} {t.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        onClick={(e) => {
          const sel = e.currentTarget.form?.elements.namedItem("team") as HTMLSelectElement | null;
          const value = sel?.value;
          if (!value) {
            e.preventDefault();
            return;
          }
          const label = sel?.options[sel.selectedIndex]?.text ?? value;
          if (!window.confirm(`Lock in ${label} as your champion? You can't change this later.`)) {
            e.preventDefault();
          }
        }}
        className="rounded-md bg-amber px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-tarmac transition hover:brightness-110"
      >
        Lock it in
      </button>
      <span className="font-board text-[10px] uppercase tracking-wider text-ink-dim">
        final — no changes once locked
      </span>
    </form>
  );
}
