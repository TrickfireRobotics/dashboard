import { createHash, randomBytes } from "node:crypto";

const PREFIX = "tfr_";

// Produces `tfr_` + 43 base64url chars = 47 chars total.
export function generateApiKey(): string {
  return `${PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Stored alongside the hash so members can recognise a key in the list.
export function keyPrefix(key: string): string {
  return key.slice(0, 12);
}
