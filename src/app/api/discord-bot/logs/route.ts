import { NextResponse } from "next/server";

import { getBotLogs } from "@/lib/integrations/discord-bot";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(await getBotLogs());
}
