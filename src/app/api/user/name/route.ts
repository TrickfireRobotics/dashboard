import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";

export const NAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const schema = z.object({
    name: z.string().trim().min(1, "Name is required").max(100),
});

export async function PATCH(req: NextRequest) {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const now = Date.now();
    if (
        sessionUser.nameChangedAt != null &&
        now - sessionUser.nameChangedAt < NAME_CHANGE_COOLDOWN_MS
    ) {
        const availableAt = sessionUser.nameChangedAt + NAME_CHANGE_COOLDOWN_MS;
        return NextResponse.json({ error: "cooldown", availableAt }, { status: 429 });
    }

    db.update(user)
        .set({ name: parsed.data.name, nameChangedAt: now })
        .where(eq(user.id, sessionUser.id))
        .run();

    return NextResponse.json({ ok: true });
}
