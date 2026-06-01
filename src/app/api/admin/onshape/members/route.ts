import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { addOnshapeMember, getOnshapeMembers } from "@/lib/onshape";
import { getSessionUser } from "@/lib/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const members = await getOnshapeMembers();
    if (!members) return NextResponse.json({ members: [] });

    return NextResponse.json({ members });
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
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { email, ...opts } = parsed.data;
    const ok = await addOnshapeMember(email, opts);
    if (!ok) return NextResponse.json({ error: "Failed to add member" }, { status: 502 });

    return NextResponse.json({ success: true }, { status: 201 });
}
