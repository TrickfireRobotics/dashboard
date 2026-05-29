import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPriceCents(cents: number | null | undefined): string {
  if (cents == null) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

export function formatDate(value: Date | number | null | undefined): string {
  if (value == null) return "—"
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}
