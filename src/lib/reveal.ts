import { asc, eq } from "drizzle-orm";
import { db, ensureSchema, schema } from "@/db";
import { TEAM_COORDS } from "./coords";

const { seats, users, teams } = schema;

export type RevealTeam = {
  team: string;
  code: string;
  flag: string;
  group: string | null;
  lat: number;
  lng: number;
  type: string;
  eliminated: boolean;
};

export type RevealGroup = {
  order: number;
  userName: string;
  userImage: string | null;
  teams: RevealTeam[];
};

/** One entry per person, carrying all their teams (primary first), in reveal order. */
export async function getRevealGroups(): Promise<RevealGroup[]> {
  await ensureSchema();
  const rows = await db
    .select({
      userId: seats.userId,
      order: seats.revealOrder,
      type: seats.type,
      userName: users.name,
      userImage: users.image,
      team: teams.name,
      code: teams.code,
      flag: teams.flagEmoji,
      group: teams.groupLetter,
      eliminated: teams.eliminated,
    })
    .from(seats)
    .innerJoin(users, eq(users.id, seats.userId))
    .innerJoin(teams, eq(teams.id, seats.teamId))
    .orderBy(asc(seats.revealOrder));

  const byUser = new Map<string, RevealGroup>();
  let seq = 0;
  for (const r of rows) {
    const c = TEAM_COORDS[r.code ?? ""] ?? [0, 0];
    let g = byUser.get(r.userId);
    if (!g) {
      g = { order: r.order ?? seq++, userName: r.userName ?? "Player", userImage: r.userImage, teams: [] };
      byUser.set(r.userId, g);
    }
    g.teams.push({
      team: r.team,
      code: r.code,
      flag: r.flag ?? "",
      group: r.group,
      lat: c[0],
      lng: c[1],
      type: r.type,
      eliminated: r.eliminated,
    });
  }

  const groups = [...byUser.values()];
  for (const g of groups) {
    g.teams.sort((a, b) => (a.type === "PRIMARY" ? 0 : 1) - (b.type === "PRIMARY" ? 0 : 1));
  }
  groups.sort((a, b) => a.order - b.order);
  return groups;
}
