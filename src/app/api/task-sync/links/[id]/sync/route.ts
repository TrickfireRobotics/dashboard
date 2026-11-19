import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { syncLink } from "@/lib/integrations/notion-github-sync";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = Number((await params).id);
    if (!Number.isInteger(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    try {
        const summary = await syncLink(id);
        return NextResponse.json({ summary });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Sync failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
