"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { VendorHit } from "@/lib/vendors/lookup";

import { VendorApprovalBadge } from "./VendorApprovalBadge";

// Vendor field with live suggestions from the approved-vendor list. Stays a
// free-text input (the order form still accepts any vendor); the dropdown just
// helps the user land on a known, correctly-spelled supplier. Built from the
// base Input plus a positioned list because the UI kit has no Command/Popover.
export function VendorCombobox({
    value,
    onChange,
    onBlur,
    name,
    placeholder,
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    name?: string;
    placeholder?: string;
    className?: string;
}) {
    const [results, setResults] = useState<VendorHit[]>([]);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    // Set when the user picks / commits a value, so we don't immediately
    // re-open the dropdown for that same string.
    const justCommitted = useRef(false);
    const listId = useId();

    useEffect(() => {
        const q = value.trim();
        if (!q || justCommitted.current) {
            setResults([]);
            return;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => {
            fetch(`/api/vendors/search?q=${encodeURIComponent(q)}&limit=8`, {
                signal: controller.signal,
            })
                .then((res) => (res.ok ? res.json() : null))
                .then((data: { results?: VendorHit[] } | null) => {
                    setResults(data?.results ?? []);
                    setActiveIndex(-1);
                })
                .catch(() => {
                    /* aborted or offline; keep previous suggestions */
                });
        }, 250);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [value]);

    function commit(hit: VendorHit) {
        justCommitted.current = true;
        onChange(hit.supplierName);
        setOpen(false);
        setResults([]);
    }

    const showList = open && results.length > 0;

    function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (!showList) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % results.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => (i - 1 + results.length) % results.length);
        } else if (e.key === "Enter" && activeIndex >= 0) {
            e.preventDefault();
            commit(results[activeIndex]);
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    }

    return (
        <div className="relative">
            <Input
                name={name}
                value={value}
                placeholder={placeholder}
                autoComplete="off"
                role="combobox"
                aria-expanded={showList}
                aria-controls={listId}
                className={className}
                onChange={(e) => {
                    justCommitted.current = false;
                    onChange(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                onBlur={() => {
                    // Delay so a click on a suggestion (mousedown) registers first.
                    setTimeout(() => setOpen(false), 120);
                    onBlur?.();
                }}
            />
            {showList ? (
                <ul
                    id={listId}
                    role="listbox"
                    className="bg-popover text-popover-foreground ring-foreground/10 absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg p-1 shadow-md ring-1"
                >
                    {results.map((hit, i) => (
                        <li key={hit.id} role="option" aria-selected={i === activeIndex}>
                            <button
                                type="button"
                                // mousedown fires before the input's blur, so the
                                // pick isn't lost to the closing timeout.
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    commit(hit);
                                }}
                                onMouseEnter={() => setActiveIndex(i)}
                                className={cn(
                                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                                    i === activeIndex ? "bg-muted" : "hover:bg-muted/60"
                                )}
                            >
                                <span className="min-w-0 truncate">{hit.supplierName}</span>
                                <VendorApprovalBadge status={hit.status} iconOnly />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
