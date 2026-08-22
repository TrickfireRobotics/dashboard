import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { feedbackStatusSchema } from "@/lib/validation";

function parseFeedbackId(params: { id: string }) {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return null;
    return id;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = parseFeedbackId(await params);
    if (id == null) {
        return NextResponse.json({ error: "Invalid feedback id" }, { status: 400 });
    }

    const existing = db.select().from(feedback).where(eq(feedback.id, id)).get();
    if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = feedbackStatusSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const resolved = parsed.data.status === "resolved";
    const updated = db
        .update(feedback)
        .set({
            status: parsed.data.status,
            resolvedBy: resolved ? sessionUser.id : null,
            resolvedAt: resolved ? new Date() : null,
        })
        .where(eq(feedback.id, id))
        .returning()
        .get();

    return NextResponse.json({ feedback: updated });
}
