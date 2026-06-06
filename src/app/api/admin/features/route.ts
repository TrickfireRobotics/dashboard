import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { user, userFeature } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";

export async function GET() {
    const admin = await getSessionUser();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const pending = db
        .select({
            id: userFeature.id,
            featureKey: userFeature.featureKey,
            status: userFeature.status,
            requestNote: userFeature.requestNote,
            requestedAt: userFeature.requestedAt,
            userId: userFeature.userId,
            userName: user.name,
            userEmail: user.email,
        })
        .from(userFeature)
        .innerJoin(user, eq(userFeature.userId, user.id))
        .where(eq(userFeature.status, "pending"))
        .all();

    return NextResponse.json({ requests: pending });
}
