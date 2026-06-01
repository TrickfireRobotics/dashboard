export const FEATURES = {
    orders: {
        label: "Parts Orders",
        description: "Submit and track parts orders for your team.",
        route: "/orders",
    },
    "api-keys": {
        label: "API Keys",
        description: "Manage API keys for service integrations.",
        route: "/api-keys",
    },
    minecraft: {
        label: "Minecraft Server",
        description: "Access the TrickFire Minecraft server and whitelist.",
        route: "/minecraft",
    },
    headscale: {
        label: "Headscale VPN",
        description: "Connect devices to the team VPN network.",
        route: "/headscale",
    },
} as const;

export type FeatureKey = keyof typeof FEATURES;

export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

export const FEATURE_ROUTES: Record<string, FeatureKey> = {
    "/orders": "orders",
    "/api-keys": "api-keys",
    "/minecraft": "minecraft",
    "/headscale": "headscale",
};
