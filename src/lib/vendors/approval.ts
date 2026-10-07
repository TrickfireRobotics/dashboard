import type { VendorStatus } from "@/lib/db/schema";

// Punctuation/spacing-insensitive key for matching vendor names: "Digi-Key",
// "digi key", and "DIGIKEY" all collapse to "digikey". Used for search and for
// resolving the approval flag so trivial formatting differences don't read as
// "out of scope".
export function normalizeVendorName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Approval rule (confirmed with finance): a vendor is approved only when its
// source Supplier Status is "Active". Inactive, Hold, blank (-> "Unknown"), and
// a vendor that isn't in the list at all are all "out of scope".
export function isApproved(status: VendorStatus): boolean {
    return status === "Active";
}

export type ApprovalStatus = VendorStatus | "NotFound";

export type Approval = {
    approved: boolean;
    status: ApprovalStatus;
    label: string;
};

// Resolves a matched vendor (or null when nothing matched the chosen name) into
// the flag the order form and search dialog render.
export function approvalFor(vendor: { status: VendorStatus } | null): Approval {
    if (!vendor) {
        return { approved: false, status: "NotFound", label: "Out of scope" };
    }
    const approved = isApproved(vendor.status);
    return {
        approved,
        status: vendor.status,
        label: approved ? "Approved" : "Out of scope",
    };
}
