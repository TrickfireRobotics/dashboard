import { describe, it, expect, beforeAll } from "vitest";

import {
    accessCodeDay,
    accessCodeForDay,
    currentAccessCode,
    isValidAccessCode,
    nextRotation,
} from "./access-code";

beforeAll(() => {
    process.env.SIM_ACCESS_CODE_SECRET = "test-secret";
});

describe("accessCodeDay", () => {
    it("uses the club timezone, not UTC", () => {
        // 2026-10-20T03:00Z is still the 19th in Los Angeles
        expect(accessCodeDay(new Date("2026-10-20T03:00:00Z"))).toBe("2026-10-19");
    });
});

describe("accessCodeForDay", () => {
    it("returns six digits", () => {
        expect(accessCodeForDay("2026-10-19")).toMatch(/^\d{6}$/);
    });

    it("is stable for the same day", () => {
        expect(accessCodeForDay("2026-10-19")).toBe(accessCodeForDay("2026-10-19"));
    });

    it("differs between days", () => {
        expect(accessCodeForDay("2026-10-19")).not.toBe(accessCodeForDay("2026-10-20"));
    });

    it("depends on the secret", () => {
        const before = accessCodeForDay("2026-10-19");
        process.env.SIM_ACCESS_CODE_SECRET = "other-secret";
        const after = accessCodeForDay("2026-10-19");
        process.env.SIM_ACCESS_CODE_SECRET = "test-secret";
        expect(after).not.toBe(before);
    });
});

describe("isValidAccessCode", () => {
    const at = new Date("2026-10-19T18:00:00Z");

    it("accepts today's code", () => {
        expect(isValidAccessCode(currentAccessCode(at), at)).toBe(true);
    });

    it("ignores separators and whitespace", () => {
        const code = currentAccessCode(at);
        expect(isValidAccessCode(` ${code.slice(0, 3)}-${code.slice(3)} `, at)).toBe(true);
    });

    it("rejects yesterday's code", () => {
        const yesterday = accessCodeForDay("2026-10-18");
        expect(isValidAccessCode(yesterday, at)).toBe(false);
    });

    it("rejects wrong lengths without throwing", () => {
        expect(isValidAccessCode("", at)).toBe(false);
        expect(isValidAccessCode("12345", at)).toBe(false);
        expect(isValidAccessCode("1234567", at)).toBe(false);
    });
});

describe("nextRotation", () => {
    it("lands on the next local midnight", () => {
        const at = new Date("2026-10-19T18:00:00Z");
        const next = nextRotation(at);
        expect(accessCodeDay(next)).toBe("2026-10-20");
        expect(accessCodeDay(new Date(next.getTime() - 1000))).toBe("2026-10-19");
    });

    it("handles the 25-hour DST fall-back day", () => {
        // Nov 1 2026 runs 00:00 PDT to 00:00 PST, so midnight is 25h out
        const next = nextRotation(new Date("2026-11-01T12:00:00Z"));
        expect(next.toISOString()).toBe("2026-11-02T08:00:00.000Z");
    });
});
