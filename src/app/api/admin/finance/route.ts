import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
    getGiftFundValueCents,
    getStfBucketsWithBalances,
    ensureGiftFundRow,
} from "@/lib/finance/finance";
import { giftFundLog, stfQuarter } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    ensureGiftFundRow();

    const quarters = db.select().from(stfQuarter).orderBy(desc(stfQuarter.createdAt)).all();
    const giftLog = db
        .select()
        .from(giftFundLog)
        .orderBy(desc(giftFundLog.timestamp))
        .limit(50)
        .all();

    return NextResponse.json({
        giftBalanceCents: getGiftFundValueCents(),
        stfBuckets: getStfBucketsWithBalances(),
        quarters,
        giftLog,
    });
}
