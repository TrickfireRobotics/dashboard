import { desc } from "drizzle-orm";

import { FinanceManager } from "@/components/finance/FinanceManager";
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

export default async function AdminFinancePage() {
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

    return (
        <div className="space-y-6">
            <FinanceManager
                initial={{
                    giftBalanceCents: getGiftFundValueCents(),
                    stfBuckets: getStfBucketsWithBalances(),
                    quarters,
                    giftLog,
                    orderPricing: {
                        taxPercent: percentBpsToDisplay(pricing.taxPercentBps),
                        shippingPercent: percentBpsToDisplay(pricing.shippingPercentBps),
                    },
                }}
            />
        </div>
    );
}
