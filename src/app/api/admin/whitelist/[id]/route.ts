import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { minecraftWhitelist } from "@/lib/db/schema";
import { sendCommand } from "@/lib/integrations/azalea";
import { getSessionUser } from "@/lib/auth/session";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await getSessionUser();
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = Number((await params).id);
    if (!Number.isInteger(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = db
        .select()
        .from(minecraftWhitelist)
        .where(eq(minecraftWhitelist.id, id))
        .get();
    if (!existing) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const rcon = await sendCommand(`whitelist remove ${existing.username}`);
    if (!rcon.ok) {
        return NextResponse.json({ error: `RCON failed: ${rcon.error}` }, { status: 502 });
    }

    db.delete(minecraftWhitelist).where(eq(minecraftWhitelist.id, id)).run();

    return new NextResponse(null, { status: 204 });
}
