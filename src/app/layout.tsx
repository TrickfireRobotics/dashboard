import type { Metadata } from "next";
import { Barlow_Condensed, Overpass } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const barlow = Barlow_Condensed({
    variable: "--font-barlow",
    subsets: ["latin"],
    weight: ["500", "600", "700"],
});

const overpass = Overpass({
    variable: "--font-overpass",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "TrickFire Robotics Portal",
    description: "Internal club management portal for TrickFire Robotics.",
};

const isDevelopment = process.env.NODE_ENV === "development";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <body className={`${barlow.variable} ${overpass.variable} antialiased`}>
                {children}
                {isDevelopment && (
                    <div
                        className="dev-build-indicator"
                        role="status"
                        aria-label="Development build"
                    >
                        <span>Dev build</span>
                    </div>
                )}
                <Toaster richColors position="top-right" />
            </body>
        </html>
    );
}
