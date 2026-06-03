import { NextResponse, type NextRequest } from "next/server";

import { GithubError, removeMember } from "@/lib/github";
import { getSessionUser } from "@/lib/session";

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { username } = await params;
    try {
        await removeMember(username);
        return NextResponse.json({ success: true });
    } catch (err) {
        const status = err instanceof GithubError ? 502 : 500;
        const message = err instanceof Error ? err.message : "Failed to remove member";
        return NextResponse.json({ error: message }, { status });
    }
}
