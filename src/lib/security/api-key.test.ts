import { describe, it, expect } from "vitest";
import { hashApiKey, generateApiKey } from "./api-key";

describe("hashApiKey", () => {
    it("returns a 64-character hex string (SHA-256)", () => {
        const hash = hashApiKey("some-key");
        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it("is deterministic - same input always produces the same hash", () => {
        expect(hashApiKey("test")).toBe(hashApiKey("test"));
        expect(hashApiKey("tf_abc123")).toBe(hashApiKey("tf_abc123"));
    });

    it("produces different hashes for different inputs", () => {
        expect(hashApiKey("key-a")).not.toBe(hashApiKey("key-b"));
    });
});

describe("generateApiKey", () => {
    it("returns a key starting with 'tf_'", () => {
        const { raw } = generateApiKey();
        expect(raw).toMatch(/^tf_/);
    });

    it("returns a prefix that is the first 8 characters of the raw key", () => {
        const { raw, prefix } = generateApiKey();
        expect(prefix).toBe(raw.slice(0, 8));
        expect(prefix).toHaveLength(8);
    });

    it("returns a hash that matches hashApiKey(raw)", () => {
        const { raw, hash } = generateApiKey();
        expect(hash).toBe(hashApiKey(raw));
    });

    it("generates unique keys on each call", () => {
        const a = generateApiKey();
        const b = generateApiKey();
        expect(a.raw).not.toBe(b.raw);
        expect(a.hash).not.toBe(b.hash);
    });
});
