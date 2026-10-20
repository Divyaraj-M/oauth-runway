"use client";

import { FileQuestionIcon, Share2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { GuideView } from "@/components/guide/guide-view";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { Draft } from "@/lib/agent-client";
import { removeDraft, saveDraft, useDrafts } from "@/lib/drafts";
import { decodeDraft, shareUrl } from "@/lib/share";

const subscribeHash = (l: () => void) => {
  window.addEventListener("hashchange", l);
  return () => window.removeEventListener("hashchange", l);
};

/**
 * A generated guide: either one of this browser's saved drafts (`?app=<slug>`) or one shared by link (`#share=…`,
 * the whole guide compressed into the URL fragment).
 */
export function DraftView() {
  const slug = useSearchParams().get("app") ?? "";
  const hash = useSyncExternalStore(subscribeHash, () => location.hash, () => "");
  const shareCode = hash.startsWith("#share=") ? hash.slice(7) : "";
  const drafts = useDrafts();
  const router = useRouter();
  const [shared, setShared] = useState<{ code: string; draft: Draft | null } | null>(null);

  useEffect(() => {
    if (!shareCode) return;
    let live = true;
    decodeDraft(shareCode).then((draft) => live && setShared({ code: shareCode, draft }));
    return () => {
      live = false;
    };
  }, [shareCode]);

  const copyShare = async (d: Draft) => {
    try {
      await navigator.clipboard.writeText(await shareUrl(d));
      toast("Share link copied", { description: "Anyone with the link sees this draft. It isn't stored on a server." });
    } catch {
      toast("Copy was blocked here. Use Copy as Markdown instead.");
    }
  };

  if (shareCode) {
    if (shared?.code !== shareCode)
      return (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Opening shared guide">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      );
    const d = shared.draft;
    if (!d) return <Missing title="This share link is broken" text="The link may have been cut off when it was copied. Ask for it again, or generate the guide yourself." />;
    return (
      <div className="flex flex-col gap-6">
        <Alert className="enter">
          <Share2Icon />
          <AlertTitle>Shared with you</AlertTitle>
          <AlertDescription>An AI-researched draft someone generated. Save it to keep it in your list.</AlertDescription>
          <AlertAction>
            <Button
              size="sm"
              onClick={() => {
                const s = saveDraft(d);
                toast(`${d.guide.app} saved to your drafts`);
                router.replace(`/draft?app=${encodeURIComponent(s)}`);
              }}
            >
              Save to my drafts
            </Button>
          </AlertAction>
        </Alert>
        <GuideView guide={d.guide} logo={d.logo} research={d.research} onShare={() => copyShare(d)} />
      </div>
    );
  }

  const d = drafts[slug];
  if (!d?.guide)
    return (
      <Missing
        title="No saved draft here"
        text="Drafts are saved in the browser that generated them. Ask for a share link, or describe an app on the home page and the agent researches a new one."
      />
    );

  return (
    <GuideView
      guide={d.guide}
      logo={d.logo}
      research={d.research}
      onShare={() => copyShare(d)}
      onRemove={() => {
        removeDraft(slug);
        toast(`${d.guide.app} draft removed`);
        router.push("/");
      }}
    />
  );
}

function Missing({ title, text }: { title: string; text: string }) {
  return (
    <Empty className="enter py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestionIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild size="lg" className="px-4">
          <Link href="/">Back to the library</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
