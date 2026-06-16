import { describe, it, expect } from "vitest";
import { formatPriceCents, formatDate } from "./utils";

describe("formatPriceCents", () => {
    it("formats typical cents as USD", () => {
        expect(formatPriceCents(1050)).toBe("$10.50");
        expect(formatPriceCents(100)).toBe("$1.00");
        expect(formatPriceCents(1)).toBe("$0.01");
    });

    it("formats zero", () => {
        expect(formatPriceCents(0)).toBe("$0.00");
    });

    it("formats large amounts with commas", () => {
        expect(formatPriceCents(100000)).toBe("$1,000.00");
        expect(formatPriceCents(1000000)).toBe("$10,000.00");
    });

    it("returns dash for null", () => {
        expect(formatPriceCents(null)).toBe("-");
    });

    it("returns dash for undefined", () => {
        expect(formatPriceCents(undefined)).toBe("-");
    });
});

describe("formatDate", () => {
    it("returns dash for null", () => {
        expect(formatDate(null)).toBe("-");
    });

    it("returns dash for undefined", () => {
        expect(formatDate(undefined)).toBe("-");
    });

    it("formats a Date object and includes the year", () => {
        const date = new Date("2024-06-15T12:00:00Z");
        const result = formatDate(date);
        expect(result).toContain("2024");
    });

    it("accepts a unix timestamp in milliseconds", () => {
        // Use a mid-day UTC time so timezone offsets don't push the date into the adjacent year
        const ts = new Date("2025-06-15T12:00:00Z").getTime();
        const result = formatDate(ts);
        expect(result).toContain("2025");
    });

    it("produces the same output for a Date and its equivalent timestamp", () => {
        const date = new Date("2025-03-01T10:00:00Z");
        expect(formatDate(date)).toBe(formatDate(date.getTime()));
    });
});
