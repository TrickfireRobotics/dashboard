import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

import { auth } from "@/lib/auth/auth";

/**
 * Short-lived vault unlock.
 *
 * Dashboard sessions last for weeks, so an open tab is no proof that the person
 * sitting in front of it is the account owner. Reading a secret therefore needs
 * a fresh password check, which mints the signed cookie below. The cookie is
 * bound to one user id and expires on its own; the server checks it on every
 * reveal, so the lock is not just a UI state.
 */

export const UNLOCK_COOKIE = "vault_unlock";
export const UNLOCK_WINDOW_MS = 10 * 60 * 1000;

function signingSecret(): string {
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) {
        throw new Error("BETTER_AUTH_SECRET is required to sign vault unlock cookies");
    }
    return secret;
}

function sign(payload: string): string {
    return createHmac("sha256", signingSecret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
}

export function createUnlockToken(
    userId: string,
    now = Date.now()
): { value: string; expiresAt: number } {
    const expiresAt = now + UNLOCK_WINDOW_MS;
    const payload = `${userId}.${expiresAt}`;
    return { value: `${payload}.${sign(payload)}`, expiresAt };
}

/** Returns the unlock's expiry, or null when the token is absent/stale/forged. */
export function readUnlockToken(
    token: string | undefined,
    userId: string,
    now = Date.now()
): number | null {
    if (!token) return null;
    const [tokenUserId, expiresAtRaw, signature] = token.split(".");
    if (!tokenUserId || !expiresAtRaw || !signature) return null;
    if (tokenUserId !== userId) return null;

    const expiresAt = Number(expiresAtRaw);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
    if (!safeEqual(signature, sign(`${tokenUserId}.${expiresAtRaw}`))) return null;

    return expiresAt;
}

/** Expiry of the current request's unlock for `userId`, or null if locked. */
export async function getUnlockExpiry(userId: string): Promise<number | null> {
    const jar = await cookies();
    return readUnlockToken(jar.get(UNLOCK_COOKIE)?.value, userId);
}

export const unlockCookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
} as const;

/** Verify a password against the account's stored credential hash. */
export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
    const ctx = await auth.$context;
    const accounts = await ctx.internalAdapter.findAccounts(userId);
    const credential = accounts?.find((account) => account.providerId === "credential");
    if (!credential?.password) return false;
    return ctx.password.verify({ hash: credential.password, password });
}
