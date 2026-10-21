"use client";

import { useEffect, useState } from "react";

import type { ApprovalStatus } from "@/lib/vendors/approval";
import type { VendorHit } from "@/lib/vendors/lookup";

type VendorLookup = {
    results: VendorHit[];
    exactStatus: ApprovalStatus | null;
    loading: boolean;
};

// Debounced lookup for a typed vendor name, shared by the suggestion dropdown
// and the approval badge so one keystroke triggers one /api/vendors/search
// request instead of two. The endpoint returns both a ranked suggestion list
// and the exact-name match in a single round trip.
export function useVendorLookup(value: string, limit = 8): VendorLookup {
    const [results, setResults] = useState<VendorHit[]>([]);
    const [exactStatus, setExactStatus] = useState<ApprovalStatus | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const q = value.trim();
        if (!q) {
            setResults([]);
            setExactStatus(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const controller = new AbortController();
        const timer = setTimeout(() => {
            fetch(`/api/vendors/search?q=${encodeURIComponent(q)}&limit=${limit}`, {
                signal: controller.signal,
            })
                .then((res) => (res.ok ? res.json() : null))
                .then((data: { results?: VendorHit[]; exactMatch?: VendorHit | null } | null) => {
                    setResults(data?.results ?? []);
                    setExactStatus(data?.exactMatch ? data.exactMatch.status : "NotFound");
                })
                .catch((err) => {
                    if (err?.name !== "AbortError") {
                        setResults([]);
                        setExactStatus(null);
                    }
                })
                .finally(() => setLoading(false));
        }, 250);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [value, limit]);

    return { results, exactStatus, loading };
}
