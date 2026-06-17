import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const imgSrc = [
    "'self'",
    "data:",
    "https://mc-heads.net",
    "https://s.namemc.com",
    "https://textures.minecraft.net",
].join(" ");

const isDev = process.env.NODE_ENV === "development";

const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "connect-src 'self' https://cloudflareinsights.com",
    "font-src 'self'",
    "frame-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
]
    .join("; ")
    .trim();

const securityHeaders = [
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Content-Security-Policy", value: csp },
];

const pl3xmapHeaders = [
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
    output: "standalone",
    serverExternalPackages: ["better-sqlite3", "systeminformation"],
    async headers() {
        return [
            {
                source: "/((?!pl3xmap).*)",
                headers: securityHeaders,
            },
            {
                source: "/pl3xmap/:path*",
                headers: pl3xmapHeaders,
            },
        ];
    },
};

export default withSentryConfig(nextConfig, {
    org: "trickfire-robotics",
    project: "dashboard",
    silent: !process.env.CI,
    widenClientFileUpload: true,
    tunnelRoute: "/api/intake",

    webpack: {
        treeshake: {
            removeDebugLogging: true,
        },
    },
});
