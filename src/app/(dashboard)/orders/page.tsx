import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OrderTable, type MemberOrderRow } from "@/components/orders/OrderTable";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { order, stfBucket } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";

export default async function OrdersPage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    const rows: MemberOrderRow[] = db
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl">My Orders</h1>
                    <p className="text-muted-foreground">
                        Your submitted orders and their review status.
                    </p>
                </div>
                <Button nativeButton={false} render={<Link href="/orders/new" />}>
                    Submit order
                </Button>
            </div>

            <OrderTable orders={rows} />
        </div>
    );
}
