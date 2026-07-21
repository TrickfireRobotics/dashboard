"use server";

import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { apiKey } from "@/lib/db/schema";
import { generateApiKey } from "@/lib/security/api-key";
import { getSessionUser } from "@/lib/auth/session";

export async function createCliApiKey(): Promise<{ raw: string }> {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    const { raw, hash, prefix } = generateApiKey();
    db.insert(apiKey)
        .values({ userId: user.id, name: "CLI Access", keyHash: hash, keyPrefix: prefix })
        .run();
    return { raw };
}

export async function revokeCliApiKey(prefix: string): Promise<void> {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    db.update(apiKey)
        .set({ isRevoked: true })
        .where(and(eq(apiKey.userId, user.id), eq(apiKey.keyPrefix, prefix)))
        .run();
}

export async function listCliApiKeys() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    return db
        .select({
            prefix: apiKey.keyPrefix,
            name: apiKey.name,
            createdAt: apiKey.createdAt,
            lastUsedAt: apiKey.lastUsedAt,
        })
        .from(apiKey)
        .where(and(eq(apiKey.userId, user.id), eq(apiKey.isRevoked, false)))
        .orderBy(desc(apiKey.createdAt))
        .all();
}
