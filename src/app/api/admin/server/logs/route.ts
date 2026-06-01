import type { NextRequest } from "next/server";

import {
    getLogBuffer,
    getRecentCapturedLogs,
    hasProcessHandle,
    subscribeCapturedLogTail,
    subscribeLogs,
    type LogEvent,
} from "@/lib/azalea";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const admin = await getSessionUser();
    if (!admin) return new Response("Unauthorized", { status: 401 });
    if (admin.role !== "admin") return new Response("Forbidden", { status: 403 });

    const encoder = new TextEncoder();

    function encodeEvent(event: LogEvent) {
        return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
    }

    const stream = new ReadableStream({
        start(controller) {
            let closed = false;

            const buf = getLogBuffer();
            const initial = buf.length > 0 ? buf : getRecentCapturedLogs();
            for (const line of initial) {
                controller.enqueue(encodeEvent({ type: "line", line }));
            }

            const unsub = subscribeLogs((event) => {
                if (closed) return;
                try {
                    controller.enqueue(encodeEvent(event));
                } catch {
                    closed = true;
                }
            });

            // When this request is served by a different process than the one that started azalea,
            // follow the dashboard capture file for live lines.
            const unsubTail = hasProcessHandle()
                ? () => {}
                : subscribeCapturedLogTail((event) => {
                      if (closed) return;
                      try {
                          controller.enqueue(encodeEvent(event));
                      } catch {
                          closed = true;
                      }
                  });

            // Heartbeat keeps the TCP connection alive and detects a dropped client.
            const heartbeat = setInterval(() => {
                if (closed) {
                    clearInterval(heartbeat);
                    return;
                }
                try {
                    controller.enqueue(encoder.encode(": ping\n\n"));
                } catch {
                    closed = true;
                    unsub();
                    unsubTail();
                    clearInterval(heartbeat);
                }
            }, 15_000);

            req.signal.addEventListener("abort", () => {
                closed = true;
                unsub();
                unsubTail();
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
