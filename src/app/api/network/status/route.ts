import { NextResponse } from "next/server";

import { getNetworkNodes, isNetworkConfigured } from "@/lib/integrations/network";
import { getSessionUser } from "@/lib/auth/session";

const OFFLINE = { online: false, nodeCount: 0, onlineCount: 0 };

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!isNetworkConfigured()) {
        return NextResponse.json({ ...OFFLINE, configured: false });
    }

    const data = await getNetworkNodes();
    if (!data) {
        return NextResponse.json({ ...OFFLINE, configured: true });
    }

    const nodes = data.nodes ?? [];
    return NextResponse.json({
        online: true,
        configured: true,
        nodeCount: nodes.length,
        onlineCount: nodes.filter((n) => n.online).length,
    });
}
