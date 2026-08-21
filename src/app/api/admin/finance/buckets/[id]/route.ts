import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { stfBucket } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { stfBucketUpdateSchema } from "@/lib/validation";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = Number((await params).id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json().catch(() => null);
    const parsed = stfBucketUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const existing = db.select().from(stfBucket).where(eq(stfBucket.id, id)).get();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = db
        .update(stfBucket)
        .set({
            name: parsed.data.name ?? existing.name,
            startingBalanceCents:
                parsed.data.startingBalance != null
                    ? Math.round(parsed.data.startingBalance * 100)
                    : existing.startingBalanceCents,
            isActive: parsed.data.isActive ?? existing.isActive,
        })
        .where(eq(stfBucket.id, id))
        .returning()
        .get();

    return NextResponse.json({ bucket: updated });
}
