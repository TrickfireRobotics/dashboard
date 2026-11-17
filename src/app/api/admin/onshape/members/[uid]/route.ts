import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
    OnshapeError,
    removeOnshapeMember,
    updateOnshapeMemberRole,
} from "@/lib/integrations/onshape";
import { getSessionUser } from "@/lib/auth/session";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { uid } = await params;
    try {
        await removeOnshapeMember(uid);
        return NextResponse.json({ success: true });
    } catch (err) {
        const status = err instanceof OnshapeError ? 502 : 500;
        const message = err instanceof Error ? err.message : "Failed to remove member";
        return NextResponse.json({ error: message }, { status });
    }
}

const updateRoleSchema = z.object({
    email: z.string().email(),
    admin: z.boolean(),
    guest: z.boolean(),
    light: z.boolean(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { uid } = await params;
    const body = await req.json().catch(() => null);
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { email, ...opts } = parsed.data;
    try {
        await updateOnshapeMemberRole(uid, email, opts);
        return NextResponse.json({ success: true });
    } catch (err) {
        const status = err instanceof OnshapeError ? 502 : 500;
        const message = err instanceof Error ? err.message : "Failed to update member role";
        return NextResponse.json({ error: message }, { status });
    }
}
