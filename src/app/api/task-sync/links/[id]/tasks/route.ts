import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { githubNotionLink, githubNotionTask } from "@/lib/db/schema";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = Number((await params).id);
    if (!Number.isInteger(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const link = db.select().from(githubNotionLink).where(eq(githubNotionLink.id, id)).get();
    if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });

    const tasks = db
        .select()
        .from(githubNotionTask)
        .where(eq(githubNotionTask.linkId, id))
        .orderBy(githubNotionTask.notionTaskKey)
        .all();

    return NextResponse.json({
        link: { githubOwner: link.githubOwner, githubRepo: link.githubRepo },
        tasks,
    });
}
