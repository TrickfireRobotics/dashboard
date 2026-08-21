export const STF_PRICE_FLUX = 1.2;

export const DEFAULT_TAX_PERCENT_BPS = 1100;
export const DEFAULT_SHIPPING_PERCENT_BPS = 2000;

export type OrderPricingSettings = {
    taxPercentBps: number;
    shippingPercentBps: number;
};

export const DEFAULT_ORDER_PRICING: OrderPricingSettings = {
    taxPercentBps: DEFAULT_TAX_PERCENT_BPS,
    shippingPercentBps: DEFAULT_SHIPPING_PERCENT_BPS,
};

export function percentBpsToDisplay(percentBps: number): number {
    return percentBps / 100;
}

export function displayPercentToBps(percent: number): number {
    return Math.round(percent * 100);
}

export function orderSubtotalCents(quantity: number, unitCostCents: number): number {
    return quantity * unitCostCents;
}

export function computeOrderTotalCents(
    quantity: number,
    unitCostCents: number,
    settings: OrderPricingSettings = DEFAULT_ORDER_PRICING
): number {
    const subtotal = orderSubtotalCents(quantity, unitCostCents);
    const tax = Math.round((subtotal * settings.taxPercentBps) / 10_000);
    const shipping = Math.round((subtotal * settings.shippingPercentBps) / 10_000);
    return subtotal + tax + shipping;
}

export function stfOrderTotalCents(
    quantity: number,
    unitCostCents: number,
    settings: OrderPricingSettings = DEFAULT_ORDER_PRICING
): number {
    const preTaxTotal = Math.round(orderSubtotalCents(quantity, unitCostCents) * STF_PRICE_FLUX);
    const tax = Math.round((preTaxTotal * settings.taxPercentBps) / 10_000);
    const shipping = Math.round((preTaxTotal * settings.shippingPercentBps) / 10_000);
    return preTaxTotal + tax + shipping;
}

// An untriaged order has no fund type yet. It is costed without the STF price
// flux, so the figure shown before assignment is an estimate, not a charge.
export function orderChargeCents(
    fundType: "STF" | "Gift" | null,
    quantity: number,
    unitCostCents: number,
    settings: OrderPricingSettings = DEFAULT_ORDER_PRICING
): number {
    if (fundType === "STF") {
        return stfOrderTotalCents(quantity, unitCostCents, settings);
    }
    return computeOrderTotalCents(quantity, unitCostCents, settings);
}
