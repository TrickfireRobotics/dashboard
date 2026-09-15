import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { searchVendors } from "@/lib/vendors/lookup";

const MAX_LIMIT = 25;

export async function GET(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    const limitParam = Number(searchParams.get("limit"));
    const limit =
        Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : 10;

    const results = searchVendors(q, limit);
    return NextResponse.json({ results });
}
