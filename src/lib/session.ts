import { headers } from "next/headers";

import { auth } from "./auth";

export type SessionUser = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["user"];

export async function getSessionUser(): Promise<SessionUser | null> {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user ?? null;
}

// Admins always have vault access; members need the explicit grant.
export function canUseVault(user: Pick<SessionUser, "role" | "canAccessVault">): boolean {
    return user.role === "admin" || user.canAccessVault === true;
}
