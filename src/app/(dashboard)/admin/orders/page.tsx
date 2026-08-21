import { asc, desc, eq, sql } from "drizzle-orm";

import { AdminOrderQueue, type AdminOrderRow } from "@/components/orders/AdminOrderQueue";
import { db } from "@/lib/db";
import { order, stfBucket, user } from "@/lib/db/schema";
import {
    ensureFinanceSettingsRow,
    getOrderPricingSettings,
    getStfBucketsWithBalances,
} from "@/lib/finance/finance";
import { percentBpsToDisplay } from "@/lib/finance/order-pricing";

export default async function AdminOrdersPage() {
    ensureFinanceSettingsRow();
    const pricing = getOrderPricingSettings();
    const rows: AdminOrderRow[] = db
        .select({
            id: order.id,
            itemName: order.itemName,
            fundType: order.fundType,
            stfBucketId: order.stfBucketId,
            stfBucketName: stfBucket.name,
            batchId: order.batchId,
            requesterName: user.name,
            requesterEmail: user.email,
            quantity: order.quantity,
            unitCostCents: order.unitCostCents,
            vendor: order.vendor,
            link: order.link,
            notes: order.notes,
            partNumber: order.partNumber,
            status: order.status,
            denialComment: order.denialComment,
            createdAt: order.createdAt,
        })
        .from(order)
        .leftJoin(stfBucket, eq(order.stfBucketId, stfBucket.id))
        .leftJoin(user, eq(order.userId, user.id))
        .orderBy(
            asc(sql`case when ${order.status} = 'pending' then 0 else 1 end`),
            desc(order.createdAt)
        )
        .all();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">Order Queue</h1>
                <p className="text-muted-foreground">
                    Review pending orders, manage approved batches, and browse ordered and denied
                    archives.
                </p>
            </div>

            <AdminOrderQueue
                orders={rows}
                stfBuckets={getStfBucketsWithBalances()}
                orderPricing={{
                    taxPercent: percentBpsToDisplay(pricing.taxPercentBps),
                    shippingPercent: percentBpsToDisplay(pricing.shippingPercentBps),
                }}
            />
        </div>
    );
}
