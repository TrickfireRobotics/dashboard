"use client";

import {
    type AriaAttributes,
    type KeyboardEvent,
    type Ref,
    useEffect,
    useId,
    useState,
} from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ApprovalStatus } from "@/lib/vendors/approval";
import type { VendorHit } from "@/lib/vendors/lookup";
import { useVendorLookup } from "@/lib/vendors/use-vendor-lookup";

import { VendorApprovalBadge } from "./VendorApprovalBadge";

// Vendor field with live suggestions from the approved-vendor list. Stays a
// free-text input (the order form still accepts any vendor); the dropdown just
// helps the user land on a known, correctly-spelled supplier. Built from the
// base Input plus a positioned list because the UI kit has no Command/Popover.
export function VendorCombobox({
    value,
    onChange,
    onBlur,
    onApprovalStatusChange,
    name,
    placeholder,
    className,
    ref,
    id,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
}: {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    // Reports the exact-match status for `value` as it resolves, so a sibling
    // approval badge can show it without firing its own search request.
    onApprovalStatusChange?: (status: ApprovalStatus | null) => void;
    name?: string;
    placeholder?: string;
    className?: string;
    ref?: Ref<HTMLInputElement>;
    id?: string;
    "aria-invalid"?: AriaAttributes["aria-invalid"];
    "aria-describedby"?: string;
}) {
    const { results, exactStatus } = useVendorLookup(value, 8);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    // Set when the user picks / commits a value, so we don't immediately
    // re-open the dropdown for that same string.
    const [justCommitted, setJustCommitted] = useState(false);
    const listId = useId();

    useEffect(() => setActiveIndex(-1), [results]);

    useEffect(() => {
        onApprovalStatusChange?.(exactStatus);
    }, [exactStatus, onApprovalStatusChange]);

    function commit(hit: VendorHit) {
        setJustCommitted(true);
        onChange(hit.supplierName);
        setOpen(false);
    }

    const showList = open && !justCommitted && results.length > 0;

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
                ref={ref}
                id={id}
                aria-invalid={ariaInvalid}
                aria-describedby={ariaDescribedBy}
                name={name}
                value={value}
                placeholder={placeholder}
                autoComplete="off"
                role="combobox"
                aria-expanded={showList}
                aria-controls={listId}
                className={className}
                onChange={(e) => {
                    setJustCommitted(false);
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
