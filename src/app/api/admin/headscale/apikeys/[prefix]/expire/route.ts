import { NextResponse, type NextRequest } from "next/server";

import { expireHeadscaleApiKey } from "@/lib/headscale";
import { getSessionUser } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ prefix: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { prefix } = await params;
    const ok = await expireHeadscaleApiKey(prefix);
    if (!ok) return NextResponse.json({ error: "Failed to expire API key" }, { status: 502 });

    return NextResponse.json({ success: true });
}
