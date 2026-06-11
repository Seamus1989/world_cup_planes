"use client";

/** Run-the-draw form with a "teams per player" cap so leftovers can be left for The House / selling. */
export function DrawForm({
  action,
  playerCount,
}: {
  action: (formData: FormData) => Promise<void>;
  playerCount: number;
}) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
        Teams each (max)
        <select
          name="cap"
          defaultValue="3"
          className="rounded border border-hairline bg-board-raised px-2 py-1.5 text-sm text-ink"
        >
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </label>
      <button
        type="submit"
        onClick={(e) => {
          if (
            !window.confirm(
              `Run the draw for ${playerCount} players? Each gets up to the chosen number; leftovers go to The House. This closes new check-ins.`,
            )
          )
            e.preventDefault();
        }}
        className="rounded-md bg-amber px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-tarmac transition hover:brightness-110"
      >
        ✈ Run the draw
      </button>
    </form>
  );
}
