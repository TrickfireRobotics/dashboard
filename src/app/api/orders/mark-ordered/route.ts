import { NextResponse, type NextRequest } from "next/server";

import { markApprovedOrdersAsOrdered } from "@/lib/finance/finance";
import { getSessionUser } from "@/lib/auth/session";
import { markOrderedSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = markOrderedSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const movedCount = markApprovedOrdersAsOrdered(user.id, parsed.data.orderIds);
    return NextResponse.json({ movedCount });
}
