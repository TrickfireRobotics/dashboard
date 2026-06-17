import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { userFeature } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { featureActionSchema } from "@/lib/validation";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await getSessionUser();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = parseInt((await params).id);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json().catch(() => null);
    const parsed = featureActionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const existing = db.select().from(userFeature).where(eq(userFeature.id, id)).get();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const newStatus = parsed.data.action === "grant" ? "granted" : "rejected";
    const updated = db
        .update(userFeature)
        .set({
            status: newStatus,
            adminNote: parsed.data.adminNote ?? null,
            reviewedBy: admin.id,
            reviewedAt: new Date(),
        })
        .where(eq(userFeature.id, id))
        .returning()
        .get();

    return NextResponse.json({ feature: updated });
}
