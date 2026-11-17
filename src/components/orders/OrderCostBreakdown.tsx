import {
    computeOrderPricingBreakdown,
    percentBpsToDisplay,
    type OrderPricingSettings,
} from "@/lib/finance/order-pricing";
import { formatPriceCents } from "@/lib/utils";

export function OrderCostBreakdown({
    quantity,
    unitCostCents,
    pricingSettings,
    totalLabel = "Total cost",
}: {
    quantity: number;
    unitCostCents: number;
    pricingSettings: OrderPricingSettings;
    totalLabel?: string;
}) {
    const breakdown = computeOrderPricingBreakdown(quantity, unitCostCents, pricingSettings);

    return (
        <div className="col-span-2 space-y-1 rounded-md border p-3 text-sm">
            <Line
                label={`Subtotal (${quantity} × ${formatPriceCents(unitCostCents)})`}
                value={formatPriceCents(breakdown.subtotalCents)}
            />
            <Line
                label={`Tax (${percentBpsToDisplay(pricingSettings.taxPercentBps)}%)`}
                value={formatPriceCents(breakdown.taxCents)}
            />
            <Line
                label={`Shipping / buffer (${percentBpsToDisplay(pricingSettings.shippingPercentBps)}%)`}
                value={formatPriceCents(breakdown.shippingCents)}
            />
            <div className="text-foreground flex items-center justify-between border-t pt-1 font-medium">
                <span>{totalLabel}</span>
                <span>{formatPriceCents(breakdown.totalCents)}</span>
            </div>
        </div>
    );
}

function Line({ label, value }: { label: string; value: string }) {
    return (
        <div className="text-muted-foreground flex items-center justify-between">
            <span>{label}</span>
            <span>{value}</span>
        </div>
    );
}
