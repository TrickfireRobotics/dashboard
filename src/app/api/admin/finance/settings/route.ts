import { NextResponse, type NextRequest } from "next/server";

import { getOrderPricingSettings, updateOrderPricingSettings } from "@/lib/finance/finance";
import { displayPercentToBps, percentBpsToDisplay } from "@/lib/finance/order-pricing";
import { getSessionUser } from "@/lib/auth/session";
import { financeSettingsUpdateSchema } from "@/lib/validation";

export async function PATCH(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = financeSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    updateOrderPricingSettings({
        taxPercentBps: displayPercentToBps(parsed.data.taxPercent),
        shippingPercentBps: displayPercentToBps(parsed.data.shippingPercent),
    });

    const settings = getOrderPricingSettings();
    return NextResponse.json({
        taxPercent: percentBpsToDisplay(settings.taxPercentBps),
        shippingPercent: percentBpsToDisplay(settings.shippingPercentBps),
    });
}
