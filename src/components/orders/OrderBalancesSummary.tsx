import { BalanceAmount } from "@/components/BalanceAmount";
import type { StfBucketBalance } from "@/lib/finance";
import { cn } from "@/lib/utils";

type OrderBalancesSummaryProps = {
    giftBalanceCents: number;
    stfBuckets: StfBucketBalance[];
};

function FundChip({
    label,
    cents,
    mode,
}: {
    label: string;
    cents: number;
    mode: "signed" | "remaining";
}) {
    return (
        <div
            className={cn(
                "border-border bg-card flex min-w-36 items-center justify-between gap-3 rounded-lg border px-3 py-2"
            )}
        >
            <span className="text-muted-foreground truncate text-xs font-medium">{label}</span>
            <BalanceAmount cents={cents} size="sm" mode={mode} className="shrink-0" />
        </div>
    );
}

export function OrderBalancesSummary({ giftBalanceCents, stfBuckets }: OrderBalancesSummaryProps) {
    return (
        <div className="space-y-2">
            <h2 className="text-muted-foreground text-sm font-medium">Available funds</h2>
            <div className="flex flex-wrap gap-2">
                <FundChip label="Gift fund" cents={giftBalanceCents} mode="signed" />
                {stfBuckets.map((bucket) => (
                    <FundChip
                        key={bucket.id}
                        label={bucket.name}
                        cents={bucket.remainingBalanceCents}
                        mode="remaining"
                    />
                ))}
            </div>
            {stfBuckets.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                    No active STF buckets are configured for this quarter.
                </p>
            ) : null}
        </div>
    );
}
