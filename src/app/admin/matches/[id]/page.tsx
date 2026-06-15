import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { db, ensureSchema, schema } from "@/db";
import { requireAdmin } from "@/lib/session";
import { MatchConsole } from "./MatchConsole";
import type { DraftEvent } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  await requireAdmin();

  const home = alias(schema.teams, "home");
  const away = alias(schema.teams, "away");
  const [m] = await db
    .select({
      id: schema.matches.id,
      stage: schema.matches.stage,
      group: schema.matches.groupLetter,
      homeTeamId: schema.matches.homeTeamId,
      awayTeamId: schema.matches.awayTeamId,
      homeLabel: schema.matches.homeLabel,
      awayLabel: schema.matches.awayLabel,
      homeScore: schema.matches.homeScore,
      awayScore: schema.matches.awayScore,
      homePens: schema.matches.homePens,
      awayPens: schema.matches.awayPens,
      status: schema.matches.status,
    })
    .from(schema.matches)
    .where(eq(schema.matches.id, id))
    .limit(1);
  if (!m) notFound();

  const [evs, allTeams] = await Promise.all([
    db.select().from(schema.matchEvents).where(eq(schema.matchEvents.matchId, id)).orderBy(asc(schema.matchEvents.minute)),
    db.select({ id: schema.teams.id, name: schema.teams.name, flag: schema.teams.flagEmoji, group: schema.teams.groupLetter }).from(schema.teams),
  ]);

  const initialEvents: DraftEvent[] = evs.map((e) => ({
    team: e.teamId === m.homeTeamId ? "HOME" : "AWAY",
    type: e.type,
    player: e.playerName ?? "",
    assist: e.assistName,
    minute: e.minute,
  }));

  const teamOpts = allTeams
    .sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "") || a.name.localeCompare(b.name))
    .map((t) => ({ id: t.id, name: t.name, flag: t.flag ?? "" }));

  const nameOf = (id: string | null, label: string | null) =>
    teamOpts.find((t) => t.id === id)?.name ?? label ?? "team";
  const homeName = nameOf(m.homeTeamId, m.homeLabel);
  const awayName = nameOf(m.awayTeamId, m.awayLabel);
  const tmpl = process.env.SCRAPE_URL_TEMPLATE;
  const defaultUrl = tmpl
    ? tmpl.replaceAll("{home}", encodeURIComponent(homeName)).replaceAll("{away}", encodeURIComponent(awayName))
    : `https://www.google.com/search?q=${encodeURIComponent(`${homeName} vs ${awayName} 2026 World Cup result goalscorers`)}`;

  return (
    <MatchConsole
      match={{
        id: m.id,
        group: m.group,
        isKnockout: m.stage !== "GROUP",
        homeLabel: m.homeLabel,
        awayLabel: m.awayLabel,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
      }}
      allTeams={teamOpts}
      defaultUrl={defaultUrl}
      initial={{
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        homePens: m.homePens,
        awayPens: m.awayPens,
        status: m.status,
        events: initialEvents,
      }}
    />
  );
}
