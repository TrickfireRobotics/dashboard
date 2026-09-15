"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { VendorHit } from "@/lib/vendors/lookup";

import { VendorApprovalBadge } from "./VendorApprovalBadge";

// Standalone approved-vendor lookup, launched by a button on the Orders page.
// Lets anyone check whether a vendor is approved without starting an order.
export function VendorSearchDialog() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<VendorHit[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    useEffect(() => {
        if (!open) return;
        const q = query.trim();
        if (!q) {
            setResults([]);
            setSearched(false);
            return;
        }
        setLoading(true);
        const controller = new AbortController();
        const timer = setTimeout(() => {
            fetch(`/api/vendors/search?q=${encodeURIComponent(q)}&limit=25`, {
                signal: controller.signal,
            })
                .then((res) => (res.ok ? res.json() : null))
                .then((data: { results?: VendorHit[] } | null) => {
                    setResults(data?.results ?? []);
                    setSearched(true);
                })
                .catch(() => {
                    /* aborted or offline */
                })
                .finally(() => setLoading(false));
        }, 250);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, open]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button variant="outline" />}>
                <Search className="size-4" />
                Search vendors
            </DialogTrigger>
            <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Search approved vendors</DialogTitle>
                    <DialogDescription>
                        Look up a supplier to see whether it&apos;s approved (Active) or out of
                        scope.
                    </DialogDescription>
                </DialogHeader>

                <Input
                    autoFocus
                    value={query}
                    placeholder="Vendor name or ID, e.g. Alliance Geomatics"
                    onChange={(e) => setQuery(e.target.value)}
                />

                <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
                    {results.length > 0 ? (
                        <ul className="divide-border divide-y">
                            {results.map((hit) => (
                                <li
                                    key={hit.id}
                                    className="flex items-center justify-between gap-3 py-2"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">
                                            {hit.supplierName}
                                        </p>
                                        {hit.supplierId ? (
                                            <p className="text-muted-foreground truncate text-xs">
                                                {hit.supplierId}
                                            </p>
                                        ) : null}
                                    </div>
                                    <VendorApprovalBadge status={hit.status} />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground py-6 text-center text-sm">
                            {loading
                                ? "Searching…"
                                : searched
                                  ? "No matching vendor — treat as out of scope."
                                  : "Start typing to search the approved-vendor list."}
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
