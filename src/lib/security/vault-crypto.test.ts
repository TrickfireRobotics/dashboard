import { describe, it, expect, beforeAll } from "vitest";

// Set the key before importing the module so getVaultKey() uses it from env
// and never touches the filesystem. 32 bytes = 64 hex chars.
const TEST_KEY = "a".repeat(64);
beforeAll(() => {
    process.env.VAULT_ENCRYPTION_KEY = TEST_KEY;
});

// Dynamic import so the module loads after the env var is set above.
// Vitest hoists static imports before beforeAll, so we use dynamic import here.
const { encryptSecret, decryptSecret } = await import("./vault-crypto");

describe("encryptSecret / decryptSecret", () => {
    it("roundtrip: decrypting an encrypted value returns the original plaintext", () => {
        const original = "super-secret-password";
        const payload = encryptSecret(original);
        expect(decryptSecret(payload)).toBe(original);
    });

    it("handles a short single-character secret", () => {
        const payload = encryptSecret("x");
        expect(decryptSecret(payload)).toBe("x");
    });

    it("handles unicode and special characters", () => {
        const original = "pässwörд 🔐 <script>&";
        const payload = encryptSecret(original);
        expect(decryptSecret(payload)).toBe(original);
    });

    it("produces a different ciphertext on each call (random IV)", () => {
        const payload1 = encryptSecret("same-input");
        const payload2 = encryptSecret("same-input");
        expect(payload1).not.toBe(payload2);
    });

    it("stores the payload as three dot-separated hex segments", () => {
        const payload = encryptSecret("test");
        const segments = payload.split(".");
        expect(segments).toHaveLength(3);
        // Each segment should be non-empty hex
        for (const seg of segments) {
            expect(seg.length).toBeGreaterThan(0);
            expect(seg).toMatch(/^[0-9a-f]+$/);
        }
    });

    it("throws when the payload is malformed (missing segments)", () => {
        expect(() => decryptSecret("invalid")).toThrow("Malformed vault ciphertext");
        expect(() => decryptSecret("a.b")).toThrow("Malformed vault ciphertext");
    });

    it("throws when the ciphertext segment is tampered (auth tag mismatch)", () => {
        const payload = encryptSecret("sensitive");
        const [iv, tag, ct] = payload.split(".");
        // Flip the first byte of the ciphertext
        const tamperedCt = "ff" + ct!.slice(2);
        expect(() => decryptSecret(`${iv}.${tag}.${tamperedCt}`)).toThrow();
    });
});
