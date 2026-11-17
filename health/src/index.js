const HEALTH_URL = "https://dashboard.trickfirerobotics.com/api/health";
const PING_ROLE_ID = "1572069686278098986";
const MAINTENANCE_KV_KEY = "maintenance_until";

async function ping() {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(10000) });
    const body = await res.text();
    if (!res.ok || !body.includes("ok")) {
        return `HTTP ${res.status} - ${body.slice(0, 200)}`;
    }
    return null;
}

async function check(env) {
    let reason = null;

    try {
        reason = await ping();
    } catch (err) {
        reason = err.message;
    }

    // retry once after 5 seconds before alerting
    if (reason !== null) {
        await new Promise((r) => setTimeout(r, 5000));
        try {
            reason = await ping();
        } catch (err) {
            reason = err.message;
        }
    }

    let down = reason !== null;

    if (down && env.MONITOR_KV) {
        const until = await env.MONITOR_KV.get(MAINTENANCE_KV_KEY);
        if (until && Date.now() < Number(until)) {
            down = false;
        }
    }

    if (down) {
        const timestamp = new Date().toISOString();

        await fetch(env.DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content: `<@&${PING_ROLE_ID}>`,
                allowed_mentions: { roles: [PING_ROLE_ID] },
                embeds: [
                    {
                        title: "Dashboard is down",
                        color: 0xe53935,
                        fields: [
                            { name: "URL", value: HEALTH_URL, inline: false },
                            { name: "Reason", value: `\`${reason}\``, inline: false },
                            { name: "Time (UTC)", value: timestamp, inline: false },
                        ],
                        footer: { text: "TrickFire Dashboard Monitor" },
                        timestamp,
                    },
                ],
            }),
        });
    }
}

// Called by the Discord bot's /dashboard maintenance command, which owns
// the actual Discord-facing interaction. This just records the window.
async function handleSetMaintenance(request, env) {
    const auth = request.headers.get("Authorization");
    if (!env.DASHBOARD_TOKEN || auth !== `Bearer ${env.DASHBOARD_TOKEN}`) {
        return new Response("unauthorized", { status: 401 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response("invalid json", { status: 400 });
    }

    const minutes = Number(body?.minutes);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) {
        return new Response("minutes must be between 0 and 1440", { status: 400 });
    }

    if (minutes === 0) {
        await env.MONITOR_KV.delete(MAINTENANCE_KV_KEY);
        return Response.json({ ok: true, until: null });
    }

    const until = Date.now() + minutes * 60_000;
    await env.MONITOR_KV.put(MAINTENANCE_KV_KEY, String(until), {
        expirationTtl: minutes * 60 + 60,
    });

    return Response.json({ ok: true, until });
}

const worker = {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(check(env));
    },
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        if (request.method === "POST" && url.pathname === "/maintenance") {
            return handleSetMaintenance(request, env);
        }
        await check(env);
        return new Response("ok");
    },
};

export default worker;
