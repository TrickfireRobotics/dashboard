import { describe, it, expect } from "vitest";

import {
    computeOrderTotalCents,
    DEFAULT_ORDER_PRICING,
    displayPercentToBps,
    percentBpsToDisplay,
} from "./order-pricing";

describe("computeOrderTotalCents", () => {
    it("adds tax and shipping percentages to the subtotal", () => {
        expect(computeOrderTotalCents(2, 5000, DEFAULT_ORDER_PRICING)).toBe(13_100);
    });

    it("returns subtotal when tax and shipping are zero", () => {
        expect(computeOrderTotalCents(2, 5000, { taxPercentBps: 0, shippingPercentBps: 0 })).toBe(
            10_000
        );
    });

    it("returns 0 when quantity is 0", () => {
        expect(computeOrderTotalCents(0, 5000)).toBe(0);
    });
});

describe("percent conversions", () => {
    it("converts between display percent and basis points", () => {
        expect(displayPercentToBps(11)).toBe(1100);
        expect(percentBpsToDisplay(1100)).toBe(11);
    });

    it("supports zero and full-percent basis point values", () => {
        expect(displayPercentToBps(0)).toBe(0);
        expect(displayPercentToBps(100)).toBe(10_000);
    });
});
