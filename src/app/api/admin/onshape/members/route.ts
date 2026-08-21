import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { addOnshapeMember, getOnshapeMembers, OnshapeError } from "@/lib/integrations/onshape";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const members = await getOnshapeMembers();
        // null means Onshape isn't configured; an empty company is `[]`.
        return NextResponse.json({ members: members ?? [] });
    } catch (err) {
        const status = err instanceof OnshapeError ? 502 : 500;
        const message = err instanceof Error ? err.message : "Failed to load members";
        return NextResponse.json({ error: message }, { status });
    }
}

const addMemberSchema = z.object({
    email: z.string().email(),
    admin: z.boolean().optional(),
    guest: z.boolean().optional(),
    light: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { email, ...opts } = parsed.data;
    try {
        await addOnshapeMember(email, opts);
        return NextResponse.json({ success: true }, { status: 201 });
    } catch (err) {
        const status = err instanceof OnshapeError ? 502 : 500;
        const message = err instanceof Error ? err.message : "Failed to add member";
        return NextResponse.json({ error: message }, { status });
    }
}
