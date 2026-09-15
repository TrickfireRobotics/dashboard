"use client";

import { useEffect, useState } from "react";

import { normalizeVendorName, type ApprovalStatus } from "@/lib/vendors/approval";
import type { VendorHit } from "@/lib/vendors/lookup";

// Debounced client-side approval check for a chosen vendor name. Reuses the
// search endpoint and looks for an exact (case-insensitive) supplier-name match:
// a match resolves to that vendor's status, a non-empty name with no match is
// "NotFound" (out of scope), and an empty name yields null so no badge shows.
export function useVendorApproval(name: string): {
    status: ApprovalStatus | null;
    loading: boolean;
} {
    const [status, setStatus] = useState<ApprovalStatus | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const trimmed = name.trim();
        if (!trimmed) {
            setStatus(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const controller = new AbortController();
        const timer = setTimeout(() => {
            fetch(`/api/vendors/search?q=${encodeURIComponent(trimmed)}&limit=10`, {
                signal: controller.signal,
            })
                .then((res) => (res.ok ? res.json() : null))
                .then((data: { results?: VendorHit[] } | null) => {
                    const hits = data?.results ?? [];
                    const key = normalizeVendorName(trimmed);
                    const exact = hits.find((h) => normalizeVendorName(h.supplierName) === key);
                    setStatus(exact ? exact.status : "NotFound");
                })
                .catch((err) => {
                    if (err?.name !== "AbortError") setStatus(null);
                })
                .finally(() => setLoading(false));
        }, 300);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [name]);

    return { status, loading };
}
