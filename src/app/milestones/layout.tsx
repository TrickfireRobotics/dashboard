import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    weight: ["400", "500", "700", "800"],
});

export const metadata: Metadata = {
    title: "Milestones | TrickFire Robotics",
    robots: { index: false, follow: false },
};

export default function MilestonesLayout({ children }: { children: React.ReactNode }) {
    return <div className={`${jetbrainsMono.className} h-full`}>{children}</div>;
}
