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
import { giftFund, order, user } from "../src/lib/db/schema";
import {
    adjustGiftFund,
    deductGiftFundForApproval,
    getActiveQuarter,
    getBucketRemainingCents,
    getGiftFundValueCents,
    getStfBucketsWithBalances,
    assignOrdersToFund,
    orderTotalCents,
    validateAssignmentBalance,
    validateOrderBalance,
} from "../src/lib/finance/finance";
import { orderAssignSchema, orderBatchInputSchema } from "../src/lib/validation";
import {
    formatApprovedGiftOrders,
    formatApprovedStfOrders,
    formatStfOrderRow,
    stfOrderCalculations,
} from "../src/lib/finance/order-export";

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

// --- Excel export format (no DB writes) ---
const stfExportOrder = {
    itemName: "(Bucket Item) Fasteners",
    fundType: "STF" as const,
    stfBucketName: "Mechanical",
    quantity: 1,
    unitCostCents: 80_000,
    vendor: "Multiple vendors",
    link: "https://example.com/fasteners",
    notes: "Screws, bolts, nuts, etc",
    partNumber: "91290A115",
    createdAt: new Date("2025-09-15"),
    status: "approved" as const,
};

const calc = stfOrderCalculations(stfExportOrder.quantity, stfExportOrder.unitCostCents);
assert(calc.unitCost === 800, "STF unit cost should be $800");
assert(calc.preTaxTotal === 960, "Pre-tax total should be Qt * unit cost * flux");
assert(Math.abs(calc.tax - 105.6) < 0.01, "Tax should be 11% of pre-tax total");
assert(Math.abs(calc.shipping - 192) < 0.01, "Shipping should be 20% of pre-tax total");

const stfRow = formatStfOrderRow(stfExportOrder);
assert(stfRow.includes("Mechanical"), "STF row should include subteam");
assert(stfRow.includes("$800.00"), "STF row should include unit cost");
assert(Math.abs(calc.total - 1257.6) < 0.01, "STF total should include tax and shipping");
assert(stfRow.split("\t").length === 13, "STF row should have 13 columns");

const bulkStf = formatApprovedStfOrders([stfExportOrder]);
assert(!bulkStf.startsWith("Subteam\t"), "Bulk STF export should be data rows only");
assert(bulkStf.includes("(Bucket Item) Fasteners"), "Bulk STF export should include order data");

const giftExportOrder = {
    ...stfExportOrder,
    fundType: "Gift" as const,
    stfBucketName: null,
    itemName: "Pit tape",
    createdAt: new Date("2025-10-01"),
};
const bulkGift = formatApprovedGiftOrders([giftExportOrder]);
assert(!bulkGift.includes("Date Requested\t"), "Bulk Gift export should be data rows only");
assert(bulkGift.includes("Pit tape"), "Gift export should include item name");

// --- Balance API parity ---
const buckets = getStfBucketsWithBalances();
assert(buckets.length >= 2, "Expected seeded STF buckets");
const mechanical = buckets.find((b) => b.name === "Mechanical")!;
assert(mechanical.remainingBalanceCents > 0, "Mechanical bucket should have remaining balance");
const mechanicalRemainingBefore = mechanical.remainingBalanceCents;

// --- Validation schema (members submit items with no fund assigned) ---
const batchParsed = orderBatchInputSchema.safeParse({
    items: [
        {
            vendor: "McMaster-Carr",
            link: "https://example.com/part",
            itemName: "Test bolt",
            partNumber: "91290A115",
            quantity: 2,
            unitCost: 4.5,
        },
        {
            vendor: "Amazon",
            link: "https://example.com/gift-item",
            itemName: "Tape",
            quantity: 1,
            unitCost: 12,
            notes: "For pit organization",
        },
    ],
});
assert(batchParsed.success, "Multi-item submission should validate");
assert(batchParsed.data!.items.length === 2, "Both items should parse");
const stfData = batchParsed.data!.items[0];
const giftData = batchParsed.data!.items[1];

const emptyBatch = orderBatchInputSchema.safeParse({ items: [] });
assert(!emptyBatch.success, "Empty submission should fail");

const assignParsed = orderAssignSchema.safeParse({
    orderIds: [1],
    fundType: "STF",
    stfBucketId: mechanical.id,
});
assert(assignParsed.success, "STF assignment should validate");

const assignMissingBucket = orderAssignSchema.safeParse({ orderIds: [1], fundType: "STF" });
assert(!assignMissingBucket.success, "STF assignment without a bucket should fail");

const assignGift = orderAssignSchema.safeParse({ orderIds: [1], fundType: "Gift" });
assert(assignGift.success, "Gift assignment needs no bucket");

// --- Create STF order (mirrors POST /api/orders) ---
const admin = db.select().from(user).limit(1).get();
assert(admin != null, "Need a user in the database");

const stfUnitCents = Math.round(stfData.unitCost * 100);
const stfTotal = orderTotalCents(stfData.quantity, stfUnitCents, "STF");

const quarter = getActiveQuarter();
assert(quarter != null, "Active school year required");

// Submitted untriaged: no fund type, bucket or quarter yet.
const stfOrder = db
    .insert(order)
    .values({
        userId: admin!.id,
        vendor: stfData.vendor,
        link: stfData.link,
        itemName: stfData.itemName,
        partNumber: stfData.partNumber!,
        quantity: stfData.quantity,
        unitCostCents: stfUnitCents,
        notes: null,
        status: "pending",
    })
    .returning()
    .get();

assert(stfOrder.fundType == null, "New orders start with no fund type");
assert(
    !validateOrderBalance(null, null, stfTotal).ok,
    "An untriaged order must not pass the balance check"
);

const assignCheck = validateAssignmentBalance(
    "STF",
    mechanical.id,
    [stfOrder.id],
    [{ quantity: stfData.quantity, unitCostCents: stfUnitCents }]
);
assert(assignCheck.ok, "Assignment should fit inside the bucket");

assignOrdersToFund([stfOrder.id], "STF", mechanical.id, admin!.id);
const assigned = db.select().from(order).where(eq(order.id, stfOrder.id)).get()!;
assert(assigned.fundType === "STF", "Assignment should set the fund type");
assert(assigned.stfBucketId === mechanical.id, "Assignment should set the bucket");
assert(assigned.quarterId === quarter!.id, "Assignment should stamp the active quarter");

const remainingAfterPending = getBucketRemainingCents(mechanical.id);
assert(
    remainingAfterPending === mechanicalRemainingBefore,
    "Pending STF order must not reduce remaining balance"
);

db.update(order)
    .set({ status: "approved", reviewedBy: admin!.id, reviewedAt: new Date() })
    .where(eq(order.id, stfOrder.id))
    .run();

const remainingAfterApprove = getBucketRemainingCents(mechanical.id)!;
assert(
    remainingAfterApprove === mechanicalRemainingBefore - stfTotal,
    "Approved STF order should reduce remaining balance"
);

// --- Gift fund flow ---
adjustGiftFund(50_000, admin!.id, "Test deposit");
assert(getGiftFundValueCents() === 50_000, "Gift fund adjustment failed");

const giftUnitCents = Math.round(giftData.unitCost * 100);
const giftTotal = orderTotalCents(giftData.quantity, giftUnitCents, "Gift");

const giftOrder = db
    .insert(order)
    .values({
        userId: admin!.id,
        fundType: "Gift",
        vendor: giftData.vendor,
        link: giftData.link,
        itemName: giftData.itemName,
        quantity: giftData.quantity,
        unitCostCents: giftUnitCents,
        notes: giftData.notes!,
        status: "pending",
    })
    .returning()
    .get();

assert(getGiftFundValueCents() === 50_000, "Pending gift order must not deduct fund");

deductGiftFundForApproval(giftOrder.id, giftTotal, admin!.id);
assert(
    getGiftFundValueCents() === 50_000 - giftTotal,
    "Approved gift order should deduct from gift fund"
);

// Cleanup test orders
db.delete(order).where(eq(order.id, stfOrder.id)).run();
db.delete(order).where(eq(order.id, giftOrder.id)).run();
db.update(giftFund).set({ currentValueCents: 0 }).where(eq(giftFund.id, 1)).run();

console.log("Full order workflow checks passed.");
