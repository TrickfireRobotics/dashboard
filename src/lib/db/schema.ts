import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export * from "./auth-schema";
import { user } from "./auth-schema";

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export type OrderStatus = "pending" | "approved" | "denied";
export type FundType = "STF" | "Gift";
export type GiftFundChangeType = "order_approved" | "manual_adjustment";
export type WhitelistStatus = "pending" | "approved" | "rejected";
export type JoinRequestStatus = "pending" | "approved" | "rejected";
export type VaultEntryType = "login" | "api_key";
export type FeatureStatus = "pending" | "granted" | "rejected";

export const team = sqliteTable("team", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
});

export const stfQuarter = sqliteTable("stf_quarter", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
});

export const stfBucket = sqliteTable("stf_bucket", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    quarterId: integer("quarter_id")
        .notNull()
        .references(() => stfQuarter.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startingBalanceCents: integer("starting_balance_cents").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
});

export const giftFund = sqliteTable("gift_fund", {
    id: integer("id").primaryKey(),
    currentValueCents: integer("current_value_cents").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
        .default(now)
        .$onUpdate(() => new Date())
        .notNull(),
});

export const order = sqliteTable("orders", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    fundType: text("fund_type").$type<FundType>().notNull(),
    stfBucketId: integer("stf_bucket_id").references(() => stfBucket.id, {
        onDelete: "set null",
    }),
    quarterId: integer("quarter_id").references(() => stfQuarter.id, {
        onDelete: "set null",
    }),
    vendor: text("vendor").notNull(),
    link: text("link").notNull(),
    itemName: text("item_name").notNull(),
    partNumber: text("part_number"),
    quantity: integer("quantity").notNull().default(1),
    unitCostCents: integer("unit_cost_cents").notNull(),
    notes: text("notes"),
    status: text("status").$type<OrderStatus>().notNull().default("pending"),
    denialComment: text("denial_comment"),
    reviewedBy: text("reviewed_by").references(() => user.id, {
        onDelete: "set null",
    }),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
});

export const giftFundLog = sqliteTable("gift_fund_log", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).default(now).notNull(),
    changedBy: text("changed_by").references(() => user.id, { onDelete: "set null" }),
    changeType: text("change_type").$type<GiftFundChangeType>().notNull(),
    previousValueCents: integer("previous_value_cents").notNull(),
    newValueCents: integer("new_value_cents").notNull(),
    orderId: integer("order_id").references(() => order.id, { onDelete: "set null" }),
    note: text("note"),
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

export const networkJoinRequest = sqliteTable("network_join_request", {
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

export const orderHistory = sqliteTable("order_history", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
        .notNull()
        .references(() => order.id, { onDelete: "cascade" }),
    fromStatus: text("from_status").$type<OrderStatus>(),
    toStatus: text("to_status").$type<OrderStatus>().notNull(),
    changedBy: text("changed_by").references(() => user.id, { onDelete: "set null" }),
    note: text("note"),
    changedAt: integer("changed_at", { mode: "timestamp_ms" }).default(now).notNull(),
});

export const stfQuarterRelations = relations(stfQuarter, ({ many }) => ({
    buckets: many(stfBucket),
    orders: many(order),
}));

export const stfBucketRelations = relations(stfBucket, ({ one, many }) => ({
    quarter: one(stfQuarter, {
        fields: [stfBucket.quarterId],
        references: [stfQuarter.id],
    }),
    orders: many(order),
}));

export const giftFundLogRelations = relations(giftFundLog, ({ one }) => ({
    changedByUser: one(user, { fields: [giftFundLog.changedBy], references: [user.id] }),
    order: one(order, { fields: [giftFundLog.orderId], references: [order.id] }),
}));

export const orderRelations = relations(order, ({ one, many }) => ({
    user: one(user, { fields: [order.userId], references: [user.id] }),
    stfBucket: one(stfBucket, { fields: [order.stfBucketId], references: [stfBucket.id] }),
    quarter: one(stfQuarter, { fields: [order.quarterId], references: [stfQuarter.id] }),
    reviewer: one(user, {
        fields: [order.reviewedBy],
        references: [user.id],
    }),
    history: many(orderHistory),
}));

export const orderHistoryRelations = relations(orderHistory, ({ one }) => ({
    order: one(order, { fields: [orderHistory.orderId], references: [order.id] }),
    changedBy: one(user, { fields: [orderHistory.changedBy], references: [user.id] }),
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

export const networkJoinRequestRelations = relations(networkJoinRequest, ({ one }) => ({
    user: one(user, {
        fields: [networkJoinRequest.userId],
        references: [user.id],
    }),
    reviewer: one(user, {
        fields: [networkJoinRequest.reviewedBy],
        references: [user.id],
    }),
}));

export const userFeature = sqliteTable(
    "user_feature",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        featureKey: text("feature_key").notNull(),
        status: text("status").$type<FeatureStatus>().notNull().default("pending"),
        requestNote: text("request_note"),
        adminNote: text("admin_note"),
        reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
        reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
        requestedAt: integer("requested_at", { mode: "timestamp_ms" }).default(now).notNull(),
    },
    (table) => [
        uniqueIndex("user_feature_unique").on(table.userId, table.featureKey),
        index("user_feature_userId_idx").on(table.userId),
    ]
);

export const userFeatureRelations = relations(userFeature, ({ one }) => ({
    user: one(user, { fields: [userFeature.userId], references: [user.id] }),
    reviewer: one(user, { fields: [userFeature.reviewedBy], references: [user.id] }),
}));
