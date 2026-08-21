import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { minecraftWhitelist } from "@/lib/db/schema";
import { sendCommand } from "@/lib/integrations/azalea";
import { getSessionUser } from "@/lib/auth/session";
import { whitelistDirectAddSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
    const admin = await getSessionUser();
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = whitelistDirectAddSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const rcon = await sendCommand(`whitelist add ${parsed.data.username}`);
    if (!rcon.ok) {
        return NextResponse.json({ error: `RCON failed: ${rcon.error}` }, { status: 502 });
    }

    const created = db
        .insert(minecraftWhitelist)
        .values({
            username: parsed.data.username,
            status: "approved",
            addedDirectly: true,
            adminNote: parsed.data.adminNote ?? null,
            reviewedBy: admin.id,
            reviewedAt: new Date(),
        })
        .returning()
        .get();

    return NextResponse.json({ request: created }, { status: 201 });
}
