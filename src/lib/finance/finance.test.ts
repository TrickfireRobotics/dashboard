import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { giftFund, giftFundLog, order, orderHistory, stfBucket, user } from "@/lib/db/schema";
import {
    deductGiftFundForApproval,
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
    it("includes default tax and shipping on the subtotal", () => {
        expect(orderTotalCents(2, 5000)).toBe(13_100);
    });

    it("returns 0 when quantity is 0", () => {
        expect(orderTotalCents(0, 5000)).toBe(0);
    });

    it("returns 0 when unit cost is 0", () => {
        expect(orderTotalCents(5, 0)).toBe(0);
    });

    it("handles large quantities and costs without overflow", () => {
        const result = orderTotalCents(9999, 999999);
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
        expect(orderTotalCents(1, 10_000)).toBe(11_500);

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
        expect(spendAfterApproved - spendBefore).toBe(orderTotalCents(1, 1000));

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

        const total = orderTotalCents(1, 5000);
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
