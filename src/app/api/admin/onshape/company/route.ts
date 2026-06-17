import { NextResponse } from "next/server";

import { getOnshapeCompany, isOnshapeConfigured } from "@/lib/integrations/onshape";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const company = await getOnshapeCompany();
    return NextResponse.json({ configured: isOnshapeConfigured(), company });
}
