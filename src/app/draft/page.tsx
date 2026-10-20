"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { GuideView } from "@/components/guide/guide-view";
import { Button } from "@/components/ui/button";
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
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-xl font-semibold tracking-tight">No live draft here</h1>
        <p className="max-w-sm text-sm text-muted-foreground">Drafts stay in this browser tab only. Describe an app on the home page and the agent writes a new one.</p>
        <Button asChild size="lg" className="px-4">
          <Link href="/">Back to the library</Link>
        </Button>
      </div>
    );
  return <GuideView guide={d.guide} logo={d.logo} research={d.research} />;
}
