import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SavedGuideView } from "@/components/drafts/saved-guide-view";
import { Skeleton } from "@/components/ui/skeleton";
import { currentUser, isAdmin } from "@/lib/auth/server";
import { getGuide } from "@/lib/db";

export async function generateMetadata({ params }: PageProps<"/g/[id]">): Promise<Metadata> {
  const g = await getGuide((await params).id);
  // Drafts are private: don't put their title or verdict in link previews.
  return g && g.review.status !== "draft" ? { title: `${g.guide.app} ${g.guide.oauth_supported === false ? "connection" : "OAuth app"} · OAuth Runway`, description: g.guide.verdict } : {};
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
  const [g, user] = await Promise.all([/^[A-Za-z0-9]{6,20}$/.test(id) ? getGuide(id) : null, currentUser()]);
  if (!g) notFound();
  const isOwner = !!user && user.id === g.review.ownerId;
  const admin = isAdmin(user);
  // A draft is visible only to its author and reviewers; for everyone else it doesn't exist.
  if (g.review.status === "draft" && !isOwner && !admin) notFound();
  return <SavedGuideView payload={g} id={id} review={g.review} isOwner={isOwner} isAdmin={admin} />;
}
