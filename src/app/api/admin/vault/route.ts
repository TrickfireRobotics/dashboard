import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { vaultEntry } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/security/vault-crypto";
import { vaultEntrySchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = vaultEntrySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const d = parsed.data;
    const created = db
        .insert(vaultEntry)
        .values({
            name: d.name,
            type: d.type,
            description: d.description ?? null,
            username: d.type === "login" ? d.username : null,
            secret: encryptSecret(d.secret),
            createdBy: user.id,
        })
        .returning({ id: vaultEntry.id })
        .get();

    return NextResponse.json({ id: created.id }, { status: 201 });
}
