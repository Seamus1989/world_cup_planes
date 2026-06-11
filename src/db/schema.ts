import {
  pgTable,
  pgEnum,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const roleEnum = pgEnum("role", ["ADMIN", "PLAYER"]);
export const userStatusEnum = pgEnum("user_status", ["PENDING", "ACTIVE", "DECLINED"]);
export const seatTypeEnum = pgEnum("seat_type", ["PRIMARY", "STANDBY"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "PAID", "REFUNDED"]);
export const stageEnum = pgEnum("stage", ["GROUP", "R32", "R16", "QF", "SF", "THIRD", "FINAL"]);
export const matchStatusEnum = pgEnum("match_status", ["SCHEDULED", "LIVE", "FINISHED"]);
export const periodEnum = pgEnum("period", [
  "FIRST_HALF",
  "SECOND_HALF",
  "ET1",
  "ET2",
  "PENS",
]);
export const eventTypeEnum = pgEnum("event_type", [
  "GOAL",
  "OWN_GOAL",
  "PENALTY_GOAL",
  "PENALTY_MISS",
  "ASSIST",
  "YELLOW",
  "RED",
]);
export const predictionTypeEnum = pgEnum("prediction_type", [
  "BRACKET",
  "DAILY_SCORE",
  "GOLDEN_BOOT",
  "GROUP_WINNER",
]);

/* ------------------------------------------------------------------ */
/* Auth.js (Drizzle adapter) + app-specific user fields                */
/* ------------------------------------------------------------------ */

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  // app-specific
  role: roleEnum("role").notNull().default("PLAYER"),
  status: userStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

/* ------------------------------------------------------------------ */
/* Tournament                                                          */
/* ------------------------------------------------------------------ */

export const teams = pgTable("team", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  code: text("code").notNull(), // 3-letter, e.g. ENG
  flagEmoji: text("flag_emoji"),
  groupLetter: text("group_letter"), // A..L
  confederation: text("confederation"), // UEFA, CONMEBOL, ...
  seedPot: integer("seed_pot"), // draw pot 1..4
  eliminated: boolean("eliminated").notNull().default(false),
  eliminatedAt: timestamp("eliminated_at", { mode: "date" }),
  exitStage: stageEnum("exit_stage"), // how far they got
  isPlaceholder: boolean("is_placeholder").notNull().default(false), // until real data verified
});

export const players = pgTable(
  "player",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name"), // lowercased/trimmed key for dedup
    position: text("position"),
    shirtNumber: integer("shirt_number"),
  },
  (t) => [uniqueIndex("player_team_name_unique").on(t.teamId, t.normalizedName)],
);

/** A seat = a team owned by a player. Unique on team → one owner per team. */
export const seats = pgTable(
  "seat",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    type: seatTypeEnum("type").notNull().default("PRIMARY"),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("PENDING"),
    stakePennies: integer("stake_pennies").notNull().default(500),
    multiplier: real("multiplier").notNull().default(1), // Standby Upgrade boost
    revealOrder: integer("reveal_order"), // sequence in the big reveal
    revealedAt: timestamp("revealed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (seat) => [uniqueIndex("seat_team_unique").on(seat.teamId)],
);

export const matches = pgTable("match", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  stage: stageEnum("stage").notNull().default("GROUP"),
  groupLetter: text("group_letter"),
  matchNumber: integer("match_number"), // official fixture number 1..104
  bracketIndex: integer("bracket_index"), // knockout slot within its stage (1..N)
  homeTeamId: text("home_team_id").references(() => teams.id),
  awayTeamId: text("away_team_id").references(() => teams.id),
  homeLabel: text("home_label"), // e.g. "Winner Group A" before teams are known
  awayLabel: text("away_label"),
  kickoffUtc: timestamp("kickoff_utc", { mode: "date" }).notNull(),
  venue: text("venue"),
  city: text("city"),
  status: matchStatusEnum("status").notNull().default("SCHEDULED"),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  homePens: integer("home_pens"),
  awayPens: integer("away_pens"),
  winnerTeamId: text("winner_team_id").references(() => teams.id),
});

export const matchEvents = pgTable("match_event", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  matchId: text("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  teamId: text("team_id").references(() => teams.id),
  playerId: text("player_id").references(() => players.id),
  playerName: text("player_name"), // scorer / carded player (free text from extraction)
  assistName: text("assist_name"), // assisting player, for goals
  type: eventTypeEnum("type").notNull(),
  minute: integer("minute"),
  period: periodEnum("period"),
  note: text("note"),
  source: text("source"), // URL the data was extracted from
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Side quests + config                                                */
/* ------------------------------------------------------------------ */

export const predictions = pgTable("prediction", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: predictionTypeEnum("type").notNull(),
  matchId: text("match_id").references(() => matches.id, { onDelete: "cascade" }),
  payload: jsonb("payload"),
  points: integer("points").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/** Single-row config table (id = "singleton"). */
export const settings = pgTable("settings", {
  id: text("id").primaryKey().default("singleton"),
  seatCap: integer("seat_cap").notNull().default(3),
  stakePennies: integer("stake_pennies").notNull().default(500),
  depositDeadline: timestamp("deposit_deadline", { mode: "date" }),
  standbyOpen: boolean("standby_open").notNull().default(false),
  potSplit: jsonb("pot_split"), // { champion: 40, runnerUp: 15, goldenBoot: 10, ... }
  drawCommittedAt: timestamp("draw_committed_at", { mode: "date" }),
  standbyDrawCommittedAt: timestamp("standby_draw_committed_at", { mode: "date" }),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
