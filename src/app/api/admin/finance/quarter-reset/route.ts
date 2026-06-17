import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { stfBucket, stfQuarter } from "@/lib/db/schema";
import { getActiveQuarter } from "@/lib/finance/finance";
import { getSessionUser } from "@/lib/auth/session";
import { quarterResetSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = quarterResetSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const active = getActiveQuarter();
    if (!active) {
        return NextResponse.json({ error: "No active school year to reset" }, { status: 400 });
    }

    if (active.name !== parsed.data.quarterName) {
        return NextResponse.json(
            { error: `School year name does not match. Expected "${active.name}".` },
            { status: 400 }
        );
    }

    db.update(stfQuarter)
        .set({ isActive: false, archivedAt: new Date() })
        .where(eq(stfQuarter.id, active.id))
        .run();

    db.update(stfBucket).set({ isActive: false }).where(eq(stfBucket.quarterId, active.id)).run();

    const newQuarter = db
        .insert(stfQuarter)
        .values({ name: parsed.data.newQuarterName, isActive: true })
        .returning()
        .get();

    return NextResponse.json({ archivedQuarter: active.name, newQuarter });
}
