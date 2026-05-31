import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { headscaleJoinRequest } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { joinRequestActionSchema } from "@/lib/validation";

const STATUS = { approve: "approved", reject: "rejected" } as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await getSessionUser();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = Number((await params).id);
    if (!Number.isInteger(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = joinRequestActionSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const existing = db
        .select()
        .from(headscaleJoinRequest)
        .where(eq(headscaleJoinRequest.id, id))
        .get();
    if (!existing) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const updated = db
        .update(headscaleJoinRequest)
        .set({
            status: STATUS[parsed.data.action],
            adminNote: parsed.data.adminNote ?? null,
            reviewedBy: admin.id,
            reviewedAt: new Date(),
        })
        .where(eq(headscaleJoinRequest.id, id))
        .returning()
        .get();

    return NextResponse.json({ request: updated });
}
