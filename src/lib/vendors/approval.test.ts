import { describe, expect, it } from "vitest";

import { approvalFor, isApproved } from "./approval";

describe("isApproved", () => {
    it("approves only Active", () => {
        expect(isApproved("Active")).toBe(true);
        expect(isApproved("Inactive")).toBe(false);
        expect(isApproved("Hold")).toBe(false);
        expect(isApproved("Unknown")).toBe(false);
    });
});

describe("approvalFor", () => {
    it("flags an Active vendor as approved", () => {
        expect(approvalFor({ status: "Active" })).toEqual({
            approved: true,
            status: "Active",
            label: "Approved",
        });
    });

    it("flags Inactive, Hold, and Unknown as out of scope", () => {
        for (const status of ["Inactive", "Hold", "Unknown"] as const) {
            expect(approvalFor({ status })).toEqual({
                approved: false,
                status,
                label: "Out of scope",
            });
        }
    });

    it("treats a vendor not in the list as out of scope", () => {
        expect(approvalFor(null)).toEqual({
            approved: false,
            status: "NotFound",
            label: "Out of scope",
        });
    });
});
