import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

// Symmetric encryption for vault secrets. Unlike the service-API keys in
// `api-key.ts` (one-way SHA-256 hashes), vault entries must be shown back to
// the user, so they are encrypted at rest with AES-256-GCM and decrypted on
// demand.

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // standard GCM nonce length

// Dev-only fallback so the app runs out of the box. The key is persisted (not
// regenerated each launch) so secrets stay decryptable across restarts.
const DEV_KEY_PATH = (process.env.DATABASE_PATH ?? "db/dashboard.db").replace(
    /[^/\\]*$/,
    "vault.key"
);

let cachedKey: Buffer | null = null;

function loadOrCreateDevKey(): Buffer {
    if (existsSync(DEV_KEY_PATH)) {
        return Buffer.from(readFileSync(DEV_KEY_PATH, "utf8").trim(), "hex");
    }
    const key = randomBytes(KEY_BYTES);
    const dir = dirname(DEV_KEY_PATH);
    if (dir && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(DEV_KEY_PATH, key.toString("hex"), { flag: "w" });
    console.warn(
        `[vault] VAULT_ENCRYPTION_KEY not set - generated a dev key at ${DEV_KEY_PATH}. ` +
            `This is for local development only; set VAULT_ENCRYPTION_KEY in production.`
    );
    return key;
}

function getVaultKey(): Buffer {
    if (cachedKey) return cachedKey;

    const fromEnv = process.env.VAULT_ENCRYPTION_KEY?.trim();
    if (fromEnv) {
        const key = Buffer.from(fromEnv, "hex");
        if (key.length !== KEY_BYTES) {
            throw new Error(
                `VAULT_ENCRYPTION_KEY must be ${KEY_BYTES} bytes (${KEY_BYTES * 2} hex chars). ` +
                    `Generate one with: openssl rand -hex ${KEY_BYTES}`
            );
        }
        cachedKey = key;
        return key;
    }

    if (process.env.NODE_ENV === "production") {
        throw new Error(
            "VAULT_ENCRYPTION_KEY is required in production. Generate one with: " +
                `openssl rand -hex ${KEY_BYTES}`
        );
    }

    cachedKey = loadOrCreateDevKey();
    return cachedKey;
}

// Returns `ivHex.tagHex.ciphertextHex` so the whole thing fits in one column.
export function encryptSecret(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, getVaultKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}.${tag.toString("hex")}.${ciphertext.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
    const [ivHex, tagHex, ctHex] = payload.split(".");
    if (!ivHex || !tagHex || !ctHex) {
        throw new Error("Malformed vault ciphertext");
    }
    const decipher = createDecipheriv(ALGORITHM, getVaultKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(ctHex, "hex")), decipher.final()]).toString(
        "utf8"
    );
}
