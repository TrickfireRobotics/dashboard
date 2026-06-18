import { describe, it, expect } from "vitest";

import {
    computeOrderTotalCents,
    DEFAULT_ORDER_PRICING,
    displayPercentToBps,
    orderChargeCents,
    percentBpsToDisplay,
    stfOrderTotalCents,
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

describe("stfOrderTotalCents", () => {
    it("applies flux before tax and shipping", () => {
        expect(stfOrderTotalCents(2, 5000, DEFAULT_ORDER_PRICING)).toBe(15_720);
    });
});

describe("orderChargeCents", () => {
    it("uses the gift formula for gift orders", () => {
        expect(orderChargeCents("Gift", 2, 5000, DEFAULT_ORDER_PRICING)).toBe(13_100);
    });

    it("uses the STF formula for STF orders", () => {
        expect(orderChargeCents("STF", 2, 5000, DEFAULT_ORDER_PRICING)).toBe(15_720);
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
