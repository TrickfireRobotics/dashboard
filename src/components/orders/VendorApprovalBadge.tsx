import { CircleAlert, CircleCheck, CircleHelp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ApprovalStatus } from "@/lib/vendors/approval";

// Green isn't a Badge variant, so approved gets an explicit emerald treatment;
// out-of-scope reuses the destructive variant. `Unknown`/`NotFound` (blank
// source status or a vendor that isn't in the list) is still out of scope per
// the approval rule, but shown neutrally so it doesn't read as a hard rejection.
function styleFor(status: ApprovalStatus) {
    if (status === "Active") {
        return {
            variant: "outline" as const,
            className:
                "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
            Icon: CircleCheck,
            label: "Approved",
        };
    }
    if (status === "Unknown" || status === "NotFound") {
        return {
            variant: "outline" as const,
            className: "text-muted-foreground",
            Icon: CircleHelp,
            label: "Out of scope",
        };
    }
    return {
        variant: "destructive" as const,
        className: "",
        Icon: CircleAlert,
        label: "Out of scope",
    };
}

export function VendorApprovalBadge({
    status,
    iconOnly = false,
    className,
}: {
    status: ApprovalStatus;
    iconOnly?: boolean;
    className?: string;
}) {
    const { variant, className: styleClass, Icon, label } = styleFor(status);
    // Raw source status stays visible on hover so a reviewer can tell an
    // Inactive vendor from one that simply isn't in the list.
    const title = status === "NotFound" ? "Not in approved-vendor list" : `Status: ${status}`;

    return (
        <Badge
            variant={variant}
            title={title}
            aria-label={label}
            className={cn(styleClass, className)}
        >
            <Icon />
            {iconOnly ? <span className="sr-only">{label}</span> : label}
        </Badge>
    );
}
