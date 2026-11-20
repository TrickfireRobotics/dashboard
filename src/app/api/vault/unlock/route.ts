import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import {
    UNLOCK_COOKIE,
    UNLOCK_WINDOW_MS,
    createUnlockToken,
    getUnlockExpiry,
    unlockCookieOptions,
    verifyUserPassword,
} from "@/lib/security/vault-unlock";

const unlockSchema = z.object({ password: z.string().min(1, "Password is required").max(500) });

async function requireActiveUser() {
    const user = await getSessionUser();
    if (!user) {
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    if (user.isActive === false) {
        return { error: NextResponse.json({ error: "Account deactivated" }, { status: 403 }) };
    }
    return { user };
}

/** Current lock state, so the page can show a countdown without a reveal. */
export async function GET() {
    const auth = await requireActiveUser();
    if (auth.error) return auth.error;

    const expiresAt = await getUnlockExpiry(auth.user.id);
    return NextResponse.json(
        { unlocked: expiresAt !== null, expiresAt },
        { headers: { "Cache-Control": "no-store" } }
    );
}

export async function POST(req: NextRequest) {
    const auth = await requireActiveUser();
    if (auth.error) return auth.error;

    const limit = rateLimit(`vault-unlock:${auth.user.id}:${clientIp(req)}`, {
        capacity: 5,
        windowMs: 60_000,
    });
    if (!limit.allowed) {
        return NextResponse.json(
            { error: "Too many attempts. Wait a moment and try again." },
            { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
        );
    }

    const body = await req.json().catch(() => null);
    const parsed = unlockSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Enter your password" }, { status: 400 });
    }

    if (!(await verifyUserPassword(auth.user.id, parsed.data.password))) {
        return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    const token = createUnlockToken(auth.user.id);
    const res = NextResponse.json(
        { unlocked: true, expiresAt: token.expiresAt },
        { headers: { "Cache-Control": "no-store" } }
    );
    res.cookies.set({
        ...unlockCookieOptions,
        name: UNLOCK_COOKIE,
        value: token.value,
        maxAge: UNLOCK_WINDOW_MS / 1000,
    });
    return res;
}

/** Lock the vault again, without waiting for the window to lapse. */
export async function DELETE() {
    const auth = await requireActiveUser();
    if (auth.error) return auth.error;

    const res = NextResponse.json({ unlocked: false, expiresAt: null });
    res.cookies.set({ ...unlockCookieOptions, name: UNLOCK_COOKIE, value: "", maxAge: 0 });
    return res;
}
