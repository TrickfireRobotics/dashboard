for (const f of [".env.local", ".env.production"]) {
    try {
        process.loadEnvFile(f);
        break;
    } catch {
        /* try next */
    }
}

import { eq } from "drizzle-orm";

import { db } from "../src/lib/db";
import { order, stfBucket, user } from "../src/lib/db/schema";
import { getActiveQuarter } from "../src/lib/finance";
import {
    formatApprovedGiftOrders,
    formatApprovedStfOrders,
    formatOrderForExcel,
} from "../src/lib/order-export";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

const admin = db.select().from(user).limit(1).get();
assert(admin != null, "Need a user");

const quarter = getActiveQuarter();
assert(quarter != null, "Need active school year");

const mechanical = db.select().from(stfBucket).where(eq(stfBucket.name, "Mechanical")).get();
assert(mechanical != null, "Need Mechanical bucket");

const stfId = db
    .insert(order)
    .values({
        userId: admin.id,
        fundType: "STF",
        stfBucketId: mechanical.id,
        quarterId: quarter.id,
        vendor: "McMaster-Carr",
        link: "https://example.com/bolt",
        itemName: "Hex bolt",
        partNumber: "91290A115",
        quantity: 10,
        unitCostCents: 45,
        notes: "Chassis hardware",
        status: "approved",
        reviewedBy: admin.id,
        reviewedAt: new Date(),
    })
    .returning({ id: order.id })
    .get().id;

const giftId = db
    .insert(order)
    .values({
        userId: admin.id,
        fundType: "Gift",
        vendor: "Amazon",
        link: "https://example.com/tape",
        itemName: "Gaff tape",
        partNumber: "TAPE-01",
        quantity: 2,
        unitCostCents: 1_299,
        notes: "Pit labeling",
        status: "approved",
        reviewedBy: admin.id,
        reviewedAt: new Date("2025-11-05"),
    })
    .returning({ id: order.id })
    .get().id;

// Same query shape as admin orders page
const rows = db
    .select({
        id: order.id,
        itemName: order.itemName,
        fundType: order.fundType,
        stfBucketName: stfBucket.name,
        quantity: order.quantity,
        unitCostCents: order.unitCostCents,
        vendor: order.vendor,
        link: order.link,
        notes: order.notes,
        partNumber: order.partNumber,
        status: order.status,
        createdAt: order.createdAt,
    })
    .from(order)
    .leftJoin(stfBucket, eq(order.stfBucketId, stfBucket.id))
    .where(eq(order.id, stfId))
    .all();

assert(rows.length === 1, "Should load STF order from DB");
const stfRow = formatOrderForExcel(rows[0]!);
assert(stfRow != null, "Approved STF should export");
assert(stfRow.includes("Mechanical"), "DB-backed STF export should include bucket");
assert(stfRow.includes("Hex bolt"), "DB-backed STF export should include item");

const giftRows = db
    .select({
        id: order.id,
        itemName: order.itemName,
        fundType: order.fundType,
        stfBucketName: stfBucket.name,
        quantity: order.quantity,
        unitCostCents: order.unitCostCents,
        vendor: order.vendor,
        link: order.link,
        notes: order.notes,
        partNumber: order.partNumber,
        status: order.status,
        createdAt: order.createdAt,
    })
    .from(order)
    .leftJoin(stfBucket, eq(order.stfBucketId, stfBucket.id))
    .where(eq(order.id, giftId))
    .all();

const giftRow = formatOrderForExcel(giftRows[0]!);
assert(giftRow != null, "Approved Gift should export");
assert(giftRow.includes("Gaff tape"), "DB-backed Gift export should include item");
assert(giftRow.includes("Pit labeling"), "DB-backed Gift export should include notes");

const allOrders = db
    .select({
        id: order.id,
        itemName: order.itemName,
        fundType: order.fundType,
        stfBucketName: stfBucket.name,
        quantity: order.quantity,
        unitCostCents: order.unitCostCents,
        vendor: order.vendor,
        link: order.link,
        notes: order.notes,
        partNumber: order.partNumber,
        status: order.status,
        createdAt: order.createdAt,
    })
    .from(order)
    .leftJoin(stfBucket, eq(order.stfBucketId, stfBucket.id))
    .all()
    .filter((o) => o.id === stfId || o.id === giftId);

const bulkStf = formatApprovedStfOrders(allOrders);
const bulkGift = formatApprovedGiftOrders(allOrders);
assert(bulkStf.includes("Hex bolt"), "Bulk STF from DB should include test order");
assert(bulkGift.includes("Gaff tape"), "Bulk Gift from DB should include test order");
assert(!bulkStf.startsWith("Subteam\t"), "Bulk STF should be data rows only");
assert(!bulkGift.startsWith("Date Requested\t"), "Bulk Gift should be data rows only");

db.delete(order).where(eq(order.id, stfId)).run();
db.delete(order).where(eq(order.id, giftId)).run();

console.log("End-to-end DB export checks passed.");
