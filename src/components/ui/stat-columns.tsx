import { cn } from "@/lib/utils";

/** Divided label/number columns, as used on the right of a section header. */
export function StatColumns({
    stats,
    className,
}: {
    stats: { label: string; value: string }[];
    className?: string;
}) {
    if (stats.length === 0) return null;
    return (
        <dl className={cn("divide-border flex shrink-0 divide-x", className)}>
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
    );
}
