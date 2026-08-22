const HEALTH_URL = "https://dashboard.trickfirerobotics.com/api/health";
const PING_IDS = ["388895281745231873", "703987101959454802", "917095787735941141"];

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

    if (down) {
        const pings = PING_IDS.map((id) => `<@${id}>`).join(" ");
        const timestamp = new Date().toISOString();

        await fetch(env.DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content: pings,
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

const worker = {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(check(env));
    },
    async fetch(request, env) {
        await check(env);
        return new Response("ok");
    },
};

export default worker;
