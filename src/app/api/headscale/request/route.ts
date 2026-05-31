import { desc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { headscaleJoinRequest } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { joinRequestSchema } from "@/lib/validation";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const requests = db
        .select()
        .from(headscaleJoinRequest)
        .where(eq(headscaleJoinRequest.userId, user.id))
        .orderBy(desc(headscaleJoinRequest.createdAt))
        .all();

    return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = joinRequestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const created = db
        .insert(headscaleJoinRequest)
        .values({
            userId: user.id,
            deviceName: parsed.data.deviceName,
            machineKey: parsed.data.machineKey ?? null,
            requestNote: parsed.data.requestNote ?? null,
        })
        .returning()
        .get();

    return NextResponse.json({ request: created }, { status: 201 });
}
