import { NextResponse, type NextRequest } from "next/server";

import { createHeadscaleApiKey, getHeadscaleApiKeys } from "@/lib/headscale";
import { getSessionUser } from "@/lib/session";
import { z } from "zod";

const createKeySchema = z.object({
    expiration: z.string().datetime({ message: "Must be an ISO 8601 date-time string" }),
});

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const data = await getHeadscaleApiKeys();
    if (!data) return NextResponse.json({ apiKeys: [] });

    return NextResponse.json({ apiKeys: data.apiKeys ?? [] });
}

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = createKeySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const data = await createHeadscaleApiKey(parsed.data.expiration);
    if (!data) return NextResponse.json({ error: "Failed to create API key" }, { status: 502 });

    return NextResponse.json(data, { status: 201 });
}
