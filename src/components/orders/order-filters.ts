import type { FundType, OrderStatus } from "@/lib/db/schema";

// The smallest shape every order table shares. Each table passes its own row
// type in; the extra fields it carries are ignored here.
export type SearchableOrder = {
    itemName: string;
    vendor: string;
    partNumber?: string | null;
    fundType?: FundType | null;
    stfBucketName?: string | null;
    requesterName?: string | null;
    requesterEmail?: string | null;
    status?: OrderStatus;
};

/**
 * Free-text match across the fields someone would actually type: item, vendor,
 * part number, requester and the fund or bucket it was assigned to. Every
 * whitespace-separated term has to match somewhere, so "luke rivets" narrows.
 */
export function orderMatchesQuery(order: SearchableOrder, query: string): boolean {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return true;

    const haystack = [
        order.itemName,
        order.vendor,
        order.partNumber,
        order.fundType,
        order.stfBucketName,
        order.requesterName,
        order.requesterEmail,
        order.status,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return terms.every((term) => haystack.includes(term));
}
