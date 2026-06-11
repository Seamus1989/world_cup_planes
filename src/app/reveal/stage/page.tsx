import { getRevealGroups } from "@/lib/reveal";
import { RevealStage } from "@/components/reveal/RevealStage";
import { requireActive } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RevealStagePage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; person?: string }>;
}) {
  await requireActive();
  const { team, person } = await searchParams;
  let groups = await getRevealGroups();
  if (team) {
    const code = team.toUpperCase();
    const only = groups.filter((g) => g.teams.some((t) => t.code === code));
    if (only.length) groups = only; // ?team=ENG → preview that team's owner's squad
  } else if (person) {
    const q = person.toLowerCase();
    const only = groups.filter((g) => g.userName.toLowerCase().includes(q));
    if (only.length) groups = only;
  }
  return <RevealStage groups={groups} mode="stage" />;
}
