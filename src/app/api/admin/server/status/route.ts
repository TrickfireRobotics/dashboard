import { NextResponse } from "next/server";

import { isConfigured, isRunning, readConfig } from "@/lib/azalea";
import { getSessionUser } from "@/lib/session";

export async function GET() {
    const admin = await getSessionUser();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const configured = isConfigured();
    const running = isRunning();

    let installedTag: string | null = null;
    if (configured) {
        try {
            installedTag = readConfig().installed_tag;
        } catch {}
    }

    return NextResponse.json({ running, configured, installedTag });
}
