import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { GuideView } from "@/components/guide/guide-view";
import { Skeleton } from "@/components/ui/skeleton";
import { CATALOG, GUIDES, getGuide } from "@/lib/guides";
import { resolveLogo } from "@/lib/logos";
import { findToolkit, toolkitBySlug } from "@/lib/toolkits";

export function generateStaticParams() {
  return Object.keys(GUIDES).map((key) => ({ key }));
}

export async function generateMetadata({ params }: PageProps<"/guides/[key]">): Promise<Metadata> {
  const g = getGuide((await params).key);
  return g ? { title: `${g.app} OAuth app · OAuth Runway`, description: g.verdict } : {};
}

// `params` is read inside Suspense so navigation can show the skeleton shell instantly.
export default function Page({ params }: PageProps<"/guides/[key]">) {
  return (
    <Suspense fallback={<GuideSkeleton />}>
      <Guide params={params} />
    </Suspense>
  );
}

async function Guide({ params }: { params: PageProps<"/guides/[key]">["params"] }) {
  const g = getGuide((await params).key);
  if (!g) notFound();
  const entry = CATALOG.find((c) => c.key === g.key) ?? g;
  const toolkit = toolkitBySlug(g.composio) ?? findToolkit(g.app);
  return <GuideView guide={g} logo={await resolveLogo(entry)} toolkit={toolkit} />;
}

/** Same blocks as GuideView: breadcrumb, header, difficulty + clocks, tabs. */
function GuideSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading guide">
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-4/5 max-w-2xl" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl md:col-span-2" />
      </div>
      <Skeleton className="h-9 w-96 max-w-full" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
