import { describe, it, expect } from "vitest";
import { orderTotalCents } from "./finance";

describe("orderTotalCents", () => {
    it("multiplies quantity by unit cost in cents", () => {
        expect(orderTotalCents(2, 5000)).toBe(10000);
        expect(orderTotalCents(1, 9999)).toBe(9999);
        expect(orderTotalCents(10, 100)).toBe(1000);
    });

    it("returns 0 when quantity is 0", () => {
        expect(orderTotalCents(0, 5000)).toBe(0);
    });

    it("returns 0 when unit cost is 0", () => {
        expect(orderTotalCents(5, 0)).toBe(0);
    });

    it("handles large quantities and costs without overflow", () => {
        // 9999 units × $9999.99 ceiling — should not produce NaN or Infinity
        const result = orderTotalCents(9999, 999999);
        expect(Number.isFinite(result)).toBe(true);
        expect(result).toBe(9999 * 999999);
    });
});
