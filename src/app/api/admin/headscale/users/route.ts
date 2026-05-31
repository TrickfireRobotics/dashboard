import { NextResponse } from "next/server";

import { getHeadscaleUsers } from "@/lib/headscale";
import { getSessionUser } from "@/lib/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const data = await getHeadscaleUsers();
    if (!data) return NextResponse.json({ users: [] });

    return NextResponse.json({ users: data.users ?? [] });
}
