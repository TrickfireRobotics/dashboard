import type { NextRequest } from "next/server";

import {
    getDashboardLogBuffer,
    getRecentLogs,
    subscribeDashboardLogs,
    subscribeServerLogTail,
    type LogEvent,
} from "@/lib/integrations/azalea";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const admin = await getSessionUser();
    if (!admin) return new Response("Unauthorized", { status: 401 });

    const encoder = new TextEncoder();

    function encodeEvent(event: LogEvent) {
        return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
    }

    const stream = new ReadableStream({
        start(controller) {
            let closed = false;

            // Send recent server log lines first, then any buffered dashboard messages.
            for (const line of getRecentLogs()) {
                controller.enqueue(encodeEvent({ type: "line", line }));
            }
            for (const line of getDashboardLogBuffer()) {
                controller.enqueue(encodeEvent({ type: "line", line }));
            }

            const unsubServer = subscribeServerLogTail((event) => {
                if (closed) return;
                try {
                    controller.enqueue(encodeEvent(event));
                } catch {
                    closed = true;
                }
            });

            const unsubDashboard = subscribeDashboardLogs((event) => {
                if (closed) return;
                try {
                    controller.enqueue(encodeEvent(event));
                } catch {
                    closed = true;
                }
            });

            const heartbeat = setInterval(() => {
                if (closed) {
                    clearInterval(heartbeat);
                    return;
                }
                try {
                    controller.enqueue(encoder.encode(": ping\n\n"));
                } catch {
                    closed = true;
                    unsubServer();
                    unsubDashboard();
                    clearInterval(heartbeat);
                }
            }, 15_000);

            req.signal.addEventListener("abort", () => {
                closed = true;
                unsubServer();
                unsubDashboard();
                clearInterval(heartbeat);
                try {
                    controller.close();
                } catch {}
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
