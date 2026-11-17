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

export type OrderPricingBreakdown = {
    subtotalCents: number;
    taxCents: number;
    shippingCents: number;
    totalCents: number;
};

export function computeOrderPricingBreakdown(
    quantity: number,
    unitCostCents: number,
    settings: OrderPricingSettings = DEFAULT_ORDER_PRICING
): OrderPricingBreakdown {
    const subtotalCents = orderSubtotalCents(quantity, unitCostCents);
    const taxCents = Math.round((subtotalCents * settings.taxPercentBps) / 10_000);
    const shippingCents = Math.round((subtotalCents * settings.shippingPercentBps) / 10_000);
    return {
        subtotalCents,
        taxCents,
        shippingCents,
        totalCents: subtotalCents + taxCents + shippingCents,
    };
}

export function computeOrderTotalCents(
    quantity: number,
    unitCostCents: number,
    settings: OrderPricingSettings = DEFAULT_ORDER_PRICING
): number {
    return computeOrderPricingBreakdown(quantity, unitCostCents, settings).totalCents;
}
