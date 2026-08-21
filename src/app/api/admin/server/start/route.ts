import { NextResponse } from "next/server";

import { startServer } from "@/lib/integrations/azalea";
import { getSessionUser } from "@/lib/auth/session";

export async function POST() {
    const admin = await getSessionUser();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = startServer();
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
}
