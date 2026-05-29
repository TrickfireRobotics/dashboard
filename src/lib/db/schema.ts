import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export * from "./auth-schema";
import { user } from "./auth-schema";

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export type OrderStatus = "pending" | "approved" | "rejected" | "ordered";
export type WhitelistStatus = "pending" | "approved" | "rejected";

export const team = sqliteTable("team", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const order = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  teamId: integer("team_id").references(() => team.id, {
    onDelete: "set null",
  }),
  itemName: text("item_name").notNull(),
  vendorUrl: text("vendor_url"),
  description: text("description"),
  partType: text("part_type"),
  partNumber: text("part_number"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price"),
  status: text("status")
    .$type<OrderStatus>()
    .notNull()
    .default("pending"),
  adminNote: text("admin_note"),
  reviewedBy: text("reviewed_by").references(() => user.id, {
    onDelete: "set null",
  }),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(now)
    .notNull(),
});

export const apiKey = sqliteTable("api_key", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  isRevoked: integer("is_revoked", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(now)
    .notNull(),
});

export const minecraftWhitelist = sqliteTable("minecraft_whitelist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  username: text("username").notNull(),
  status: text("status")
    .$type<WhitelistStatus>()
    .notNull()
    .default("pending"),
  requestNote: text("request_note"),
  adminNote: text("admin_note"),
  reviewedBy: text("reviewed_by").references(() => user.id, {
    onDelete: "set null",
  }),
  addedDirectly: integer("added_directly", { mode: "boolean" })
    .notNull()
    .default(false),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(now)
    .notNull(),
});

export const orderRelations = relations(order, ({ one }) => ({
  user: one(user, { fields: [order.userId], references: [user.id] }),
  team: one(team, { fields: [order.teamId], references: [team.id] }),
  reviewer: one(user, {
    fields: [order.reviewedBy],
    references: [user.id],
  }),
}));

export const apiKeyRelations = relations(apiKey, ({ one }) => ({
  user: one(user, { fields: [apiKey.userId], references: [user.id] }),
}));

export const minecraftWhitelistRelations = relations(
  minecraftWhitelist,
  ({ one }) => ({
    user: one(user, {
      fields: [minecraftWhitelist.userId],
      references: [user.id],
    }),
  }),
);
