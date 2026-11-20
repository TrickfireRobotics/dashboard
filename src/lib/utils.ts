import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatPriceCents(cents: number | null | undefined): string {
    if (cents == null) return "-";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(cents / 100);
}

export function formatDate(value: Date | number | null | undefined): string {
    if (value == null) return "-";
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

/** Short "3m ago" / "2d ago" style stamp, for last-seen style columns. */
export function formatRelativeTime(value: string | Date | null | undefined): string {
    if (value == null) return "-";
    const ms = Date.now() - (value instanceof Date ? value.getTime() : Date.parse(value));
    if (Number.isNaN(ms)) return "-";
    const s = Math.floor(ms / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}
