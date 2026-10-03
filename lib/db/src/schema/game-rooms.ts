import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const gameRoomsTable = pgTable("game_rooms", {
  code: text("code").primaryKey(),
  status: text("status").notNull(),
  version: integer("version").notNull().default(0),
  game: jsonb("game").notNull(),
  members: jsonb("members").notNull(),
  receipts: jsonb("receipts").notNull(),
  transition: jsonb("transition"),
  rematchVotes: jsonb("rematch_votes").notNull(),
  readyAt: timestamp("ready_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});