import { NextResponse } from "next/server";

import { GithubError, getOrgTeams } from "@/lib/integrations/github";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const teams = await getOrgTeams();
        return NextResponse.json({ teams: teams ?? [] });
    } catch (err) {
        const status = err instanceof GithubError ? 502 : 500;
        const message = err instanceof Error ? err.message : "Failed to load teams";
        return NextResponse.json({ error: message }, { status });
    }
}
