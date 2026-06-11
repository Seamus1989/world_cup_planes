CREATE TYPE "public"."event_type" AS ENUM('GOAL', 'OWN_GOAL', 'PENALTY_GOAL', 'PENALTY_MISS', 'ASSIST', 'YELLOW', 'RED');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('SCHEDULED', 'LIVE', 'FINISHED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PAID', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."period" AS ENUM('FIRST_HALF', 'SECOND_HALF', 'ET1', 'ET2', 'PENS');--> statement-breakpoint
CREATE TYPE "public"."prediction_type" AS ENUM('BRACKET', 'DAILY_SCORE', 'GOLDEN_BOOT', 'GROUP_WINNER');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'PLAYER');--> statement-breakpoint
CREATE TYPE "public"."seat_type" AS ENUM('PRIMARY', 'STANDBY');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('GROUP', 'R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('PENDING', 'ACTIVE', 'DECLINED');--> statement-breakpoint
CREATE TABLE "account" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "match_event" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"team_id" text,
	"player_id" text,
	"type" "event_type" NOT NULL,
	"minute" integer,
	"period" "period",
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match" (
	"id" text PRIMARY KEY NOT NULL,
	"stage" "stage" DEFAULT 'GROUP' NOT NULL,
	"group_letter" text,
	"match_number" integer,
	"home_team_id" text,
	"away_team_id" text,
	"home_label" text,
	"away_label" text,
	"kickoff_utc" timestamp NOT NULL,
	"venue" text,
	"city" text,
	"status" "match_status" DEFAULT 'SCHEDULED' NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"home_pens" integer,
	"away_pens" integer,
	"winner_team_id" text
);
--> statement-breakpoint
CREATE TABLE "player" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"name" text NOT NULL,
	"position" text,
	"shirt_number" integer
);
--> statement-breakpoint
CREATE TABLE "prediction" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "prediction_type" NOT NULL,
	"match_id" text,
	"payload" jsonb,
	"points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seat" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"team_id" text NOT NULL,
	"type" "seat_type" DEFAULT 'PRIMARY' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"stake_pennies" integer DEFAULT 500 NOT NULL,
	"multiplier" real DEFAULT 1 NOT NULL,
	"reveal_order" integer,
	"revealed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"seat_cap" integer DEFAULT 3 NOT NULL,
	"stake_pennies" integer DEFAULT 500 NOT NULL,
	"deposit_deadline" timestamp,
	"standby_open" boolean DEFAULT false NOT NULL,
	"pot_split" jsonb,
	"draw_committed_at" timestamp,
	"standby_draw_committed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"flag_emoji" text,
	"group_letter" text,
	"confederation" text,
	"seed_pot" integer,
	"eliminated" boolean DEFAULT false NOT NULL,
	"eliminated_at" timestamp,
	"exit_stage" "stage",
	"is_placeholder" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text,
	"role" "role" DEFAULT 'PLAYER' NOT NULL,
	"status" "user_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_token" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_event" ADD CONSTRAINT "match_event_match_id_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_event" ADD CONSTRAINT "match_event_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_event" ADD CONSTRAINT "match_event_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_home_team_id_team_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_away_team_id_team_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_winner_team_id_team_id_fk" FOREIGN KEY ("winner_team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player" ADD CONSTRAINT "player_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction" ADD CONSTRAINT "prediction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction" ADD CONSTRAINT "prediction_match_id_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat" ADD CONSTRAINT "seat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat" ADD CONSTRAINT "seat_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seat_team_unique" ON "seat" USING btree ("team_id");