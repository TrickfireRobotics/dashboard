import { asc, desc, eq, sql } from "drizzle-orm";

import { AdminOrderQueue, type AdminOrderRow } from "@/components/orders/AdminOrderQueue";
import { db } from "@/lib/db";
import { order, stfBucket, user } from "@/lib/db/schema";

export default async function AdminOrdersPage() {
    const rows: AdminOrderRow[] = db
        .select({
            id: order.id,
            itemName: order.itemName,
            fundType: order.fundType,
            stfBucketName: stfBucket.name,
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
                    Review pending orders and browse the archive of approved and denied requests.
                </p>
            </div>

            <AdminOrderQueue orders={rows} />
        </div>
    );
}
