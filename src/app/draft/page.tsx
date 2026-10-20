import { Suspense } from "react";

import { DraftView } from "@/components/drafts/draft-view";
import { Skeleton } from "@/components/ui/skeleton";

export default function DraftPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading draft">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      }
    >
      <DraftView />
    </Suspense>
  );
}
