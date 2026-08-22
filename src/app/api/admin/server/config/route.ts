import { NextResponse, type NextRequest } from "next/server";

import { readConfig, writeConfig, type AzaleaConfig } from "@/lib/integrations/azalea";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
    const admin = await getSessionUser();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        return NextResponse.json(readConfig());
    } catch {
        return NextResponse.json({ error: "Failed to read config" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const admin = await getSessionUser();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
        writeConfig(body as AzaleaConfig);
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "Failed to write config" }, { status: 500 });
    }
}
