import { NextResponse, type NextRequest } from "next/server";

import { adjustGiftFund, ensureGiftFundRow } from "@/lib/finance/finance";
import { getSessionUser } from "@/lib/auth/session";
import { giftFundAdjustSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = giftFundAdjustSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    ensureGiftFundRow();
    const newValueCents = adjustGiftFund(
        Math.round(parsed.data.newValue * 100),
        user.id,
        parsed.data.note ?? null
    );

    return NextResponse.json({ currentValueCents: newValueCents });
}
