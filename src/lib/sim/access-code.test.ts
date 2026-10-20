import { describe, it, expect, beforeEach } from "vitest";

import { db } from "@/lib/db";
import { simAccessCode, user } from "@/lib/db/schema";
import {
    formatRotationTime,
    getAccessCode,
    isValidAccessCode,
    nextRotation,
    rotateAccessCode,
} from "./access-code";

const ROTATOR = "access-code-test-user";

beforeEach(() => {
    db.delete(simAccessCode).run();
    db.insert(user)
        .values({
            id: ROTATOR,
            name: "Access Code Tester",
            email: "access-code-tester@example.com",
            updatedAt: new Date(),
        })
        .onConflictDoNothing()
        .run();
});

describe("nextRotation", () => {
    it("lands on 3am Pacific later the same day", () => {
        // 2026-10-19T08:00Z is 01:00 PDT
        expect(nextRotation(new Date("2026-10-19T08:00:00Z")).toISOString()).toBe(
            "2026-10-19T10:00:00.000Z"
        );
    });

    it("rolls to the next day when 3am has passed", () => {
        // 2026-10-19T18:00Z is 11:00 PDT, so the next 3am is tomorrow
        expect(nextRotation(new Date("2026-10-19T18:00:00Z")).toISOString()).toBe(
            "2026-10-20T10:00:00.000Z"
        );
    });

    it("still picks 3am across the spring-forward weekend", () => {
        // DST starts 2026-03-08, clocks jump 02:00 PST to 03:00 PDT
        const next = nextRotation(new Date("2026-03-08T06:00:00Z"));
        expect(next.toISOString()).toBe("2026-03-08T10:00:00.000Z");
        expect(formatRotationTime(next)).toContain("3:00 AM PDT");
    });

    it("still picks 3am across the fall-back weekend", () => {
        const next = nextRotation(new Date("2026-11-01T06:00:00Z"));
        expect(formatRotationTime(next)).toContain("3:00 AM PST");
    });
});

describe("getAccessCode", () => {
    it("issues a six digit code on first read", () => {
        expect(getAccessCode().code).toMatch(/^\d{6}$/);
    });

    it("returns the same code until it is due to rotate", () => {
        const first = getAccessCode();
        expect(getAccessCode().code).toBe(first.code);
    });

    it("rotates on read once 3am has passed", () => {
        const before = new Date("2026-10-19T18:00:00Z");
        const first = getAccessCode(before);
        expect(first.rotatesAt.toISOString()).toBe("2026-10-20T10:00:00.000Z");

        const after = getAccessCode(new Date("2026-10-20T15:00:00Z"));
        expect(after.rotatesAt.toISOString()).toBe("2026-10-21T10:00:00.000Z");
        // 1 in a million chance of a false failure, acceptable for this check
        expect(after.code).not.toBe(first.code);
    });

    it("catches up after the server was down through several rotations", () => {
        getAccessCode(new Date("2026-10-19T18:00:00Z"));
        const late = getAccessCode(new Date("2026-10-25T18:00:00Z"));
        expect(late.rotatesAt.toISOString()).toBe("2026-10-26T10:00:00.000Z");
    });
});

describe("rotateAccessCode", () => {
    it("replaces the current code immediately", () => {
        const before = getAccessCode();
        const after = rotateAccessCode(ROTATOR);
        expect(after.code).not.toBe(before.code);
        expect(getAccessCode().code).toBe(after.code);
    });

    it("keeps the usual 3am rotation time", () => {
        const rotated = rotateAccessCode(null, new Date("2026-10-19T18:00:00Z"));
        expect(rotated.rotatesAt.toISOString()).toBe("2026-10-20T10:00:00.000Z");
    });

    it("records who rotated it", () => {
        rotateAccessCode(ROTATOR);
        expect(db.select().from(simAccessCode).get()?.rotatedBy).toBe(ROTATOR);
    });
});

describe("isValidAccessCode", () => {
    it("accepts the current code", () => {
        expect(isValidAccessCode(getAccessCode().code)).toBe(true);
    });

    it("ignores separators and whitespace", () => {
        const code = getAccessCode().code;
        expect(isValidAccessCode(` ${code.slice(0, 3)}-${code.slice(3)} `)).toBe(true);
    });

    it("rejects a code that was just rotated away", () => {
        const stale = getAccessCode().code;
        rotateAccessCode(ROTATOR);
        expect(isValidAccessCode(stale)).toBe(false);
    });

    it("rejects wrong lengths without throwing", () => {
        expect(isValidAccessCode("")).toBe(false);
        expect(isValidAccessCode("12345")).toBe(false);
        expect(isValidAccessCode("1234567")).toBe(false);
    });
});
