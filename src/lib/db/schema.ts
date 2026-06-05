import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export * from "./auth-schema";
import { user } from "./auth-schema";

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export type OrderStatus = "pending" | "approved" | "rejected" | "ordered";
export type WhitelistStatus = "pending" | "approved" | "rejected";
export type JoinRequestStatus = "pending" | "approved" | "rejected";
export type VaultEntryType = "login" | "api_key";

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
    status: text("status").$type<OrderStatus>().notNull().default("pending"),
    adminNote: text("admin_note"),
    reviewedBy: text("reviewed_by").references(() => user.id, {
        onDelete: "set null",
    }),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
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
    isRevoked: integer("is_revoked", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
});

// Secret vault: shared club credentials stored encrypted at rest (see
// vault-crypto.ts). Distinct from `api_key` above, which holds one-way hashes
// for service-API auth and can never reveal a secret.
export const vaultEntry = sqliteTable("vault_entry", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    type: text("type").$type<VaultEntryType>().notNull(),
    description: text("description"),
    // Login identifier for `login` entries; null for `api_key` entries.
    username: text("username"),
    // AES-256-GCM ciphertext ("iv.tag.ct") of the password / API key.
    secret: text("secret").notNull(),
    // Applies to `login` entries only: when false the UI hides the copy button
    // and resists selection. `api_key` entries are never shown in the UI - they
    // are fetched through the authenticated key endpoint - so this is ignored
    // for them.
    easyCopy: integer("easy_copy", { mode: "boolean" }).notNull().default(true),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
        .default(now)
        .$onUpdate(() => new Date())
        .notNull(),
});

// Per-person read grants for `api_key` vault entries. An entry's secret is only
// returned by GET /api/vault/[id]/key to admins or users with a row here.
export const vaultEntryAccess = sqliteTable(
    "vault_entry_access",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        entryId: integer("entry_id")
            .notNull()
            .references(() => vaultEntry.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        grantedBy: text("granted_by").references(() => user.id, { onDelete: "set null" }),
        createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
    },
    (table) => [uniqueIndex("vault_entry_access_entry_user").on(table.entryId, table.userId)]
);

export const minecraftWhitelist = sqliteTable("minecraft_whitelist", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    username: text("username").notNull(),
    status: text("status").$type<WhitelistStatus>().notNull().default("pending"),
    requestNote: text("request_note"),
    adminNote: text("admin_note"),
    reviewedBy: text("reviewed_by").references(() => user.id, {
        onDelete: "set null",
    }),
    addedDirectly: integer("added_directly", { mode: "boolean" }).notNull().default(false),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
});

export const headscaleJoinRequest = sqliteTable("headscale_join_request", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    deviceName: text("device_name").notNull(),
    machineKey: text("machine_key"),
    requestNote: text("request_note"),
    adminNote: text("admin_note"),
    status: text("status").$type<JoinRequestStatus>().notNull().default("pending"),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
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

export const vaultEntryRelations = relations(vaultEntry, ({ one, many }) => ({
    creator: one(user, { fields: [vaultEntry.createdBy], references: [user.id] }),
    grants: many(vaultEntryAccess),
}));

export const vaultEntryAccessRelations = relations(vaultEntryAccess, ({ one }) => ({
    entry: one(vaultEntry, {
        fields: [vaultEntryAccess.entryId],
        references: [vaultEntry.id],
    }),
    user: one(user, { fields: [vaultEntryAccess.userId], references: [user.id] }),
}));

export const minecraftWhitelistRelations = relations(minecraftWhitelist, ({ one }) => ({
    user: one(user, {
        fields: [minecraftWhitelist.userId],
        references: [user.id],
    }),
}));

export const headscaleJoinRequestRelations = relations(headscaleJoinRequest, ({ one }) => ({
    user: one(user, {
        fields: [headscaleJoinRequest.userId],
        references: [user.id],
    }),
    reviewer: one(user, {
        fields: [headscaleJoinRequest.reviewedBy],
        references: [user.id],
    }),
}));
