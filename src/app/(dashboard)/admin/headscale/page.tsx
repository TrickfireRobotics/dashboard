import { asc, desc, eq, sql } from "drizzle-orm";

import { AdminNetworkManager } from "@/components/headscale/AdminNetworkManager";
import { db } from "@/lib/db";
import { headscaleJoinRequest, user } from "@/lib/db/schema";

export default async function AdminHeadscalePage() {
    const rows = db
        .select({
            id: headscaleJoinRequest.id,
            deviceName: headscaleJoinRequest.deviceName,
            machineKey: headscaleJoinRequest.machineKey,
            status: headscaleJoinRequest.status,
            requestNote: headscaleJoinRequest.requestNote,
            adminNote: headscaleJoinRequest.adminNote,
            createdAt: headscaleJoinRequest.createdAt,
            requesterName: user.name,
        })
        .from(headscaleJoinRequest)
        .leftJoin(user, eq(headscaleJoinRequest.userId, user.id))
        .orderBy(
            asc(sql`case when ${headscaleJoinRequest.status} = 'pending' then 0 else 1 end`),
            desc(headscaleJoinRequest.createdAt)
        )
        .all();

    const requests = rows.map((r) => ({ ...r, requesterName: r.requesterName ?? null }));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">Network</h1>
                <p className="text-muted-foreground">
                    Manage Headscale nodes, users, routes, and access requests.
                </p>
            </div>

            <AdminNetworkManager requests={requests} />
        </div>
    );
}
