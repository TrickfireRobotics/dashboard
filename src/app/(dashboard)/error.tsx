"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div>
        <h1 className="text-3xl">Something went wrong</h1>
        <p className="text-muted-foreground">
          An unexpected error occurred while loading this page.
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
