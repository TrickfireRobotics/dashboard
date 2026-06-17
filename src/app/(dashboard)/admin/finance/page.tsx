import { desc } from "drizzle-orm";

import { FinanceManager } from "@/components/finance/FinanceManager";
import { db } from "@/lib/db";
import {
    ensureGiftFundRow,
    getGiftFundValueCents,
    getStfBucketsWithBalances,
} from "@/lib/finance/finance";
import { giftFundLog, stfQuarter } from "@/lib/db/schema";

export default async function AdminFinancePage() {
    ensureGiftFundRow();

    const quarters = db.select().from(stfQuarter).orderBy(desc(stfQuarter.createdAt)).all();
    const giftLog = db
        .select()
        .from(giftFundLog)
        .orderBy(desc(giftFundLog.timestamp))
        .limit(50)
        .all();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">Finance</h1>
                <p className="text-muted-foreground">
                    Manage STF buckets, gift fund value, and school year resets.
                </p>
            </div>

            <FinanceManager
                initial={{
                    giftBalanceCents: getGiftFundValueCents(),
                    stfBuckets: getStfBucketsWithBalances(),
                    quarters,
                    giftLog,
                }}
            />
        </div>
    );
}
