"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";

import {
    isOverBudget,
    stfBucketSelectLabel,
    StfBucketSelectItemContent,
} from "@/components/BalanceAmount";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { StfBucketOption } from "./AdminOrderQueue";

// The bucket list can run into the dozens, comes back unsorted from the
// server, and a plain dropdown has no way to filter it. This swaps in a
// searchable combobox, built the same way as VendorCombobox (Input plus a
// positioned list) since the UI kit has no Command/Popover primitive.
export function BucketCombobox({
    stfBuckets,
    value,
    onChange,
    className,
}: {
    stfBuckets: StfBucketOption[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
}) {
    const sorted = useMemo(
        () => [...stfBuckets].sort((a, b) => a.name.localeCompare(b.name)),
        [stfBuckets]
    );
    const selected = sorted.find((b) => String(b.id) === value) ?? null;

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? sorted.filter((b) => b.name.toLowerCase().includes(q)) : sorted;
    }, [sorted, query]);

    useEffect(() => setActiveIndex(-1), [filtered]);

    function commit(bucket: StfBucketOption) {
        onChange(String(bucket.id));
        setOpen(false);
        setQuery("");
    }

    function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (!open) {
            if (e.key === "ArrowDown" || e.key === "Enter") {
                e.preventDefault();
                setOpen(true);
            }
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % filtered.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
        } else if (e.key === "Enter" && activeIndex >= 0 && filtered[activeIndex]) {
            e.preventDefault();
            commit(filtered[activeIndex]);
        } else if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
        }
    }

    const displayValue = open
        ? query
        : selected
          ? stfBucketSelectLabel(selected.name, selected.remainingBalanceCents)
          : "";

    return (
        <div className={cn("relative w-72", className)}>
            <Input
                ref={inputRef}
                value={displayValue}
                placeholder="Select bucket"
                autoComplete="off"
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                className={cn(
                    "h-8 pr-8",
                    !open &&
                        selected &&
                        isOverBudget(selected.remainingBalanceCents) &&
                        "text-destructive"
                )}
                onFocus={() => {
                    setOpen(true);
                    setQuery("");
                }}
                onClick={() => {
                    // Clicking a trigger that's already focused (e.g. right after
                    // picking a bucket) doesn't fire a new focus event, so open here too.
                    if (!open) {
                        setOpen(true);
                        setQuery("");
                    }
                }}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                onBlur={() => {
                    // Delay so a click on an option (mousedown) registers first.
                    setTimeout(() => setOpen(false), 120);
                }}
            />
            <ChevronsUpDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2" />
            {open ? (
                <ul
                    id={listId}
                    role="listbox"
                    className="bg-popover text-popover-foreground ring-foreground/10 absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg p-1 shadow-md ring-1"
                >
                    {filtered.length === 0 ? (
                        <li className="text-muted-foreground px-2 py-1.5 text-sm">
                            No buckets match &quot;{query}&quot;
                        </li>
                    ) : (
                        filtered.map((bucket, i) => (
                            <li key={bucket.id} role="option" aria-selected={i === activeIndex}>
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        commit(bucket);
                                    }}
                                    onMouseEnter={() => setActiveIndex(i)}
                                    className={cn(
                                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                                        i === activeIndex ? "bg-muted" : "hover:bg-muted/60",
                                        isOverBudget(bucket.remainingBalanceCents) &&
                                            "text-destructive"
                                    )}
                                >
                                    <Check
                                        className={cn(
                                            "size-4 shrink-0",
                                            String(bucket.id) === value
                                                ? "opacity-100"
                                                : "opacity-0"
                                        )}
                                    />
                                    <StfBucketSelectItemContent
                                        name={bucket.name}
                                        cents={bucket.remainingBalanceCents}
                                    />
                                </button>
                            </li>
                        ))
                    )}
                </ul>
            ) : null}
        </div>
    );
}
