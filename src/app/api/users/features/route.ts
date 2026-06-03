import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { userFeature } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { featureRequestSchema } from "@/lib/validation";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const features = db.select().from(userFeature).where(eq(userFeature.userId, user.id)).all();

    return NextResponse.json({ features });
}

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = featureRequestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { featureKey, requestNote } = parsed.data;

    const existing = db
        .select()
        .from(userFeature)
        .where(and(eq(userFeature.userId, user.id), eq(userFeature.featureKey, featureKey)))
        .get();

    if (existing?.status === "granted") {
        return NextResponse.json({ error: "Feature already granted" }, { status: 409 });
    }
    if (existing?.status === "pending") {
        return NextResponse.json({ error: "Request already pending" }, { status: 409 });
    }

    if (existing) {
        // Re-request after rejection
        const updated = db
            .update(userFeature)
            .set({
                status: "pending",
                requestNote: requestNote ?? null,
                adminNote: null,
                reviewedBy: null,
                reviewedAt: null,
            })
            .where(eq(userFeature.id, existing.id))
            .returning()
            .get();
        return NextResponse.json({ feature: updated });
    }

    const created = db
        .insert(userFeature)
        .values({
            userId: user.id,
            featureKey,
            status: "pending",
            requestNote: requestNote ?? null,
        })
        .returning()
        .get();

    return NextResponse.json({ feature: created }, { status: 201 });
}
