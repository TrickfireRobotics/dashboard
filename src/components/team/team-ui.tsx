"use client";

import { ExternalLink, Search } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    href?: string;
    subtitle?: ReactNode;
    stats?: { label: string; value: string }[];
}) {
    return (
        <div className="border-border bg-card flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-lg border px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
                <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                    <p className="text-lg leading-snug font-semibold">
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
    );
}

/**
 * One table in a card, with a header holding whatever switcher or title the
 * panel needs on the left and its search box on the right.
 */
export function TableCard({
    left,
    search,
    onSearchChange,
    searchPlaceholder = "Search",
    children,
}: {
    left: ReactNode;
    search: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;
    children: ReactNode;
}) {
    return (
        <div className="border-border bg-card overflow-hidden rounded-lg border">
            <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2.5">
                {left}
                <div className="relative ml-auto">
                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                    <Input
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={searchPlaceholder}
                        aria-label={searchPlaceholder}
                        className="h-9 w-40 pl-8 sm:w-56"
                    />
                </div>
            </div>
            {children}
        </div>
    );
}

/** Title for a table card that has no switcher to show instead. */
export function TableCardTitle({ title, count }: { title: string; count?: number }) {
    return (
        <p className="flex items-center gap-2 pl-1 text-sm font-semibold">
            {title}
            {count === undefined ? null : (
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
                    {count}
                </span>
            )}
        </p>
    );
}

/**
 * People / Teams switcher. Lives inside a {@link TableCard} header, so it is
 * rendered on its own - the surrounding `Tabs` root owns the state.
 */
export function SubTabsList({ tabs }: { tabs: { value: string; label: string }[] }) {
    return (
        <TabsList className="bg-muted/60 h-9">
            <TabsIndicator className="bg-background shadow-sm" />
            {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="px-4">
                    {tab.label}
                </TabsTrigger>
            ))}
        </TabsList>
    );
}

/** The "add someone" strip at the top of a people table. */
export function AddPersonBar({ children }: { children: ReactNode }) {
    return (
        <div className="border-border bg-muted/20 flex flex-wrap items-end gap-3 border-b px-4 py-3">
            {children}
        </div>
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
            <div className="space-y-3 p-4">
                {[...Array(rows)].map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                ))}
            </div>
        );
    }
    if (error) {
        return <p className="text-destructive p-6 text-center text-sm">{error}</p>;
    }
    if (empty) {
        return (
            <p className="text-muted-foreground p-10 text-center text-sm">
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
            <div className="grid lg:grid-cols-[minmax(0,18rem)_1fr]">
                <ul className="divide-border border-border divide-y lg:border-r">
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
                <div className="min-h-48">{detail}</div>
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
