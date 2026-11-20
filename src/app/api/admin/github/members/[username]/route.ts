import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { GithubError, removeMember, setMemberRole } from "@/lib/integrations/github";
import { getSessionUser } from "@/lib/auth/session";

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

const roleSchema = z.object({ role: z.enum(["admin", "member"]) });

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = roleSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { username } = await params;
    try {
        await setMemberRole(username, parsed.data.role);
        return NextResponse.json({ success: true });
    } catch (err) {
        const status = err instanceof GithubError ? 502 : 500;
        const message = err instanceof Error ? err.message : "Failed to update role";
        return NextResponse.json({ error: message }, { status });
    }
}
