import { and, eq, inArray } from "drizzle-orm";

import { sendEmail } from "@/lib/integrations/email";
import { db } from "@/lib/db";
import {
    financeSettings,
    giftFund,
    giftFundLog,
    order,
    orderHistory,
    stfBucket,
    stfQuarter,
    type FundType,
} from "@/lib/db/schema";
import {
    computeOrderTotalCents,
    DEFAULT_ORDER_PRICING,
    type OrderPricingSettings,
} from "@/lib/finance/order-pricing";

export const GIFT_FUND_ID = 1;
export const FINANCE_SETTINGS_ID = 1;

export function orderTotalCents(quantity: number, unitCostCents: number): number {
    return computeOrderTotalCents(quantity, unitCostCents, getOrderPricingSettings());
}

export function getOrderPricingSettings(): OrderPricingSettings {
    const row = db
        .select()
        .from(financeSettings)
        .where(eq(financeSettings.id, FINANCE_SETTINGS_ID))
        .get();
    if (!row) return DEFAULT_ORDER_PRICING;
    return {
        taxPercentBps: row.taxPercentBps,
        shippingPercentBps: row.shippingPercentBps,
    };
}

export function ensureFinanceSettingsRow() {
    const existing = db
        .select()
        .from(financeSettings)
        .where(eq(financeSettings.id, FINANCE_SETTINGS_ID))
        .get();
    if (!existing) {
        db.insert(financeSettings)
            .values({
                id: FINANCE_SETTINGS_ID,
                taxPercentBps: DEFAULT_ORDER_PRICING.taxPercentBps,
                shippingPercentBps: DEFAULT_ORDER_PRICING.shippingPercentBps,
            })
            .run();
    }
}

export function updateOrderPricingSettings(settings: OrderPricingSettings) {
    ensureFinanceSettingsRow();
    db.update(financeSettings)
        .set({
            taxPercentBps: settings.taxPercentBps,
            shippingPercentBps: settings.shippingPercentBps,
        })
        .where(eq(financeSettings.id, FINANCE_SETTINGS_ID))
        .run();
}

export function getActiveQuarter() {
    return db.select().from(stfQuarter).where(eq(stfQuarter.isActive, true)).get();
}

export function getGiftFundValueCents(): number {
    const row = db.select().from(giftFund).where(eq(giftFund.id, GIFT_FUND_ID)).get();
    return row?.currentValueCents ?? 0;
}

export function getBucketApprovedSpendCents(bucketId: number, quarterId: number): number {
    const settings = getOrderPricingSettings();
    const rows = db
        .select({
            quantity: order.quantity,
            unitCostCents: order.unitCostCents,
        })
        .from(order)
        .where(
            and(
                eq(order.stfBucketId, bucketId),
                eq(order.quarterId, quarterId),
                inArray(order.status, ["approved", "ordered"])
            )
        )
        .all();

    return rows.reduce(
        (sum, row) => sum + computeOrderTotalCents(row.quantity, row.unitCostCents, settings),
        0
    );
}

export function getBucketRemainingCents(bucketId: number): number | null {
    const bucket = db.select().from(stfBucket).where(eq(stfBucket.id, bucketId)).get();
    if (!bucket || !bucket.isActive) return null;

    const quarter = getActiveQuarter();
    if (!quarter || bucket.quarterId !== quarter.id) return null;

    const spent = getBucketApprovedSpendCents(bucketId, quarter.id);
    return bucket.startingBalanceCents - spent;
}

export type StfBucketBalance = {
    id: number;
    name: string;
    startingBalanceCents: number;
    remainingBalanceCents: number;
    approvedSpendCents: number;
    isActive: boolean;
};

export function getStfBucketsWithBalances(): StfBucketBalance[] {
    const quarter = getActiveQuarter();
    if (!quarter) return [];

    const buckets = db
        .select()
        .from(stfBucket)
        .where(and(eq(stfBucket.quarterId, quarter.id), eq(stfBucket.isActive, true)))
        .all();

    return buckets.map((bucket) => {
        const approvedSpendCents = getBucketApprovedSpendCents(bucket.id, quarter.id);
        return {
            id: bucket.id,
            name: bucket.name,
            startingBalanceCents: bucket.startingBalanceCents,
            remainingBalanceCents: bucket.startingBalanceCents - approvedSpendCents,
            approvedSpendCents,
            isActive: bucket.isActive,
        };
    });
}

export function validateOrderBalance(
    fundType: FundType,
    stfBucketId: number | null | undefined,
    totalCostCents: number
): { ok: true } | { ok: false; message: string } {
    if (fundType === "Gift") {
        const available = getGiftFundValueCents();
        if (totalCostCents > available) {
            return {
                ok: false,
                message: `This order exceeds the remaining balance in Gift Fund. Available: ${formatCents(available)}, Order total: ${formatCents(totalCostCents)}.`,
            };
        }
        return { ok: true };
    }

    if (!stfBucketId) {
        return { ok: false, message: "Select an STF bucket." };
    }

    const bucket = db.select().from(stfBucket).where(eq(stfBucket.id, stfBucketId)).get();
    if (!bucket || !bucket.isActive) {
        return { ok: false, message: "Selected STF bucket is not available." };
    }

    const remaining = getBucketRemainingCents(stfBucketId);
    if (remaining == null) {
        return { ok: false, message: "Selected STF bucket is not available." };
    }

    if (totalCostCents > remaining) {
        return {
            ok: false,
            message: `This order exceeds the remaining balance in ${bucket.name}. Available: ${formatCents(remaining)}, Order total: ${formatCents(totalCostCents)}.`,
        };
    }

    return { ok: true };
}

function formatCents(cents: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
        cents / 100
    );
}

export function deductGiftFundForApproval(
    orderId: number,
    totalCostCents: number,
    changedBy: string | null
) {
    const current = getGiftFundValueCents();
    const next = current - totalCostCents;

    db.update(giftFund).set({ currentValueCents: next }).where(eq(giftFund.id, GIFT_FUND_ID)).run();

    db.insert(giftFundLog)
        .values({
            changedBy,
            changeType: "order_approved",
            previousValueCents: current,
            newValueCents: next,
            orderId,
        })
        .run();
}

export function restoreGiftFundForDeletion(
    orderId: number,
    totalCostCents: number,
    changedBy: string | null
) {
    const current = getGiftFundValueCents();
    const next = current + totalCostCents;

    db.update(giftFund).set({ currentValueCents: next }).where(eq(giftFund.id, GIFT_FUND_ID)).run();

    db.insert(giftFundLog)
        .values({
            changedBy,
            changeType: "order_deleted",
            previousValueCents: current,
            newValueCents: next,
            orderId,
            note: "Refund for deleted approved order",
        })
        .run();
}

export function markApprovedOrdersAsOrdered(changedBy: string, orderIds?: number[]): number {
    const approvedOrders =
        orderIds && orderIds.length > 0
            ? db
                  .select()
                  .from(order)
                  .where(and(eq(order.status, "approved"), inArray(order.id, orderIds)))
                  .all()
            : db.select().from(order).where(eq(order.status, "approved")).all();

    for (const existing of approvedOrders) {
        db.update(order).set({ status: "ordered" }).where(eq(order.id, existing.id)).run();

        db.insert(orderHistory)
            .values({
                orderId: existing.id,
                fromStatus: "approved",
                toStatus: "ordered",
                changedBy,
                note: "Marked as ordered",
            })
            .run();
    }
    return approvedOrders.length;
}

export function adjustGiftFund(
    newValueCents: number,
    changedBy: string,
    note: string | null
): number {
    const current = getGiftFundValueCents();

    db.update(giftFund)
        .set({ currentValueCents: newValueCents })
        .where(eq(giftFund.id, GIFT_FUND_ID))
        .run();

    db.insert(giftFundLog)
        .values({
            changedBy,
            changeType: "manual_adjustment",
            previousValueCents: current,
            newValueCents: newValueCents,
            note,
        })
        .run();

    return newValueCents;
}

export function ensureGiftFundRow() {
    const existing = db.select().from(giftFund).where(eq(giftFund.id, GIFT_FUND_ID)).get();
    if (!existing) {
        db.insert(giftFund).values({ id: GIFT_FUND_ID, currentValueCents: 0 }).run();
    }
}

export async function sendOrderApprovedEmail(to: string, itemName: string) {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return;
    await sendEmail({
        to,
        subject: "Your Trickfire order was approved",
        html: `<p>Your order for <strong>${escapeHtml(itemName)}</strong> has been approved by Trickfire officers.</p>`,
    });
}

export async function sendOrderDeniedEmail(
    to: string,
    itemName: string,
    denialComment?: string | null
) {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return;
    const reason = denialComment
        ? `<p><strong>Reason:</strong> ${escapeHtml(denialComment)}</p>`
        : "";
    await sendEmail({
        to,
        subject: "Your Trickfire order was denied",
        html: `<p>Your order for <strong>${escapeHtml(itemName)}</strong> was denied by Trickfire officers.</p>${reason}`,
    });
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}
