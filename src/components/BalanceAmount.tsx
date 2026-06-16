import { cn, formatPriceCents } from "@/lib/utils";

export function isOverBudget(cents: number): boolean {
    return cents < 0;
}

export function remainingBalanceLabel(cents: number): string {
    if (isOverBudget(cents)) {
        return `Over by ${formatPriceCents(Math.abs(cents))}`;
    }
    return `${formatPriceCents(cents)} remaining`;
}

export function stfBucketSelectLabel(name: string, cents: number): string {
    if (isOverBudget(cents)) {
        return `${name} — Over by ${formatPriceCents(Math.abs(cents))} (unavailable)`;
    }
    if (cents === 0) {
        return `${name} — No funds remaining`;
    }
    return `${name} — ${formatPriceCents(cents)} remaining`;
}

type StfBucketSelectItemContentProps = {
    name: string;
    cents: number;
    unavailable?: boolean;
};

export function StfBucketSelectItemContent({
    name,
    cents,
    unavailable = false,
}: StfBucketSelectItemContentProps) {
    const over = isOverBudget(cents);
    const empty = cents === 0;

    return (
        <span
            className={cn(
                "flex w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5",
                unavailable && over && "text-destructive"
            )}
        >
            <span className={cn(unavailable && over && "font-medium")}>{name}</span>
            <span
                className={cn(
                    unavailable && over ? "text-destructive/70" : "text-muted-foreground"
                )}
            >
                —
            </span>
            {over ? (
                <span className={cn(unavailable && "font-semibold")}>
                    Over by {formatPriceCents(Math.abs(cents))}
                    {unavailable ? " · unavailable" : ""}
                </span>
            ) : empty ? (
                <span className="text-muted-foreground">No funds remaining</span>
            ) : (
                <span>{formatPriceCents(cents)} remaining</span>
            )}
        </span>
    );
}

const sizeClasses = {
    sm: "text-sm font-medium",
    md: "text-base font-semibold",
    lg: "text-lg font-semibold",
} as const;

type BalanceAmountProps = {
    cents: number;
    className?: string;
    size?: keyof typeof sizeClasses;
    /** Show "remaining" / "over by" wording instead of a signed currency value. */
    mode?: "remaining" | "signed";
};

export function BalanceAmount({
    cents,
    className,
    size = "md",
    mode = "remaining",
}: BalanceAmountProps) {
    const over = isOverBudget(cents);
    const label = mode === "remaining" ? remainingBalanceLabel(cents) : formatPriceCents(cents);

    return (
        <span
            className={cn(
                sizeClasses[size],
                over ? "text-destructive" : "text-foreground",
                className
            )}
        >
            {label}
        </span>
    );
}

type RemainingBalanceCaptionProps = {
    cents: number;
    className?: string;
};

export function RemainingBalanceCaption({ cents, className }: RemainingBalanceCaptionProps) {
    const over = isOverBudget(cents);

    return (
        <p
            className={cn(
                "text-xs",
                over ? "text-destructive/90" : "text-muted-foreground",
                className
            )}
        >
            {over ? "Over budget this school year" : "remaining this school year"}
        </p>
    );
}
