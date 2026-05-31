import { NextResponse, type NextRequest } from "next/server";

import { disableHeadscaleRoute, enableHeadscaleRoute, getHeadscaleRoutes } from "@/lib/headscale";
import { getSessionUser } from "@/lib/session";
import { z } from "zod";

const routeActionSchema = z.object({ action: z.enum(["enable", "disable"]), id: z.string() });

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const data = await getHeadscaleRoutes();
    if (!data) return NextResponse.json({ routes: [] });

    return NextResponse.json({ routes: data.routes ?? [] });
}

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = routeActionSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const ok =
        parsed.data.action === "enable"
            ? await enableHeadscaleRoute(parsed.data.id)
            : await disableHeadscaleRoute(parsed.data.id);

    if (!ok) return NextResponse.json({ error: "Action failed" }, { status: 502 });

    return NextResponse.json({ success: true });
}
