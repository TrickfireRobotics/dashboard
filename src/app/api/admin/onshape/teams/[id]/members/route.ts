import { NextResponse, type NextRequest } from "next/server";

import { getOnshapeTeamMembers } from "@/lib/onshape";
import { getSessionUser } from "@/lib/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const members = await getOnshapeTeamMembers(id);
    if (!members) return NextResponse.json({ members: [] });

    return NextResponse.json({ members });
}
