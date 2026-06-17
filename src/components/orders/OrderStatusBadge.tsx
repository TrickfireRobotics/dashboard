"use client";

import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/db/schema";

const STATUS: Record<
    OrderStatus,
    {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
    }
> = {
    pending: { label: "Pending", variant: "outline" },
    approved: { label: "Approved", variant: "default" },
    ordered: { label: "Ordered", variant: "secondary" },
    denied: { label: "Denied", variant: "destructive" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
    const config = STATUS[status] ?? { label: status, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
}
