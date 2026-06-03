import { Badge } from "@/components/ui/badge";
import type { JoinRequestStatus } from "@/lib/db/schema";

const CONFIG: Record<
    JoinRequestStatus,
    { label: string; variant: "default" | "secondary" | "destructive" }
> = {
    pending: { label: "Pending", variant: "secondary" },
    approved: { label: "Approved", variant: "default" },
    rejected: { label: "Rejected", variant: "destructive" },
};

export function JoinRequestStatusBadge({ status }: { status: JoinRequestStatus }) {
    const { label, variant } = CONFIG[status];
    return <Badge variant={variant}>{label}</Badge>;
}
