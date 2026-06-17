import { NextResponse } from "next/server";

import { getNetworkNodes } from "@/lib/integrations/network";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await getNetworkNodes();
    if (!data) return NextResponse.json({ nodes: [] });

    return NextResponse.json({ nodes: data.nodes ?? [] });
}
