"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { BalanceAmount } from "@/components/BalanceAmount";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DataTableCard } from "@/components/ui/data-table-card";
import type { StfBucketBalance } from "@/lib/finance/finance";
import { cn } from "@/lib/utils";

type OrderBalancesSummaryProps = {
    giftBalanceCents: number;
    stfBuckets: StfBucketBalance[];
};

function FundRow({
    label,
    cents,
    mode,
    highlighted,
}: {
    label: string;
    cents: number;
    mode: "signed" | "remaining";
    highlighted?: boolean;
}) {
    return (
        <div
            className={cn(
                "flex items-center justify-between gap-4 px-4 py-2.5",
                highlighted && "bg-primary/5"
            )}
        >
            <span className="truncate text-sm font-medium">{label}</span>
            <BalanceAmount cents={cents} size="sm" mode={mode} className="tabular-nums" />
        </div>
    );
}

export function OrderBalancesSummary({ giftBalanceCents, stfBuckets }: OrderBalancesSummaryProps) {
    const [open, setOpen] = useState(false);

    return (
        <DataTableCard>
            <Collapsible open={open} onOpenChange={setOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 text-left">
                        <h2 className="text-lg font-semibold">Available funds</h2>
                        <p className="text-muted-foreground text-sm">
                            Gift fund and {stfBuckets.length} STF{" "}
                            {stfBuckets.length === 1 ? "bucket" : "buckets"}
                        </p>
                    </div>
                    <ChevronDown
                        className={cn(
                            "text-muted-foreground size-4 shrink-0 transition-transform duration-200",
                            open && "rotate-180"
                        )}
                    />
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="border-border divide-border max-h-72 divide-y overflow-y-auto border-t">
                        <FundRow
                            label="Gift fund"
                            cents={giftBalanceCents}
                            mode="signed"
                            highlighted
                        />
                        {stfBuckets.map((bucket) => (
                            <FundRow
                                key={bucket.id}
                                label={bucket.name}
                                cents={bucket.remainingBalanceCents}
                                mode="remaining"
                            />
                        ))}
                    </div>
                    {stfBuckets.length === 0 ? (
                        <p className="text-muted-foreground border-border border-t px-4 py-3 text-xs">
                            No active STF buckets are configured for this school year.
                        </p>
                    ) : null}
                </CollapsibleContent>
            </Collapsible>
        </DataTableCard>
    );
}
