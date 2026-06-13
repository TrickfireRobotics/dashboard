const HEALTH_URL = "https://dashboard.trickfirerobotics.com/api/health";
const PING_IDS = ["388895281745231873", "703987101959454802", "917095787735941141"];

async function check(env) {
    let down = false;
    let reason = "";

    try {
        const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(10000) });
        const body = await res.text();
        if (!res.ok || !body.includes("ok")) {
            down = true;
            reason = `HTTP ${res.status} — ${body.slice(0, 200)}`;
        }
    } catch (err) {
        down = true;
        reason = err.message;
    }

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

export default {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(check(env));
    },
    async fetch(request, env, ctx) {
        await check(env);
        return new Response("ok");
    },
};
