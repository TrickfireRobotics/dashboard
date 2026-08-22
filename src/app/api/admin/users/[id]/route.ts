import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { updateUserSchema } from "@/lib/validation";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await getSessionUser();
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (await params).id;

    const body = await req.json().catch(() => null);
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    // A member cannot deactivate or unapprove themselves - avoids locking the
    // club out of its own member list.
    if (userId === admin.id && (parsed.data.isActive === false || parsed.data.approved === false)) {
        return NextResponse.json(
            { error: "You cannot change your own active status or approval" },
            { status: 400 }
        );
    }

    const existing = db.select().from(user).where(eq(user.id, userId)).get();
    if (!existing) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updated = db
        .update(user)
        .set({
            ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
            ...(parsed.data.approved !== undefined ? { approved: parsed.data.approved } : {}),
        })
        .where(eq(user.id, userId))
        .returning({
            id: user.id,
            isActive: user.isActive,
            approved: user.approved,
        })
        .get();

    return NextResponse.json({ user: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await getSessionUser();
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (await params).id;

    if (userId === admin.id) {
        return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    const existing = db.select().from(user).where(eq(user.id, userId)).get();
    if (!existing) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Deleting is only permitted once a user has been deactivated - keeps
    // permanent removal a deliberate two-step action.
    if (existing.isActive) {
        return NextResponse.json(
            { error: "Deactivate the user before deleting them" },
            { status: 400 }
        );
    }

    db.delete(user).where(eq(user.id, userId)).run();

    return NextResponse.json({ id: userId });
}
