"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { BalanceAmount } from "@/components/BalanceAmount";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import type { StfBucketBalance } from "@/lib/finance/finance";
import { cn, formatPriceCents } from "@/lib/utils";

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

    const bucketCount = stfBuckets.length;
    const stfTotalCents = stfBuckets.reduce(
        (total, bucket) => total + bucket.remainingBalanceCents,
        0
    );
    const overBudget = stfTotalCents < 0;
    const bucketLabel =
        bucketCount === 0
            ? "No active STF buckets"
            : `Across ${bucketCount} STF ${bucketCount === 1 ? "bucket" : "buckets"}`;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={<button type="button" />}
                className="group border-border bg-card hover:bg-muted/40 hover:border-border/80 focus-visible:ring-ring/50 flex w-full cursor-pointer items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left shadow-xs transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
            >
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold">Available funds</h2>
                    <p className="text-muted-foreground truncate text-sm">
                        {bucketLabel} · Gift fund {formatPriceCents(giftBalanceCents)}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                        <span
                            className={cn(
                                "text-lg font-semibold tabular-nums",
                                overBudget ? "text-destructive" : "text-foreground"
                            )}
                        >
                            {formatPriceCents(Math.abs(stfTotalCents))}
                        </span>
                        <p className="text-muted-foreground text-xs">
                            {overBudget ? "over budget in buckets" : "unused in buckets"}
                        </p>
                    </div>
                    <ChevronRight className="text-muted-foreground group-hover:text-foreground size-5 transition-all group-hover:translate-x-0.5" />
                </div>
            </DialogTrigger>

            <DialogContent className="gap-0 p-0 sm:max-w-md">
                <DialogHeader className="px-4 pt-4 pb-3">
                    <DialogTitle>Available funds</DialogTitle>
                    <DialogDescription>
                        Gift fund and {bucketCount} STF {bucketCount === 1 ? "bucket" : "buckets"}
                    </DialogDescription>
                </DialogHeader>
                <div className="border-border divide-border max-h-[60vh] divide-y overflow-y-auto border-t">
                    <FundRow label="Gift fund" cents={giftBalanceCents} mode="signed" highlighted />
                    {stfBuckets.map((bucket) => (
                        <FundRow
                            key={bucket.id}
                            label={bucket.name}
                            cents={bucket.remainingBalanceCents}
                            mode="remaining"
                        />
                    ))}
                </div>
                {bucketCount === 0 ? (
                    <p className="text-muted-foreground border-border border-t px-4 py-3 text-xs">
                        No active STF buckets are configured for this school year.
                    </p>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
