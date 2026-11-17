const { DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_BOT_TOKEN || !DISCORD_APPLICATION_ID || !DISCORD_GUILD_ID) {
    console.error("Set DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, and DISCORD_GUILD_ID first.");
    process.exit(1);
}

const commands = [
    {
        name: "ping",
        description: "Check that the dashboard health monitor itself is responding",
        type: 1,
    },
    {
        name: "test",
        description: "Send a test alert to verify formatting and the role ping",
        type: 1,
    },
    {
        name: "maintenance",
        description: "Pause downtime alerts for a maintenance window",
        type: 1,
        options: [
            {
                name: "minutes",
                description: "How long to pause alerts for, in minutes (default 60)",
                type: 4,
                required: false,
                min_value: 1,
                max_value: 1440,
            },
        ],
    },
];

const res = await fetch(
    `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/guilds/${DISCORD_GUILD_ID}/commands`,
    {
        method: "PUT",
        headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(commands),
    }
);

if (!res.ok) {
    console.error(`Discord API error: ${res.status} ${await res.text()}`);
    process.exit(1);
}

const registered = await res.json();
console.log("Commands registered:", registered.map((c) => c.name).join(", "));
