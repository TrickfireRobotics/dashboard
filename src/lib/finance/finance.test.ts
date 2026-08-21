import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { giftFund, giftFundLog, order, orderHistory, stfBucket, user } from "@/lib/db/schema";
import {
    assignOrdersToFund,
    batchTotalCents,
    deductGiftFundForApproval,
    getBucketPendingSpendCents,
    getBucketRemainingCents,
    validateAssignmentBalance,
    validateBatchBalance,
    validateOrderBalance,
    ensureFinanceSettingsRow,
    ensureGiftFundRow,
    getActiveQuarter,
    getBucketApprovedSpendCents,
    getOrderPricingSettings,
    GIFT_FUND_ID,
    markApprovedOrdersAsOrdered,
    orderTotalCents,
    restoreGiftFundForDeletion,
    updateOrderPricingSettings,
} from "./finance";
import { DEFAULT_ORDER_PRICING } from "./order-pricing";

const TEST_ITEM_PREFIX = "vitest-order-";

function cleanupTestOrders() {
    const rows = db
        .select({ id: order.id, itemName: order.itemName })
        .from(order)
        .all()
        .filter((row) => row.itemName.startsWith(TEST_ITEM_PREFIX));

    for (const { id } of rows) {
        db.delete(orderHistory).where(eq(orderHistory.orderId, id)).run();
        db.delete(giftFundLog).where(eq(giftFundLog.orderId, id)).run();
        db.delete(order).where(eq(order.id, id)).run();
    }
}

beforeAll(() => {
    ensureFinanceSettingsRow();
    ensureGiftFundRow();
});

afterEach(() => {
    cleanupTestOrders();
});

describe("orderTotalCents", () => {
    it("includes default tax and shipping on the gift subtotal", () => {
        expect(orderTotalCents(2, 5000, "Gift")).toBe(13_100);
    });

    it("includes flux, tax, and shipping on the STF subtotal", () => {
        expect(orderTotalCents(2, 5000, "STF")).toBe(15_720);
    });

    it("returns 0 when quantity is 0", () => {
        expect(orderTotalCents(0, 5000, "Gift")).toBe(0);
    });

    it("returns 0 when unit cost is 0", () => {
        expect(orderTotalCents(5, 0, "STF")).toBe(0);
    });

    it("handles large quantities and costs without overflow", () => {
        const result = orderTotalCents(9999, 999999, "Gift");
        expect(Number.isFinite(result)).toBe(true);
        expect(result).toBe(
            computeExpectedTotal(
                9999,
                999999,
                DEFAULT_ORDER_PRICING.taxPercentBps,
                DEFAULT_ORDER_PRICING.shippingPercentBps
            )
        );
    });
});

describe("updateOrderPricingSettings", () => {
    it("persists custom tax and shipping rates", () => {
        const previous = getOrderPricingSettings();
        updateOrderPricingSettings({ taxPercentBps: 500, shippingPercentBps: 1000 });

        expect(getOrderPricingSettings()).toEqual({ taxPercentBps: 500, shippingPercentBps: 1000 });
        expect(orderTotalCents(1, 10_000, "Gift")).toBe(11_500);
        expect(orderTotalCents(1, 10_000, "STF")).toBe(13_800);

        updateOrderPricingSettings(previous);
        expect(getOrderPricingSettings()).toEqual(previous);
    });
});

describe("getBucketApprovedSpendCents", () => {
    it("counts both approved and ordered orders toward bucket spend", () => {
        const quarter = getActiveQuarter();
        const requester = db.select().from(user).limit(1).get();
        const bucketRecord = db
            .select()
            .from(stfBucket)
            .where(and(eq(stfBucket.isActive, true)))
            .limit(1)
            .get();

        if (!quarter || !requester || !bucketRecord) return;

        const spendBefore = getBucketApprovedSpendCents(bucketRecord.id, quarter.id);

        const approved = db
            .insert(order)
            .values({
                userId: requester.id,
                fundType: "STF",
                stfBucketId: bucketRecord.id,
                quarterId: quarter.id,
                vendor: "Test Vendor",
                link: "https://example.com/part",
                itemName: `${TEST_ITEM_PREFIX}approved`,
                partNumber: "TEST-001",
                quantity: 1,
                unitCostCents: 1000,
                status: "approved",
            })
            .returning()
            .get();

        const spendAfterApproved = getBucketApprovedSpendCents(bucketRecord.id, quarter.id);
        expect(spendAfterApproved - spendBefore).toBe(orderTotalCents(1, 1000, "STF"));

        db.update(order).set({ status: "ordered" }).where(eq(order.id, approved.id)).run();
        const spendAfterOrdered = getBucketApprovedSpendCents(bucketRecord.id, quarter.id);
        expect(spendAfterOrdered).toBe(spendAfterApproved);
    });
});

describe("restoreGiftFundForDeletion", () => {
    it("refunds gift fund when an approved order is deleted", () => {
        const requester = db.select().from(user).limit(1).get();
        if (!requester) return;

        db.update(giftFund)
            .set({ currentValueCents: 20_000 })
            .where(eq(giftFund.id, GIFT_FUND_ID))
            .run();

        const giftOrder = db
            .insert(order)
            .values({
                userId: requester.id,
                fundType: "Gift",
                vendor: "Test Vendor",
                link: "https://example.com/gift",
                itemName: `${TEST_ITEM_PREFIX}gift-refund`,
                quantity: 1,
                unitCostCents: 5000,
                notes: "Test refund",
                status: "approved",
            })
            .returning()
            .get();

        const total = orderTotalCents(1, 5000, "Gift");
        deductGiftFundForApproval(giftOrder.id, total, requester.id);

        const afterDeduction = db
            .select()
            .from(giftFund)
            .where(eq(giftFund.id, GIFT_FUND_ID))
            .get()!.currentValueCents;
        expect(afterDeduction).toBe(20_000 - total);

        restoreGiftFundForDeletion(giftOrder.id, total, requester.id);
        const afterRefund = db.select().from(giftFund).where(eq(giftFund.id, GIFT_FUND_ID)).get()!
            .currentValueCents;
        expect(afterRefund).toBe(20_000);

        db.update(giftFund)
            .set({ currentValueCents: 0 })
            .where(eq(giftFund.id, GIFT_FUND_ID))
            .run();
    });
});

describe("markApprovedOrdersAsOrdered", () => {
    it("moves approved orders to ordered and records history", () => {
        const requester = db.select().from(user).limit(1).get();
        const quarter = getActiveQuarter();
        const bucketRecord = db
            .select()
            .from(stfBucket)
            .where(and(eq(stfBucket.isActive, true)))
            .limit(1)
            .get();
        if (!requester || !quarter || !bucketRecord) return;

        const created = db
            .insert(order)
            .values({
                userId: requester.id,
                fundType: "STF",
                stfBucketId: bucketRecord.id,
                quarterId: quarter.id,
                vendor: "Test Vendor",
                link: "https://example.com/mark-ordered",
                itemName: `${TEST_ITEM_PREFIX}mark-ordered`,
                partNumber: "TEST-002",
                quantity: 1,
                unitCostCents: 2000,
                status: "approved",
            })
            .returning()
            .get();

        const movedCount = markApprovedOrdersAsOrdered(requester.id);
        expect(movedCount).toBeGreaterThanOrEqual(1);

        const updated = db.select().from(order).where(eq(order.id, created.id)).get();
        expect(updated?.status).toBe("ordered");

        const history = db
            .select()
            .from(orderHistory)
            .where(eq(orderHistory.orderId, created.id))
            .all();
        expect(history.some((h) => h.fromStatus === "approved" && h.toStatus === "ordered")).toBe(
            true
        );
    });

    it("returns zero when there are no approved orders", () => {
        const requester = db.select().from(user).limit(1).get();
        if (!requester) return;

        const previouslyApproved = db
            .select()
            .from(order)
            .where(eq(order.status, "approved"))
            .all();
        for (const existing of previouslyApproved) {
            db.update(order).set({ status: "ordered" }).where(eq(order.id, existing.id)).run();
        }

        try {
            expect(markApprovedOrdersAsOrdered(requester.id)).toBe(0);
        } finally {
            for (const existing of previouslyApproved) {
                db.update(order).set({ status: "approved" }).where(eq(order.id, existing.id)).run();
            }
        }
    });

    it("moves only the specified approved orders", () => {
        const requester = db.select().from(user).limit(1).get();
        const quarter = getActiveQuarter();
        const bucketRecord = db
            .select()
            .from(stfBucket)
            .where(and(eq(stfBucket.isActive, true)))
            .limit(1)
            .get();
        if (!requester || !quarter || !bucketRecord) return;

        const first = db
            .insert(order)
            .values({
                userId: requester.id,
                fundType: "STF",
                stfBucketId: bucketRecord.id,
                quarterId: quarter.id,
                vendor: "Test Vendor",
                link: "https://example.com/select-1",
                itemName: `${TEST_ITEM_PREFIX}select-one`,
                partNumber: "TEST-010",
                quantity: 1,
                unitCostCents: 1000,
                status: "approved",
            })
            .returning()
            .get();

        const second = db
            .insert(order)
            .values({
                userId: requester.id,
                fundType: "STF",
                stfBucketId: bucketRecord.id,
                quarterId: quarter.id,
                vendor: "Test Vendor",
                link: "https://example.com/select-2",
                itemName: `${TEST_ITEM_PREFIX}select-two`,
                partNumber: "TEST-011",
                quantity: 1,
                unitCostCents: 2000,
                status: "approved",
            })
            .returning()
            .get();

        expect(markApprovedOrdersAsOrdered(requester.id, [first.id])).toBe(1);

        expect(db.select().from(order).where(eq(order.id, first.id)).get()?.status).toBe("ordered");
        expect(db.select().from(order).where(eq(order.id, second.id)).get()?.status).toBe(
            "approved"
        );
    });
});

function computeExpectedTotal(
    quantity: number,
    unitCostCents: number,
    taxPercentBps: number,
    shippingPercentBps: number
) {
    const subtotal = quantity * unitCostCents;
    const tax = Math.round((subtotal * taxPercentBps) / 10_000);
    const shipping = Math.round((subtotal * shippingPercentBps) / 10_000);
    return subtotal + tax + shipping;
}

describe("batchTotalCents", () => {
    it("sums each item at its fund's rate", () => {
        const items = [
            { quantity: 2, unitCostCents: 5000 },
            { quantity: 1, unitCostCents: 1000 },
        ];
        expect(batchTotalCents("Gift", items)).toBe(
            orderTotalCents(2, 5000, "Gift") + orderTotalCents(1, 1000, "Gift")
        );
        expect(batchTotalCents("STF", items)).toBe(
            orderTotalCents(2, 5000, "STF") + orderTotalCents(1, 1000, "STF")
        );
    });

    it("is 0 for an empty batch", () => {
        expect(batchTotalCents("STF", [])).toBe(0);
    });
});

describe("validateOrderBalance", () => {
    it("refuses an order with no fund assigned", () => {
        const result = validateOrderBalance(null, null, 1000);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.message).toMatch(/assign/i);
    });
});

describe("validateBatchBalance", () => {
    it("passes an empty batch", () => {
        expect(validateBatchBalance("Gift", null, []).ok).toBe(true);
    });

    it("rejects a batch that individually fits but together overdraws", () => {
        const giftBefore = db.select().from(giftFund).where(eq(giftFund.id, GIFT_FUND_ID)).get();
        db.update(giftFund)
            .set({ currentValueCents: orderTotalCents(1, 10_000, "Gift") })
            .where(eq(giftFund.id, GIFT_FUND_ID))
            .run();

        const one = [{ quantity: 1, unitCostCents: 10_000 }];
        expect(validateBatchBalance("Gift", null, one).ok).toBe(true);

        const two = [
            { quantity: 1, unitCostCents: 10_000 },
            { quantity: 1, unitCostCents: 10_000 },
        ];
        expect(validateBatchBalance("Gift", null, two).ok).toBe(false);

        db.update(giftFund)
            .set({ currentValueCents: giftBefore?.currentValueCents ?? 0 })
            .where(eq(giftFund.id, GIFT_FUND_ID))
            .run();
    });
});

describe("assignOrdersToFund", () => {
    it("stamps fund, bucket and quarter onto untriaged orders", () => {
        const quarter = getActiveQuarter();
        const requester = db.select().from(user).limit(1).get();
        const bucketRecord = db
            .select()
            .from(stfBucket)
            .where(eq(stfBucket.isActive, true))
            .limit(1)
            .get();
        if (!quarter || !requester || !bucketRecord) return;

        const created = db
            .insert(order)
            .values({
                userId: requester.id,
                vendor: "Test Vendor",
                link: "https://example.com/part",
                itemName: `${TEST_ITEM_PREFIX}untriaged`,
                quantity: 1,
                unitCostCents: 1000,
                status: "pending",
            })
            .returning()
            .get();

        expect(created.fundType).toBeNull();
        expect(created.quarterId).toBeNull();

        assignOrdersToFund([created.id], "STF", bucketRecord.id, requester.id);

        const after = db.select().from(order).where(eq(order.id, created.id)).get()!;
        expect(after.fundType).toBe("STF");
        expect(after.stfBucketId).toBe(bucketRecord.id);
        expect(after.quarterId).toBe(quarter.id);
        expect(after.assignedBy).toBe(requester.id);
        expect(after.assignedAt).toBeInstanceOf(Date);
    });

    it("clears the bucket when assigning to Gift", () => {
        const requester = db.select().from(user).limit(1).get();
        const bucketRecord = db
            .select()
            .from(stfBucket)
            .where(eq(stfBucket.isActive, true))
            .limit(1)
            .get();
        if (!requester || !bucketRecord) return;

        const created = db
            .insert(order)
            .values({
                userId: requester.id,
                fundType: "STF",
                stfBucketId: bucketRecord.id,
                vendor: "Test Vendor",
                link: "https://example.com/part",
                itemName: `${TEST_ITEM_PREFIX}reassign`,
                quantity: 1,
                unitCostCents: 1000,
                status: "pending",
            })
            .returning()
            .get();

        assignOrdersToFund([created.id], "Gift", null, requester.id);

        const after = db.select().from(order).where(eq(order.id, created.id)).get()!;
        expect(after.fundType).toBe("Gift");
        expect(after.stfBucketId).toBeNull();
        expect(after.quarterId).toBeNull();
    });
});

describe("getBucketPendingSpendCents", () => {
    it("counts pending assigned orders without touching the remaining balance", () => {
        const quarter = getActiveQuarter();
        const requester = db.select().from(user).limit(1).get();
        const bucketRecord = db
            .select()
            .from(stfBucket)
            .where(eq(stfBucket.isActive, true))
            .limit(1)
            .get();
        if (!quarter || !requester || !bucketRecord) return;

        const remainingBefore = getBucketRemainingCents(bucketRecord.id);
        const pendingBefore = getBucketPendingSpendCents(bucketRecord.id, quarter.id);

        const created = db
            .insert(order)
            .values({
                userId: requester.id,
                fundType: "STF",
                stfBucketId: bucketRecord.id,
                quarterId: quarter.id,
                vendor: "Test Vendor",
                link: "https://example.com/part",
                itemName: `${TEST_ITEM_PREFIX}queued`,
                quantity: 1,
                unitCostCents: 1000,
                status: "pending",
            })
            .returning()
            .get();

        expect(getBucketPendingSpendCents(bucketRecord.id, quarter.id)).toBe(
            pendingBefore + orderTotalCents(1, 1000, "STF")
        );
        // Pending orders are claims, not spend.
        expect(getBucketRemainingCents(bucketRecord.id)).toBe(remainingBefore);

        // Excluding the order under assignment avoids double-counting it.
        expect(getBucketPendingSpendCents(bucketRecord.id, quarter.id, [created.id])).toBe(
            pendingBefore
        );
    });
});

describe("validateAssignmentBalance", () => {
    it("counts orders already queued against the bucket", () => {
        const quarter = getActiveQuarter();
        const requester = db.select().from(user).limit(1).get();
        const bucketRecord = db
            .select()
            .from(stfBucket)
            .where(eq(stfBucket.isActive, true))
            .limit(1)
            .get();
        if (!quarter || !requester || !bucketRecord) return;

        const remaining = getBucketRemainingCents(bucketRecord.id);
        if (remaining == null || remaining <= 0) return;

        // A batch that exactly fills the bucket is allowed.
        const fillingUnitCents = Math.floor(remaining / 2);
        const filling = [{ quantity: 1, unitCostCents: fillingUnitCents }];
        expect(validateAssignmentBalance("STF", bucketRecord.id, [], filling).ok).toBe(true);

        // Park an order in the bucket, then the same batch no longer fits.
        db.insert(order)
            .values({
                userId: requester.id,
                fundType: "STF",
                stfBucketId: bucketRecord.id,
                quarterId: quarter.id,
                vendor: "Test Vendor",
                link: "https://example.com/part",
                itemName: `${TEST_ITEM_PREFIX}claim`,
                quantity: 1,
                unitCostCents: remaining,
                status: "pending",
            })
            .run();

        const result = validateAssignmentBalance("STF", bucketRecord.id, [], filling);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.message).toMatch(/awaiting approval/);
    });

    it("falls back to a plain balance check for Gift", () => {
        expect(validateAssignmentBalance("Gift", null, [], []).ok).toBe(true);
    });
});
