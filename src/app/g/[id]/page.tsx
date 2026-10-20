import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SavedGuideView } from "@/components/drafts/saved-guide-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getGuide } from "@/lib/db";

export async function generateMetadata({ params }: PageProps<"/g/[id]">): Promise<Metadata> {
  const g = await getGuide((await params).id);
  return g ? { title: `${g.guide.app} OAuth app · OAuth Runway`, description: g.guide.verdict } : {};
}

// `params` is read inside Suspense so the shell renders instantly.
export default function Page({ params }: PageProps<"/g/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading guide">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      }
    >
      <Saved params={params} />
    </Suspense>
  );
}

async function Saved({ params }: { params: PageProps<"/g/[id]">["params"] }) {
  const { id } = await params;
  const g = /^[A-Za-z0-9]{6,20}$/.test(id) ? await getGuide(id) : null;
  if (!g) notFound();
  return <SavedGuideView payload={g} id={id} />;
}
