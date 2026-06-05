"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

// Names can be long. By default we truncate to keep the table tidy; clicking
// toggles the full name into view (wrapping/breaking as needed).
export function EntryName({ name }: { name: string }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Click to collapse" : name}
            aria-expanded={expanded}
            className={cn(
                "text-foreground block max-w-[16rem] cursor-pointer text-left font-medium",
                expanded ? "break-words whitespace-normal" : "truncate"
            )}
        >
            {name}
        </button>
    );
}
