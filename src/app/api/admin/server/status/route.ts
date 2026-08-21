import { NextResponse } from "next/server";

import { isConfigured, isRunning, readConfig } from "@/lib/integrations/azalea";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
    const admin = await getSessionUser();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
