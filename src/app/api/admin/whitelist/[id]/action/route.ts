import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { minecraftWhitelist } from "@/lib/db/schema";
import { sendCommand } from "@/lib/integrations/azalea";
import { getSessionUser } from "@/lib/auth/session";
import { whitelistActionSchema } from "@/lib/validation";

const STATUS = { approve: "approved", reject: "rejected" } as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await getSessionUser();
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = Number((await params).id);
    if (!Number.isInteger(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = whitelistActionSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const existing = db
        .select()
        .from(minecraftWhitelist)
        .where(eq(minecraftWhitelist.id, id))
        .get();
    if (!existing) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (parsed.data.action === "approve") {
        const rcon = await sendCommand(`whitelist add ${existing.username}`);
        if (!rcon.ok) {
            return NextResponse.json({ error: `RCON failed: ${rcon.error}` }, { status: 502 });
        }
    }

    const updated = db
        .update(minecraftWhitelist)
        .set({
            status: STATUS[parsed.data.action],
            adminNote: parsed.data.adminNote ?? null,
            reviewedBy: admin.id,
            reviewedAt: new Date(),
        })
        .where(eq(minecraftWhitelist.id, id))
        .returning()
        .get();

    return NextResponse.json({ request: updated });
}
