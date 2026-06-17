import { createHash, randomBytes } from "crypto";

export function hashApiKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
    const raw = `tf_${randomBytes(32).toString("hex")}`;
    return { raw, hash: hashApiKey(raw), prefix: raw.slice(0, 8) };
}
