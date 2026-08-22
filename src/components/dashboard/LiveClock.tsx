"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
    return String(n).padStart(2, "0");
}

export function LiveClock() {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1_000);
        return () => clearInterval(id);
    }, []);

    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const date = now.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
    });

    return (
        <div className="text-left sm:text-right">
            <p suppressHydrationWarning className="font-heading text-3xl text-white tabular-nums">
                {time}
            </p>
            <p suppressHydrationWarning className="text-muted-foreground text-sm">
                {date}
            </p>
        </div>
    );
}
