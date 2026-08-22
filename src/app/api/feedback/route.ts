import { desc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { feedback, user } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { feedbackInputSchema } from "@/lib/validation";

export async function GET() {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = db
        .select({
            id: feedback.id,
            category: feedback.category,
            message: feedback.message,
            page: feedback.page,
            status: feedback.status,
            createdAt: feedback.createdAt,
            authorName: user.name,
        })
        .from(feedback)
        .leftJoin(user, eq(feedback.userId, user.id))
        .orderBy(desc(feedback.createdAt))
        .all();

    return NextResponse.json({ feedback: rows });
}

export async function POST(req: NextRequest) {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = feedbackInputSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const created = db
        .insert(feedback)
        .values({
            userId: sessionUser.id,
            category: parsed.data.category,
            message: parsed.data.message,
            page: parsed.data.page?.trim() || null,
        })
        .returning()
        .get();

    return NextResponse.json({ feedback: created }, { status: 201 });
}
