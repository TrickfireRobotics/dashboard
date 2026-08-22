import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: {
    icon?: LucideIcon;
    title: string;
    description?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "border-border text-muted-foreground flex flex-col items-center gap-2 rounded-lg border p-10 text-center",
                className
            )}
        >
            {Icon ? <Icon className="mb-1 size-8" /> : null}
            <p className="text-foreground font-medium">{title}</p>
            {description ? <p className="text-sm text-balance">{description}</p> : null}
            {action ? <div className="mt-2">{action}</div> : null}
        </div>
    );
}
