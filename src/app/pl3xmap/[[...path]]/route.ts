import type { NextRequest } from "next/server";

const UPSTREAM =
    process.env.PL3XMAP_URL ?? `http://${process.env.MINECRAFT_SERVER_HOST ?? "localhost"}:8080`;

// Leaflet's zoom/layer/coordinate controls clutter the embedded card view.
const STYLE_OVERRIDES = "<style>.leaflet-control-container{display:none!important}</style>";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path?: string[] }> }
) {
    const { path } = await params;
    const subpath = path?.length ? "/" + path.join("/") : "/";
    const url = new URL(request.url);
    const embed = url.searchParams.get("embed") === "1";
    url.searchParams.delete("embed");
    const search = url.search;

    try {
        const res = await fetch(`${UPSTREAM}${subpath}${search}`, {
            headers: { "accept-encoding": "identity" },
            signal: AbortSignal.timeout(8_000),
        });

        const contentType = res.headers.get("content-type") ?? "application/octet-stream";

        // Rewrite HTML responses so Pl3xMap's SPA resolves asset/API paths
        // relative to /pl3xmap/ rather than the server root.
        if (contentType.includes("text/html")) {
            let html = await res.text();

            if (html.includes("<base ")) {
                html = html.replace(/<base\s+href="[^"]*"/gi, '<base href="/pl3xmap/"');
            } else {
                html = html.replace("<head>", '<head><base href="/pl3xmap/">');
            }

            if (embed) {
                html = html.replace("<head>", `<head>${STYLE_OVERRIDES}`);
            }

            return new Response(html, {
                status: res.status,
                headers: { "content-type": "text/html; charset=utf-8" },
            });
        }

        return new Response(res.body, {
            status: res.status,
            headers: { "content-type": contentType },
        });
    } catch {
        return new Response(null, { status: 503 });
    }
}
