import { NextResponse } from "next/server";

import { getBotActivity } from "@/lib/integrations/discord-bot";
import { getSessionUser } from "@/lib/auth/session";

export async function GET(request: Request) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = Number.parseInt(new URL(request.url).searchParams.get("limit") ?? "50", 10);
    return NextResponse.json(await getBotActivity(Number.isFinite(limit) ? limit : 50));
}
