import { NextResponse } from "next/server";

import { GithubError, getPendingInvitations } from "@/lib/integrations/github";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const invitations = await getPendingInvitations();
        return NextResponse.json({ invitations: invitations ?? [] });
    } catch (err) {
        const status = err instanceof GithubError ? 502 : 500;
        const message = err instanceof Error ? err.message : "Failed to load invitations";
        return NextResponse.json({ error: message }, { status });
    }
}
