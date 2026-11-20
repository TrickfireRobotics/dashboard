"use client";

import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Shared furniture for the Team page. The dashboard, Onshape and GitHub panels
 * all do the same job - add people, change what they can do, group them into
 * teams - so they are built from the same pieces instead of each inventing a
 * layout.
 */

export function ProviderHeader({
    icon: Icon,
    title,
    href,
    subtitle,
    stats,
    note,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    href?: string;
    subtitle?: ReactNode;
    stats?: { label: string; value: string }[];
    note?: ReactNode;
}) {
    return (
        <div className="border-border bg-card overflow-hidden rounded-lg border">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                        <Icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                        <p className="font-heading flex items-center gap-1.5 text-base font-medium">
                            {href ? (
                                <a
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 hover:underline"
                                >
                                    {title}
                                    <ExternalLink className="text-muted-foreground size-3.5" />
                                </a>
                            ) : (
                                title
                            )}
                        </p>
                        {subtitle ? (
                            <p className="text-muted-foreground truncate text-sm">{subtitle}</p>
                        ) : null}
                    </div>
                </div>

                {stats && stats.length > 0 ? (
                    <dl className="divide-border flex shrink-0 divide-x">
                        {stats.map((stat) => (
                            <div key={stat.label} className="px-4 first:pl-0 last:pr-0">
                                <dt className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                                    {stat.label}
                                </dt>
                                <dd className="mt-0.5 text-xl leading-none font-semibold tabular-nums">
                                    {stat.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                ) : null}
            </div>

            {note ? (
                <p className="border-border bg-muted/20 text-muted-foreground border-t px-5 py-2.5 text-xs">
                    {note}
                </p>
            ) : null}
        </div>
    );
}

/** The "add someone" strip that sits above every people table. */
export function AddPersonBar({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
    return (
        <div className="border-border bg-card space-y-2 rounded-lg border p-4">
            <div className="flex flex-wrap items-end gap-3">{children}</div>
            {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
        </div>
    );
}

/** Two-panel sub-navigation, identical across the three providers. */
export function SubTabs({
    value,
    onValueChange,
    tabs,
    children,
}: {
    value: string;
    onValueChange: (value: string) => void;
    tabs: {
        value: string;
        label: string;
        icon?: React.ComponentType<{ className?: string }>;
        badge?: number;
    }[];
    children: ReactNode;
}) {
    return (
        <Tabs value={value} onValueChange={(next) => onValueChange(next as string)}>
            <TabsList className="bg-muted/60 h-9 w-full sm:w-fit">
                <TabsIndicator className="bg-background shadow-sm" />
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <TabsTrigger key={tab.value} value={tab.value} className="sm:px-4">
                            {Icon ? <Icon className="size-4" /> : null}
                            {tab.label}
                            {tab.badge ? (
                                <span className="bg-primary/15 text-primary ml-1 rounded-full px-1.5 text-[10px] font-bold tabular-nums">
                                    {tab.badge}
                                </span>
                            ) : null}
                        </TabsTrigger>
                    );
                })}
            </TabsList>
            {children}
        </Tabs>
    );
}

export function SubTabPanel({ value, children }: { value: string; children: ReactNode }) {
    return (
        <TabsContent value={value} className="space-y-4 pt-4">
            {children}
        </TabsContent>
    );
}

/** Role / status dropdown, styled the same wherever a level can be changed. */
export function LevelSelect<T extends string>({
    value,
    options,
    onChange,
    disabled,
    tone = "default",
    className,
}: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
    disabled?: boolean;
    tone?: "default" | "elevated" | "muted" | "danger";
    className?: string;
}) {
    const toneClass =
        tone === "elevated"
            ? "border-primary/30 bg-primary/10 text-primary font-medium"
            : tone === "danger"
              ? "border-destructive/30 bg-destructive/10 text-destructive font-medium"
              : tone === "muted"
                ? "bg-muted-foreground/10"
                : "";

    return (
        <Select
            items={options}
            value={value}
            disabled={disabled}
            onValueChange={(v) => onChange(v as T)}
        >
            <SelectTrigger size="sm" className={`w-36 ${toneClass} ${className ?? ""}`}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

/** Skeleton / error / empty wrapper so every panel reports state the same way. */
export function LoadState({
    loading,
    error,
    empty,
    emptyLabel,
    rows = 3,
    children,
}: {
    loading: boolean;
    error?: string | null;
    empty?: boolean;
    emptyLabel?: string;
    rows?: number;
    children: ReactNode;
}) {
    if (loading) {
        return (
            <div className="space-y-3">
                {[...Array(rows)].map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                ))}
            </div>
        );
    }
    if (error) {
        return (
            <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-4 text-sm">
                {error}
            </p>
        );
    }
    if (empty) {
        return (
            <p className="border-border text-muted-foreground rounded-lg border p-10 text-center text-sm">
                {emptyLabel ?? "Nothing here yet."}
            </p>
        );
    }
    return <>{children}</>;
}

export type TeamGroup = {
    key: string;
    name: string;
    description?: string | null;
    href?: string;
};

/**
 * Teams browser: pick a group on the left, see its people on the right. Both
 * integrations render their member rows into `detail`.
 */
export function TeamsBrowser({
    groups,
    loading,
    error,
    selectedKey,
    onSelect,
    detail,
    emptyLabel = "No teams found.",
}: {
    groups: TeamGroup[];
    loading: boolean;
    error?: string | null;
    selectedKey: string | null;
    onSelect: (group: TeamGroup) => void;
    detail: ReactNode;
    emptyLabel?: string;
}) {
    return (
        <LoadState
            loading={loading}
            error={error}
            empty={groups.length === 0}
            emptyLabel={emptyLabel}
            rows={2}
        >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
                <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border">
                    {groups.map((group) => {
                        const active = group.key === selectedKey;
                        return (
                            <li key={group.key}>
                                <button
                                    type="button"
                                    onClick={() => onSelect(group)}
                                    aria-current={active}
                                    className={`w-full px-4 py-3 text-left transition-colors ${
                                        active
                                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                            : "hover:bg-muted/50"
                                    }`}
                                >
                                    <p className="truncate text-sm font-medium">{group.name}</p>
                                    {group.description ? (
                                        <p className="text-muted-foreground truncate text-xs">
                                            {group.description}
                                        </p>
                                    ) : null}
                                </button>
                            </li>
                        );
                    })}
                </ul>
                <div className="border-border min-h-48 rounded-lg border">{detail}</div>
            </div>
        </LoadState>
    );
}

/** Placeholder for the teams browser's right-hand pane. */
export function TeamsBrowserHint({ children }: { children: ReactNode }) {
    return (
        <p className="text-muted-foreground flex h-full min-h-48 items-center justify-center p-6 text-center text-sm">
            {children}
        </p>
    );
}

export function RemoveButton({
    onClick,
    disabled,
    label = "Remove",
}: {
    onClick: () => void;
    disabled?: boolean;
    label?: string;
}) {
    return (
        <Button size="sm" variant="destructive" disabled={disabled} onClick={onClick}>
            {label}
        </Button>
    );
}
