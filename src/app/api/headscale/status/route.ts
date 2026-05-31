import { NextResponse } from "next/server";

import { getHeadscaleNodes, isHeadscaleConfigured } from "@/lib/headscale";
import { getSessionUser } from "@/lib/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!isHeadscaleConfigured()) {
        return NextResponse.json({ online: false, nodeCount: 0, configured: false });
    }

    const data = await getHeadscaleNodes();
    if (!data) {
        return NextResponse.json({ online: false, nodeCount: 0, configured: true });
    }

    const nodes = data.nodes ?? [];
    return NextResponse.json({
        online: true,
        nodeCount: nodes.length,
        onlineCount: nodes.filter((n) => n.online).length,
        configured: true,
    });
}
