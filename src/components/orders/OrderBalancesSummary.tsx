import { BalanceAmount, RemainingBalanceCaption } from "@/components/BalanceAmount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StfBucketBalance } from "@/lib/finance";

type OrderBalancesSummaryProps = {
    giftBalanceCents: number;
    stfBuckets: StfBucketBalance[];
};

export function OrderBalancesSummary({ giftBalanceCents, stfBuckets }: OrderBalancesSummaryProps) {
    return (
        <div className="space-y-3">
            <h2 className="text-muted-foreground text-sm font-medium">Available funds</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Card size="sm">
                    <CardHeader>
                        <CardTitle>Gift fund</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <BalanceAmount cents={giftBalanceCents} size="lg" mode="signed" />
                    </CardContent>
                </Card>
                {stfBuckets.map((bucket) => (
                    <Card key={bucket.id} size="sm">
                        <CardHeader>
                            <CardTitle>{bucket.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <BalanceAmount
                                cents={bucket.remainingBalanceCents}
                                size="lg"
                                mode="remaining"
                            />
                            <RemainingBalanceCaption cents={bucket.remainingBalanceCents} />
                        </CardContent>
                    </Card>
                ))}
            </div>
            {stfBuckets.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                    No active STF buckets are configured for this quarter.
                </p>
            ) : null}
        </div>
    );
}
