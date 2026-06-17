import { describe, it, expect } from "vitest";
import { rateLimit, clientIp } from "./rate-limit";

// Each test uses a unique key so module-level LRU cache doesn't bleed between tests.
let keyCounter = 0;
function uniqueKey() {
    return `test-key-${++keyCounter}`;
}

describe("rateLimit", () => {
    it("allows the first request", () => {
        const result = rateLimit(uniqueKey());
        expect(result.allowed).toBe(true);
        expect(result.retryAfter).toBe(0);
    });

    it("allows up to 30 requests on a fresh key", () => {
        const key = uniqueKey();
        for (let i = 0; i < 30; i++) {
            expect(rateLimit(key).allowed).toBe(true);
        }
    });

    it("blocks the 31st request and returns a positive retryAfter", () => {
        const key = uniqueKey();
        for (let i = 0; i < 30; i++) rateLimit(key);
        const result = rateLimit(key);
        expect(result.allowed).toBe(false);
        expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("tracks buckets independently per key", () => {
        const keyA = uniqueKey();
        const keyB = uniqueKey();
        for (let i = 0; i < 30; i++) rateLimit(keyA);
        // Exhausting keyA does not affect keyB
        expect(rateLimit(keyA).allowed).toBe(false);
        expect(rateLimit(keyB).allowed).toBe(true);
    });
});

describe("clientIp", () => {
    it("reads from x-forwarded-for", () => {
        const req = new Request("http://localhost", {
            headers: { "x-forwarded-for": "1.2.3.4" },
        });
        expect(clientIp(req)).toBe("1.2.3.4");
    });

    it("uses the first IP when x-forwarded-for contains a chain", () => {
        const req = new Request("http://localhost", {
            headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" },
        });
        expect(clientIp(req)).toBe("1.2.3.4");
    });

    it("falls back to cf-connecting-ip when x-forwarded-for is absent", () => {
        const req = new Request("http://localhost", {
            headers: { "cf-connecting-ip": "203.0.113.1" },
        });
        expect(clientIp(req)).toBe("203.0.113.1");
    });

    it("returns unknown when no IP headers are present", () => {
        const req = new Request("http://localhost");
        expect(clientIp(req)).toBe("unknown");
    });
});
