"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
    return String(n).padStart(2, "0");
}

export function LiveClock() {
    const [now, setNow] = useState<Date | null>(null);

    useEffect(() => {
        const tick = () => setNow(new Date());
        tick();
        const id = setInterval(tick, 1_000);
        return () => clearInterval(id);
    }, []);

    if (!now) {
        return (
            <div className="text-right">
                <p className="font-heading text-3xl text-white tabular-nums">--:--:--</p>
                <p className="text-muted-foreground text-sm">&nbsp;</p>
            </div>
        );
    }

    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const date = now.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
    });

    return (
        <div className="text-right">
            <p className="font-heading text-3xl text-white tabular-nums">{time}</p>
            <p className="text-muted-foreground text-sm">{date}</p>
        </div>
    );
}
