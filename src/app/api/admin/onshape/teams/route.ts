import { NextResponse } from "next/server";

import { getOnshapeTeams, OnshapeError } from "@/lib/onshape";
import { getSessionUser } from "@/lib/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const teams = await getOnshapeTeams();
        return NextResponse.json({ teams: teams ?? [] });
    } catch (err) {
        const status = err instanceof OnshapeError ? 502 : 500;
        const message = err instanceof Error ? err.message : "Failed to load teams";
        return NextResponse.json({ error: message }, { status });
    }
}
