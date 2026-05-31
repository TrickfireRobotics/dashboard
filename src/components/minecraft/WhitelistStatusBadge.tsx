"use client";

import { Badge } from "@/components/ui/badge";
import type { WhitelistStatus } from "@/lib/db/schema";

const STATUS: Record<
    WhitelistStatus,
    {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
    }
> = {
    pending: { label: "Pending", variant: "outline" },
    approved: { label: "Approved", variant: "default" },
    rejected: { label: "Rejected", variant: "destructive" },
};

export function WhitelistStatusBadge({ status }: { status: WhitelistStatus }) {
    const { label, variant } = STATUS[status];
    return <Badge variant={variant}>{label}</Badge>;
}
