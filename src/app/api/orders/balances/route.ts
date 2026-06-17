import { NextResponse } from "next/server";

import {
    ensureFinanceSettingsRow,
    getGiftFundValueCents,
    getOrderPricingSettings,
    getStfBucketsWithBalances,
} from "@/lib/finance/finance";
import { percentBpsToDisplay } from "@/lib/finance/order-pricing";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    ensureFinanceSettingsRow();
    const pricing = getOrderPricingSettings();

    return NextResponse.json({
        giftBalanceCents: getGiftFundValueCents(),
        stfBuckets: getStfBucketsWithBalances(),
        orderPricing: {
            taxPercent: percentBpsToDisplay(pricing.taxPercentBps),
            shippingPercent: percentBpsToDisplay(pricing.shippingPercentBps),
        },
    });
}
