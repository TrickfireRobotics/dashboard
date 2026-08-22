import { MilestonePoster } from "@/components/milestones/MilestonePoster";
import { getMilestoneStats } from "@/lib/stats/milestones";

// Stats are computed from the repo working tree (git log, source files) which
// only exist during `next build`, not in the trimmed `standalone` runtime -
// see the comment in lib/stats/milestones.ts. Force static generation so this
// always renders once at build time instead of per-request in production.
export const dynamic = "force-static";

export default async function MilestonesPage() {
    const stats = await getMilestoneStats();
    return <MilestonePoster stats={stats} />;
}
