ALTER TABLE "player" ADD COLUMN "normalized_name" text;--> statement-breakpoint
CREATE UNIQUE INDEX "player_team_name_unique" ON "player" USING btree ("team_id","normalized_name");