"use client";

import { FileQuestionIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { GuideView } from "@/components/guide/guide-view";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { removeDraft, useDrafts } from "@/lib/drafts";

/** A saved live draft, by `?app=<slug>`. Drafts live in this browser, so they're shareable as Markdown, not by link. */
export function DraftView() {
  const slug = useSearchParams().get("app") ?? "";
  const drafts = useDrafts();
  const router = useRouter();
  const d = drafts[slug];

  if (!d?.guide)
    return (
      <Empty className="enter py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestionIcon />
          </EmptyMedia>
          <EmptyTitle>No saved draft here</EmptyTitle>
          <EmptyDescription>Drafts are saved in the browser that generated them. Describe an app on the home page and the agent researches a new one.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild size="lg" className="px-4">
            <Link href="/">Back to the library</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );

  return (
    <GuideView
      guide={d.guide}
      logo={d.logo}
      research={d.research}
      onRemove={() => {
        removeDraft(slug);
        toast(`${d.guide.app} draft removed`);
        router.push("/");
      }}
    />
  );
}
