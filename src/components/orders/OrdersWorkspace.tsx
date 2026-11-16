"use client";

import { Archive, ClipboardList, Search, User, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { AdminOrderQueue, type AdminOrderRow, type StfBucketOption } from "./AdminOrderQueue";
import { OrderTable } from "./OrderTable";
import { orderMatchesQuery } from "./order-filters";
import { TeamOrderTable } from "./TeamOrderTable";

export type WorkspaceOrderRow = AdminOrderRow & { userId: string };

type TabValue = "queue" | "archive" | "mine" | "all";

const TAB_VALUES: TabValue[] = ["queue", "archive", "mine", "all"];

const tabTriggerClass =
    "group/trigger h-14 gap-2 rounded-lg border border-transparent px-3 text-sm font-semibold hover:bg-muted/70 data-active:border-primary/30 data-active:bg-primary/10 data-active:text-primary dark:data-active:border-primary/40 dark:data-active:bg-primary/15 dark:data-active:text-primary";

function TabCount({ value }: { value: number }) {
    return (
        <span
            className={cn(
                "bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                "group-data-[active]/trigger:bg-primary group-data-[active]/trigger:text-primary-foreground"
            )}
        >
            {value}
        </span>
    );
}

export function OrdersWorkspace({
    orders,
    currentUserId,
    stfBuckets,
    orderPricing,
}: {
    orders: WorkspaceOrderRow[];
    currentUserId: string;
    stfBuckets: StfBucketOption[];
    orderPricing: { taxPercent: number; shippingPercent: number };
}) {
    const searchParams = useSearchParams();
    const initialTab = searchParams.get("tab");
    const [tab, setTab] = useState<TabValue>(
        TAB_VALUES.includes(initialTab as TabValue) ? (initialTab as TabValue) : "queue"
    );
    const [query, setQuery] = useState("");

    // One search drives every tab, so the counts in the tab strip double as
    // "where did my order end up" answers.
    const matching = useMemo(
        () => orders.filter((order) => orderMatchesQuery(order, query)),
        [orders, query]
    );

    const counts = useMemo(() => {
        let queue = 0;
        let archive = 0;
        let mine = 0;
        for (const order of matching) {
            if (order.status === "ordered" || order.status === "denied") archive++;
            else queue++;
            if (order.userId === currentUserId) mine++;
        }
        return { queue, archive, mine, all: matching.length };
    }, [matching, currentUserId]);

    const myOrders = useMemo(
        () => matching.filter((order) => order.userId === currentUserId),
        [matching, currentUserId]
    );

    function changeTab(next: TabValue) {
        setTab(next);
        // replaceState keeps the tab linkable without kicking off a navigation
        // that would throw away the current selection.
        const url = new URL(window.location.href);
        if (next === "queue") url.searchParams.delete("tab");
        else url.searchParams.set("tab", next);
        window.history.replaceState(null, "", url);
    }

    return (
        <Tabs value={tab} onValueChange={(value) => changeTab(value as TabValue)}>
            <section className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">Orders</h2>
                        <p className="text-muted-foreground text-sm">
                            Review requests and track completed purchases.
                        </p>
                    </div>

                    <div className="relative w-full sm:w-96">
                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            id="order-search"
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search orders"
                            aria-label="Search orders"
                            className="bg-background h-10 pr-9 pl-9"
                        />
                        {query ? (
                            <button
                                type="button"
                                onClick={() => setQuery("")}
                                aria-label="Clear search"
                                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                            >
                                <X className="size-4" />
                            </button>
                        ) : null}
                    </div>
                </div>

                <TabsList className="border-border bg-card grid h-auto w-full grid-cols-2 gap-1.5 rounded-xl border p-1.5 shadow-sm group-data-horizontal/tabs:h-auto sm:grid-cols-4">
                    <TabsTrigger value="queue" className={tabTriggerClass}>
                        <ClipboardList className="size-4" />
                        <span>Queue</span>
                        <TabCount value={counts.queue} />
                    </TabsTrigger>
                    <TabsTrigger value="archive" className={tabTriggerClass}>
                        <Archive className="size-4" />
                        <span>Archive</span>
                        <TabCount value={counts.archive} />
                    </TabsTrigger>
                    <TabsTrigger value="mine" className={tabTriggerClass}>
                        <User className="size-4" />
                        <span>Yours</span>
                        <TabCount value={counts.mine} />
                    </TabsTrigger>
                    <TabsTrigger value="all" className={tabTriggerClass}>
                        <Search className="size-4" />
                        <span>All orders</span>
                        <TabCount value={counts.all} />
                    </TabsTrigger>
                </TabsList>
            </section>

            <div aria-hidden className="border-border/80 mt-4 border-t" />

            <TabsContent value="queue" className="pt-4">
                <AdminOrderQueue
                    view="queue"
                    orders={matching}
                    stfBuckets={stfBuckets}
                    orderPricing={orderPricing}
                    searching={query.trim().length > 0}
                />
            </TabsContent>

            <TabsContent value="archive" className="pt-4">
                <AdminOrderQueue
                    view="archive"
                    orders={matching}
                    stfBuckets={stfBuckets}
                    orderPricing={orderPricing}
                    searching={query.trim().length > 0}
                />
            </TabsContent>

            <TabsContent value="mine" className="pt-4">
                <OrderTable
                    orders={myOrders}
                    orderPricing={orderPricing}
                    emptyMessage={
                        query.trim()
                            ? "None of your orders match this search."
                            : "You have not submitted any orders yet."
                    }
                />
            </TabsContent>

            <TabsContent value="all" className="pt-4">
                <TeamOrderTable
                    orders={matching}
                    orderPricing={orderPricing}
                    emptyMessage={
                        query.trim()
                            ? "No orders match this search."
                            : "No orders have been submitted yet."
                    }
                />
            </TabsContent>
        </Tabs>
    );
}
