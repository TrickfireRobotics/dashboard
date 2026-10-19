import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { clearBotError } from "@/lib/integrations/discord-bot";

export async function POST() {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await clearBotError())) {
        return NextResponse.json({ error: "Could not clear bot error" }, { status: 502 });
    }

    return new NextResponse(null, { status: 204 });
}
