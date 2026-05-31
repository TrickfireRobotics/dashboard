import { NextResponse, type NextRequest } from "next/server";

import { deleteHeadscaleNode } from "@/lib/headscale";
import { getSessionUser } from "@/lib/session";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const ok = await deleteHeadscaleNode(id);
    if (!ok) return NextResponse.json({ error: "Failed to delete node" }, { status: 502 });

    return NextResponse.json({ success: true });
}
