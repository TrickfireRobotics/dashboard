import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { userFeature } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { featureRequestSchema } from "@/lib/validation";

// GET all features for a user
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await getSessionUser();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const userId = (await params).id;
    const features = db.select().from(userFeature).where(eq(userFeature.userId, userId)).all();
    return NextResponse.json({ features });
}

// POST to directly grant a feature to a user (no request flow)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await getSessionUser();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const userId = (await params).id;
    const body = await req.json().catch(() => null);
    const parsed = featureRequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const { featureKey, requestNote } = parsed.data;

    const existing = db
        .select()
        .from(userFeature)
        .where(and(eq(userFeature.userId, userId), eq(userFeature.featureKey, featureKey)))
        .get();

    if (existing) {
        const updated = db
            .update(userFeature)
            .set({
                status: "granted",
                adminNote: requestNote ?? null,
                reviewedBy: admin.id,
                reviewedAt: new Date(),
            })
            .where(eq(userFeature.id, existing.id))
            .returning()
            .get();
        return NextResponse.json({ feature: updated });
    }

    const created = db
        .insert(userFeature)
        .values({
            userId,
            featureKey,
            status: "granted",
            reviewedBy: admin.id,
            reviewedAt: new Date(),
        })
        .returning()
        .get();

    return NextResponse.json({ feature: created }, { status: 201 });
}

// DELETE to revoke a feature from a user
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await getSessionUser();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const userId = (await params).id;
    const body = await req.json().catch(() => null);
    const featureKey = body?.featureKey as string | undefined;
    if (!featureKey) return NextResponse.json({ error: "featureKey required" }, { status: 400 });

    db.delete(userFeature)
        .where(and(eq(userFeature.userId, userId), eq(userFeature.featureKey, featureKey)))
        .run();

    return new NextResponse(null, { status: 204 });
}
