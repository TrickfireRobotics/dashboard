import { asc, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminOrderQueue, type AdminOrderRow } from "@/components/orders/AdminOrderQueue";
import { OrderBalancesSummary } from "@/components/orders/OrderBalancesSummary";
import { OrderTable, type MemberOrderRow } from "@/components/orders/OrderTable";
import { TeamOrderTable, type TeamOrderRow } from "@/components/orders/TeamOrderTable";
import { Button } from "@/components/ui/button";
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

    const myOrders: MemberOrderRow[] = db
        .select({
            id: order.id,
            itemName: order.itemName,
            fundType: order.fundType,
            stfBucketName: stfBucket.name,
            quantity: order.quantity,
            unitCostCents: order.unitCostCents,
            status: order.status,
            denialComment: order.denialComment,
            createdAt: order.createdAt,
        })
        .from(order)
        .leftJoin(stfBucket, eq(order.stfBucketId, stfBucket.id))
        .where(eq(order.userId, user.id))
        .orderBy(desc(order.createdAt))
        .all();

    const teamOrders: TeamOrderRow[] = db
        .select({
            id: order.id,
            itemName: order.itemName,
            fundType: order.fundType,
            stfBucketName: stfBucket.name,
            requesterName: userTable.name,
            requesterEmail: userTable.email,
            quantity: order.quantity,
            unitCostCents: order.unitCostCents,
            status: order.status,
            createdAt: order.createdAt,
        })
        .from(order)
        .leftJoin(stfBucket, eq(order.stfBucketId, stfBucket.id))
        .leftJoin(userTable, eq(order.userId, userTable.id))
        .orderBy(desc(order.createdAt))
        .all();

    const queueRows: AdminOrderRow[] = db
        .select({
            id: order.id,
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
    const orderedParts = teamOrders.filter((o) => o.status === "ordered");

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl">My Orders</h1>
                    <p className="text-muted-foreground">
                        Track your orders and see everything the team has submitted.
                    </p>
                </div>
                <Button nativeButton={false} render={<Link href="/orders/new" />}>
                    Submit order
                </Button>
            </div>

            <OrderBalancesSummary giftBalanceCents={giftBalanceCents} stfBuckets={stfBuckets} />

            <section className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold">Your orders</h2>
                    <p className="text-muted-foreground text-sm">
                        Every order you&apos;ve submitted, across all statuses.
                    </p>
                </div>
                <OrderTable orders={myOrders} orderPricing={orderPricing} />
            </section>

            <section className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold">Team orders</h2>
                    <p className="text-muted-foreground text-sm">
                        Every order in the system, across all statuses. Officers review and act on
                        these in the order queue.
                    </p>
                </div>
                <TeamOrderTable orders={teamOrders} orderPricing={orderPricing} />
            </section>

            <section className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold">Ordered parts</h2>
                    <p className="text-muted-foreground text-sm">
                        Parts that officers have approved and placed with vendors.
                    </p>
                </div>
                <TeamOrderTable
                    orders={orderedParts}
                    orderPricing={orderPricing}
                    showFilters={false}
                    emptyMessage="No parts have been ordered yet."
                />
            </section>

            <section className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold">Order queue</h2>
                    <p className="text-muted-foreground text-sm">
                        Review pending orders, manage approved batches, and browse ordered and
                        denied archives.
                    </p>
                </div>
                <AdminOrderQueue
                    orders={queueRows}
                    stfBuckets={stfBuckets}
                    orderPricing={orderPricing}
                />
            </section>
        </div>
    );
}
