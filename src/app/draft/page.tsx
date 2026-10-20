"use client";

import { FileQuestionIcon } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { GuideView } from "@/components/guide/guide-view";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { type Draft, loadDraft } from "@/lib/agent-client";

// The live draft (guide + logo + research log from /api/generate) lives in sessionStorage only:
// it is never shareable by link, only as Markdown. Read as a string so the snapshot compares by value.
const read = () => {
  const d = loadDraft();
  return d ? JSON.stringify(d) : null;
};

export default function DraftPage() {
  const raw = useSyncExternalStore(() => () => {}, read, () => undefined);
  if (raw === undefined) return null;
  const d: Draft | null = raw ? JSON.parse(raw) : null;
  if (!d?.guide)
    return (
      <Empty className="enter py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestionIcon />
          </EmptyMedia>
          <EmptyTitle>No live draft here</EmptyTitle>
          <EmptyDescription>Drafts stay in this browser tab only. Describe an app on the home page and the agent researches a new one.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild size="lg" className="px-4">
            <Link href="/">Back to the library</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  return <GuideView guide={d.guide} logo={d.logo} research={d.research} />;
}
