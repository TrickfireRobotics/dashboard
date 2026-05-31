import { NextResponse, type NextRequest } from "next/server";

import { generateApiKey, hashApiKey, keyPrefix } from "@/lib/api-key";
import { db } from "@/lib/db";
import { apiKey } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { createApiKeySchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createApiKeySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const raw = generateApiKey();
    const created = db
        .insert(apiKey)
        .values({
            userId: user.id,
            name: parsed.data.name,
            keyHash: hashApiKey(raw),
            keyPrefix: keyPrefix(raw),
        })
        .returning({ id: apiKey.id, name: apiKey.name })
        .get();

    // Raw key is returned exactly once; only the hash is persisted.
    return NextResponse.json(
        { id: created.id, name: created.name, key: raw },
        {
            status: 201,
        }
    );
}
