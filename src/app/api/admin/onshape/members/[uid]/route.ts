import { NextResponse, type NextRequest } from "next/server";

import { OnshapeError, removeOnshapeMember } from "@/lib/onshape";
import { getSessionUser } from "@/lib/session";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { uid } = await params;
    try {
        await removeOnshapeMember(uid);
        return NextResponse.json({ success: true });
    } catch (err) {
        const status = err instanceof OnshapeError ? 502 : 500;
        const message = err instanceof Error ? err.message : "Failed to remove member";
        return NextResponse.json({ error: message }, { status });
    }
}
