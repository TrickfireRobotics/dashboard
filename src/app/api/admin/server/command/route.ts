import { NextResponse, type NextRequest } from "next/server";

import { sendCommand } from "@/lib/azalea";
import { getSessionUser } from "@/lib/session";

export async function POST(req: NextRequest) {
    const admin = await getSessionUser();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => null);
    const cmd = typeof body?.command === "string" ? body.command.trim() : null;
    if (!cmd) return NextResponse.json({ error: "Missing command" }, { status: 400 });

    const result = sendCommand(cmd);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
}
