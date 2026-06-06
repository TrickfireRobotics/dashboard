import { NextResponse, type NextRequest } from "next/server";

import { GithubError, cancelInvitation } from "@/lib/github";
import { getSessionUser } from "@/lib/session";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = Number((await params).id);
    if (!Number.isInteger(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    try {
        await cancelInvitation(id);
        return NextResponse.json({ success: true });
    } catch (err) {
        const status = err instanceof GithubError ? 502 : 500;
        const message = err instanceof Error ? err.message : "Failed to cancel invitation";
        return NextResponse.json({ error: message }, { status });
    }
}
