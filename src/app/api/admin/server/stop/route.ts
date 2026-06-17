import { NextResponse } from "next/server";

import { stopServer } from "@/lib/integrations/azalea";
import { getSessionUser } from "@/lib/auth/session";

export async function POST() {
    const admin = await getSessionUser();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const result = stopServer();
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
}
