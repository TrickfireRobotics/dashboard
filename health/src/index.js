const HEALTH_URL = "https://dashboard.trickfirerobotics.com/api/health";
const PING_ROLE_ID = "1572069686278098986";
const ALERT_CHANNEL_ID = "1221527423724818482";
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

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

async function verifyDiscordSignature(request, rawBody, publicKeyHex) {
    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");
    if (!signature || !timestamp || !publicKeyHex) return false;

    const key = await crypto.subtle.importKey(
        "raw",
        hexToBytes(publicKeyHex),
        { name: "Ed25519" },
        false,
        ["verify"]
    );

    return crypto.subtle.verify(
        "Ed25519",
        key,
        hexToBytes(signature),
        new TextEncoder().encode(timestamp + rawBody)
    );
}

function testAlertPayload() {
    const timestamp = new Date().toISOString();
    return {
        content: `<@&${PING_ROLE_ID}>`,
        allowed_mentions: { roles: [PING_ROLE_ID] },
        embeds: [
            {
                title: "[TEST] Dashboard is down",
                color: 0xe53935,
                fields: [
                    { name: "URL", value: HEALTH_URL, inline: false },
                    {
                        name: "Reason",
                        value: "`this is a test alert, triggered by /test`",
                        inline: false,
                    },
                    { name: "Time (UTC)", value: timestamp, inline: false },
                ],
                footer: { text: "TrickFire Dashboard Monitor" },
                timestamp,
            },
        ],
    };
}

async function sendPingFollowup(interaction) {
    const start = Date.now();
    let reason = null;
    try {
        reason = await ping();
    } catch (err) {
        reason = err.message;
    }
    const elapsed = Date.now() - start;

    const content =
        reason === null
            ? `Health checker is fine. Dashboard responded ok in ${elapsed}ms.`
            : `Health checker ran, but the dashboard looks unhealthy: \`${reason}\` (${elapsed}ms)`;

    await fetch(
        `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
        }
    );
}

async function handleMaintenance(interaction, env) {
    const minutesOption = interaction.data.options?.find((o) => o.name === "minutes");
    const minutes = minutesOption ? minutesOption.value : 60;
    const until = Date.now() + minutes * 60_000;

    await env.MONITOR_KV.put(MAINTENANCE_KV_KEY, String(until), {
        expirationTtl: minutes * 60 + 60,
    });

    const untilTag = `<t:${Math.floor(until / 1000)}:f>`;
    return Response.json({
        type: 4,
        data: {
            content: `Alerts paused for ${minutes} minute${minutes === 1 ? "" : "s"}, until ${untilTag}.`,
        },
    });
}

async function handleCommand(interaction, env, ctx) {
    if (interaction.channel_id !== ALERT_CHANNEL_ID) {
        return Response.json({
            type: 4,
            data: {
                content: `This command can only be used in <#${ALERT_CHANNEL_ID}>.`,
                flags: 64, // ephemeral
            },
        });
    }

    switch (interaction.data.name) {
        case "ping":
            // the dashboard health check can be slow, so defer and follow up
            ctx.waitUntil(sendPingFollowup(interaction));
            return Response.json({ type: 5 });
        case "test":
            return Response.json({ type: 4, data: testAlertPayload() });
        case "maintenance":
            return handleMaintenance(interaction, env);
        default:
            return new Response("unknown command", { status: 400 });
    }
}

async function handleInteraction(request, env, ctx) {
    const rawBody = await request.text();
    const valid = await verifyDiscordSignature(request, rawBody, env.DISCORD_PUBLIC_KEY);
    if (!valid) {
        return new Response("invalid signature", { status: 401 });
    }

    const interaction = JSON.parse(rawBody);

    if (interaction.type === 1) {
        return Response.json({ type: 1 });
    }

    if (interaction.type === 2) {
        return handleCommand(interaction, env, ctx);
    }

    return new Response("unhandled interaction type", { status: 400 });
}

const worker = {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(check(env));
    },
    async fetch(request, env, ctx) {
        if (request.method === "POST" && request.headers.has("X-Signature-Ed25519")) {
            return handleInteraction(request, env, ctx);
        }
        await check(env);
        return new Response("ok");
    },
};

export default worker;
