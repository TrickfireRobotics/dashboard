"use client";

import { useEffect, useRef, useState } from "react";

import { BalanceAmount } from "@/components/BalanceAmount";
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
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showBottomShadow, setShowBottomShadow] = useState(false);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        function updateShadow() {
            if (!el) return;
            setShowBottomShadow(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
        }

        updateShadow();
        el.addEventListener("scroll", updateShadow);
        return () => el.removeEventListener("scroll", updateShadow);
    }, [stfBuckets.length]);

    return (
        <DataTableCard>
            <div className="px-4 py-3">
                <h2 className="text-lg font-semibold">Available funds</h2>
                <p className="text-muted-foreground text-sm">
                    Gift fund and {stfBuckets.length} STF{" "}
                    {stfBuckets.length === 1 ? "bucket" : "buckets"}
                </p>
            </div>
            <div className="relative">
                <div
                    ref={scrollRef}
                    className="border-border divide-border max-h-72 divide-y overflow-y-auto border-t"
                >
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
                <div
                    aria-hidden
                    className={cn(
                        "from-card pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t to-transparent transition-opacity duration-200",
                        showBottomShadow ? "opacity-100" : "opacity-0"
                    )}
                />
            </div>
            {stfBuckets.length === 0 ? (
                <p className="text-muted-foreground border-border border-t px-4 py-3 text-xs">
                    No active STF buckets are configured for this school year.
                </p>
            ) : null}
        </DataTableCard>
    );
}
