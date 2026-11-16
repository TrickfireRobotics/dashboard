import { asc, desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { OrderBalancesSummary } from "@/components/orders/OrderBalancesSummary";
import { OrderFormDialog } from "@/components/orders/OrderFormDialog";
import { OrdersWorkspace, type WorkspaceOrderRow } from "@/components/orders/OrdersWorkspace";
import { VendorSearchDialog } from "@/components/orders/VendorSearchDialog";
import { db } from "@/lib/db";
import { order, stfBucket, user as userTable } from "@/lib/db/schema";
import {
    getGiftFundValueCents,
    ensureFinanceSettingsRow,
    getOrderPricingSettings,
    getStfBucketsWithBalances,
} from "@/lib/finance/finance";
import { percentBpsToDisplay } from "@/lib/finance/order-pricing";
import { getSessionUser } from "@/lib/auth/session";

export default async function OrdersPage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    ensureFinanceSettingsRow();
    const pricing = getOrderPricingSettings();
    const orderPricing = {
        taxPercent: percentBpsToDisplay(pricing.taxPercentBps),
        shippingPercent: percentBpsToDisplay(pricing.shippingPercentBps),
    };

    // Every tab reads from this one list. Each order is fetched, sent and
    // rendered exactly once, which is what keeps the page manageable once
    // there are a few hundred of them.
    const orders: WorkspaceOrderRow[] = db
        .select({
            id: order.id,
            userId: order.userId,
            itemName: order.itemName,
            fundType: order.fundType,
            stfBucketId: order.stfBucketId,
            stfBucketName: stfBucket.name,
            batchId: order.batchId,
            requesterName: userTable.name,
            requesterEmail: userTable.email,
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
        .leftJoin(userTable, eq(order.userId, userTable.id))
        .orderBy(
            asc(sql`case when ${order.status} = 'pending' then 0 else 1 end`),
            desc(order.createdAt)
        )
        .all();

    const giftBalanceCents = getGiftFundValueCents();
    const stfBuckets = getStfBucketsWithBalances();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <p className="text-muted-foreground text-sm">
                    Submit a new purchase request or review orders below.
                </p>
                <div className="flex flex-wrap gap-2">
                    <VendorSearchDialog />
                    <OrderFormDialog />
                </div>
            </div>

            <OrderBalancesSummary giftBalanceCents={giftBalanceCents} stfBuckets={stfBuckets} />

            <OrdersWorkspace
                orders={orders}
                currentUserId={user.id}
                stfBuckets={stfBuckets}
                orderPricing={orderPricing}
            />
        </div>
    );
}
