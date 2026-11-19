import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { githubNotionLink } from "@/lib/db/schema";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = Number((await params).id);
    if (!Number.isInteger(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    db.delete(githubNotionLink).where(eq(githubNotionLink.id, id)).run();
    return NextResponse.json({ success: true });
}
