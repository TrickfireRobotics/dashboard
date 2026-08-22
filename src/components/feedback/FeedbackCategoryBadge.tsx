import { Bug, Lightbulb, MessageCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { FeedbackCategory } from "@/lib/db/schema";

export const FEEDBACK_CATEGORY_META: Record<
    FeedbackCategory,
    {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
        icon: React.ComponentType<{ className?: string }>;
    }
> = {
    bug: { label: "Bug", variant: "destructive", icon: Bug },
    idea: { label: "Idea", variant: "default", icon: Lightbulb },
    other: { label: "Other", variant: "outline", icon: MessageCircle },
};

export function FeedbackCategoryBadge({ category }: { category: FeedbackCategory }) {
    const { label, variant, icon: Icon } = FEEDBACK_CATEGORY_META[category];
    return (
        <Badge variant={variant}>
            <Icon />
            {label}
        </Badge>
    );
}
