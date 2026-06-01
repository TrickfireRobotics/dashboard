import { NextResponse, type NextRequest } from "next/server";

import { removeOnshapeMember } from "@/lib/onshape";
import { getSessionUser } from "@/lib/session";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { uid } = await params;
    const ok = await removeOnshapeMember(uid);
    if (!ok) return NextResponse.json({ error: "Failed to remove member" }, { status: 502 });

    return NextResponse.json({ success: true });
}
