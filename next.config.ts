import type { NextConfig } from "next";

const imgSrc = [
    "'self'",
    "data:",
    "https://mc-heads.net",
    "https://s.namemc.com",
    "https://textures.minecraft.net",
].join(" ");

const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "connect-src 'self'",
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

const nextConfig: NextConfig = {
    output: "standalone",
    serverExternalPackages: ["better-sqlite3"],
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: securityHeaders,
            },
        ];
    },
};

export default nextConfig;
