import { useEffect } from "react";

/** Run `poll` on an interval; first run is deferred to avoid setState-in-effect lint. */
export function usePoll(poll: () => void | Promise<void>, intervalMs?: number) {
    useEffect(() => {
        const initial = setTimeout(() => {
            void poll();
        }, 0);
        const id =
            intervalMs == null
                ? undefined
                : setInterval(() => {
                      void poll();
                  }, intervalMs);

        return () => {
            clearTimeout(initial);
            if (id != null) clearInterval(id);
        };
    }, [poll, intervalMs]);
}
