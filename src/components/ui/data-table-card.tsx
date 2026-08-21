import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

function DataTableCard({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="data-table-card"
            className={cn("border-border bg-card rounded-lg border", className)}
            {...props}
        />
    );
}

function DataTableCardHeader({
    title,
    description,
    action,
    className,
}: {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div
            data-slot="data-table-card-header"
            className={cn(
                "border-border flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                className
            )}
        >
            <div className="min-w-0">
                <h2 className="text-lg font-semibold">{title}</h2>
                {description ? (
                    <p className="text-muted-foreground text-sm">{description}</p>
                ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    );
}

function DataTableCardToolbar({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="data-table-card-toolbar"
            className={cn(
                "border-border bg-muted/20 flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center",
                className
            )}
            {...props}
        />
    );
}

export { DataTableCard, DataTableCardHeader, DataTableCardToolbar };
