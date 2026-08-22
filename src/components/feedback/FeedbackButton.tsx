"use client";

import { MessageSquareHeart } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedbackFeed, type FeedbackRow } from "./FeedbackFeed";
import { FeedbackForm } from "./FeedbackForm";

export function FeedbackButton() {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState("share");
    const [rows, setRows] = useState<FeedbackRow[]>([]);
    const [loading, setLoading] = useState(false);

    const loadFeed = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/feedback", { cache: "no-store" });
            if (res.ok) {
                const data = (await res.json()) as { feedback: FeedbackRow[] };
                setRows(data.feedback);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) loadFeed();
    }, [open, loadFeed]);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Share feedback"
                        className="group/feedback relative"
                    />
                }
            >
                <span className="from-primary/60 to-secondary/60 absolute inset-0.5 -z-10 rounded-full bg-linear-to-br opacity-0 blur-[6px] transition-opacity duration-300 group-hover/feedback:animate-pulse group-hover/feedback:opacity-100" />
                <MessageSquareHeart className="size-4.5 transition-transform duration-300 ease-out group-hover/feedback:scale-110 group-hover/feedback:-rotate-12" />
            </SheetTrigger>
            <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
                <SheetHeader className="border-border border-b">
                    <SheetTitle>Feedback</SheetTitle>
                    <SheetDescription>Suggestions and feedback. Well read it.</SheetDescription>
                </SheetHeader>
                <Tabs
                    value={tab}
                    onValueChange={(value) => setTab(value as string)}
                    className="flex flex-1 flex-col overflow-hidden px-4 pt-3"
                >
                    <TabsList className="w-full">
                        <TabsTrigger value="share" className="flex-1">
                            Share
                        </TabsTrigger>
                        <TabsTrigger value="feed" className="flex-1">
                            Feed{rows.length > 0 ? ` (${rows.length})` : ""}
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="share" className="overflow-y-auto py-4">
                        <FeedbackForm
                            onSubmitted={() => {
                                void loadFeed();
                                setTab("feed");
                            }}
                        />
                    </TabsContent>
                    <TabsContent value="feed" className="overflow-y-auto py-4">
                        <FeedbackFeed rows={rows} loading={loading} onChanged={loadFeed} />
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
