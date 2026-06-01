import { NextResponse } from "next/server";

import { getOnshapeTeams } from "@/lib/onshape";
import { getSessionUser } from "@/lib/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const teams = await getOnshapeTeams();
    if (!teams) return NextResponse.json({ teams: [] });

    return NextResponse.json({ teams });
}
