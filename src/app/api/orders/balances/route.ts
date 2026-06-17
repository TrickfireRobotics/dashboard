import { NextResponse } from "next/server";

import { getGiftFundValueCents, getStfBucketsWithBalances } from "@/lib/finance/finance";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
        giftBalanceCents: getGiftFundValueCents(),
        stfBuckets: getStfBucketsWithBalances(),
    });
}
