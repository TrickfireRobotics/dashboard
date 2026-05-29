import { asc, desc, eq, sql } from "drizzle-orm";

import {
  AdminOrderQueue,
  type AdminOrderRow,
} from "@/components/orders/AdminOrderQueue";
import { db } from "@/lib/db";
import { order, team, user } from "@/lib/db/schema";

export default async function AdminOrdersPage() {
  const rows: AdminOrderRow[] = db
    .select({
      id: order.id,
      itemName: order.itemName,
      teamName: team.name,
      requesterName: user.name,
      requesterEmail: user.email,
      quantity: order.quantity,
      unitPrice: order.unitPrice,
      vendorUrl: order.vendorUrl,
      description: order.description,
      partType: order.partType,
      partNumber: order.partNumber,
      status: order.status,
      adminNote: order.adminNote,
      createdAt: order.createdAt,
    })
    .from(order)
    .leftJoin(team, eq(order.teamId, team.id))
    .leftJoin(user, eq(order.userId, user.id))
    // Pending orders first, then newest.
    .orderBy(
      asc(sql`case when ${order.status} = 'pending' then 0 else 1 end`),
      desc(order.createdAt),
    )
    .all();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Order Queue</h1>
        <p className="text-muted-foreground">
          Review and act on member parts orders.
        </p>
      </div>

      <AdminOrderQueue orders={rows} />
    </div>
  );
}
