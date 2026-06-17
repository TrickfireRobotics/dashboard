import { NextResponse } from "next/server";

import { getPlaytimeLeaderboard } from "@/lib/integrations/minecraft-stats";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entries = await getPlaytimeLeaderboard();
    return NextResponse.json(entries);
}
