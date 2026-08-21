import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
    ensureFinanceSettingsRow,
    ensureGiftFundRow,
    getGiftFundValueCents,
    getOrderPricingSettings,
    getStfBucketsWithBalances,
} from "@/lib/finance/finance";
import { percentBpsToDisplay } from "@/lib/finance/order-pricing";
import { giftFundLog, stfQuarter } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    ensureGiftFundRow();
    ensureFinanceSettingsRow();

    const quarters = db.select().from(stfQuarter).orderBy(desc(stfQuarter.createdAt)).all();
    const giftLog = db
        .select()
        .from(giftFundLog)
        .orderBy(desc(giftFundLog.timestamp))
        .limit(50)
        .all();

    const pricing = getOrderPricingSettings();

    return NextResponse.json({
        giftBalanceCents: getGiftFundValueCents(),
        stfBuckets: getStfBucketsWithBalances(),
        quarters,
        giftLog,
        orderPricing: {
            taxPercent: percentBpsToDisplay(pricing.taxPercentBps),
            shippingPercent: percentBpsToDisplay(pricing.shippingPercentBps),
        },
    });
}
