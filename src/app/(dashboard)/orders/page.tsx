import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OrderTable, type MemberOrderRow } from "@/components/orders/OrderTable";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { order, team } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";

export default async function OrdersPage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    const rows: MemberOrderRow[] = db
        .select({
            id: order.id,
            itemName: order.itemName,
            teamName: team.name,
            quantity: order.quantity,
            unitPrice: order.unitPrice,
            status: order.status,
            adminNote: order.adminNote,
            createdAt: order.createdAt,
        })
        .from(order)
        .leftJoin(team, eq(order.teamId, team.id))
        .where(eq(order.userId, user.id))
        .orderBy(desc(order.createdAt))
        .all();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl">My Orders</h1>
                    <p className="text-muted-foreground">
                        Your submitted parts orders and their review status.
                    </p>
                </div>
                <Button render={<Link href="/orders/new" />}>Order a part</Button>
            </div>

            <OrderTable orders={rows} />
        </div>
    );
}
