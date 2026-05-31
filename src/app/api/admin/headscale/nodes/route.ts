import { NextResponse } from "next/server";

import { getHeadscaleNodes } from "@/lib/headscale";
import { getSessionUser } from "@/lib/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const data = await getHeadscaleNodes();
    if (!data) return NextResponse.json({ nodes: [] });

    return NextResponse.json({ nodes: data.nodes ?? [] });
}
