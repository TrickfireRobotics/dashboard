import { NextResponse, type NextRequest } from "next/server";

import { getOnshapeTeamMembers, OnshapeError } from "@/lib/integrations/onshape";
import { getSessionUser } from "@/lib/auth/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    try {
        const members = await getOnshapeTeamMembers(id);
        return NextResponse.json({ members: members ?? [] });
    } catch (err) {
        const status = err instanceof OnshapeError ? 502 : 500;
        const message = err instanceof Error ? err.message : "Failed to load team members";
        return NextResponse.json({ error: message }, { status });
    }
}
