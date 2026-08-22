import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { stfBucket, stfQuarter } from "@/lib/db/schema";
import { getActiveQuarter } from "@/lib/finance/finance";
import { getSessionUser } from "@/lib/auth/session";
import { stfBucketInputSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = stfBucketInputSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const quarter = getActiveQuarter();
    if (!quarter) {
        return NextResponse.json(
            { error: "No active STF school year. Create one before adding buckets." },
            { status: 400 }
        );
    }

    const created = db
        .insert(stfBucket)
        .values({
            quarterId: quarter.id,
            name: parsed.data.name,
            startingBalanceCents: Math.round(parsed.data.startingBalance * 100),
        })
        .returning()
        .get();

    return NextResponse.json({ bucket: created }, { status: 201 });
}

export async function PUT(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const quarterName = body?.quarterName?.trim();
    if (!quarterName) {
        return NextResponse.json({ error: "School year name is required" }, { status: 400 });
    }

    const existing = getActiveQuarter();
    if (existing) {
        return NextResponse.json(
            { error: `Active school year already exists: ${existing.name}` },
            { status: 400 }
        );
    }

    const created = db
        .insert(stfQuarter)
        .values({ name: quarterName, isActive: true })
        .returning()
        .get();

    return NextResponse.json({ quarter: created }, { status: 201 });
}
