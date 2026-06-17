import { NextResponse } from "next/server";

import { getOrg, isGithubConfigured } from "@/lib/integrations/github";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const org = await getOrg();
    return NextResponse.json({ configured: isGithubConfigured(), org });
}
