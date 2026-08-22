import { NextResponse, type NextRequest } from "next/server";

import { GithubError, getTeamMembers } from "@/lib/integrations/github";
import { getSessionUser } from "@/lib/auth/session";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { slug } = await params;
    try {
        const members = await getTeamMembers(slug);
        return NextResponse.json({ members: members ?? [] });
    } catch (err) {
        const status = err instanceof GithubError ? 502 : 500;
        const message = err instanceof Error ? err.message : "Failed to load team members";
        return NextResponse.json({ error: message }, { status });
    }
}
