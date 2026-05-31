import { NextResponse } from "next/server";

import { getServerStatus } from "@/lib/minecraft";
import { getSessionUser } from "@/lib/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getServerStatus();
    return NextResponse.json(status);
}
