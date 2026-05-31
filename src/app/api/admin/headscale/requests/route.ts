import { asc, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { headscaleJoinRequest, user } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";

export async function GET() {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (sessionUser.role !== "admin")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const requests = db
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

    return NextResponse.json({ requests });
}
