"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BalanceAmount } from "@/components/BalanceAmount";
import { Button } from "@/components/ui/button";
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
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [canScrollDown, setCanScrollDown] = useState(false);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        function updateScrollState() {
            if (!el) return;
            setCanScrollUp(el.scrollTop > 1);
            setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
        }

        updateScrollState();
        el.addEventListener("scroll", updateScrollState);
        return () => el.removeEventListener("scroll", updateScrollState);
    }, [stfBuckets.length]);

    function scrollByPage(direction: "up" | "down") {
        const el = scrollRef.current;
        if (!el) return;
        const amount = el.clientHeight * 0.8;
        el.scrollBy({ top: direction === "down" ? amount : -amount, behavior: "smooth" });
    }

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
                        "from-card pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-40% to-transparent transition-opacity duration-200",
                        canScrollUp ? "opacity-100" : "opacity-0"
                    )}
                />
                <div
                    aria-hidden
                    className={cn(
                        "from-card pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-40% to-transparent transition-opacity duration-200",
                        canScrollDown ? "opacity-100" : "opacity-0"
                    )}
                />

                {canScrollUp ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => scrollByPage("up")}
                        aria-label="Scroll up for more funds"
                        className="bg-card hover:bg-muted absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-full shadow-md"
                    >
                        <ChevronUp className="size-4" />
                    </Button>
                ) : null}
                {canScrollDown ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => scrollByPage("down")}
                        aria-label="Scroll down for more funds"
                        className="bg-card hover:bg-muted absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full shadow-md"
                    >
                        <ChevronDown className="size-4" />
                    </Button>
                ) : null}
            </div>
            {stfBuckets.length === 0 ? (
                <p className="text-muted-foreground border-border border-t px-4 py-3 text-xs">
                    No active STF buckets are configured for this school year.
                </p>
            ) : null}
        </DataTableCard>
    );
}
