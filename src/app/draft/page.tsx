"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { GuideView } from "@/components/guide/guide-view";
import { Button } from "@/components/ui/button";
import { loadDraft } from "@/lib/agent-client";

// The live draft lives in sessionStorage only: it is never shareable by link, only as Markdown.
// Returned as a string so the snapshot compares by value; undefined on the server.
const read = () => {
  const g = loadDraft();
  return g ? JSON.stringify(g) : null;
};

export default function DraftPage() {
  const raw = useSyncExternalStore(() => () => {}, read, () => undefined);
  if (raw === undefined) return null;
  if (!raw)
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-xl font-semibold tracking-tight">No live draft here</h1>
        <p className="max-w-sm text-sm text-muted-foreground">Drafts stay in this browser tab only. Describe an app on the home page and the agent writes a new one.</p>
        <Button asChild size="lg" className="px-4">
          <Link href="/">Back to the library</Link>
        </Button>
      </div>
    );
  return <GuideView guide={JSON.parse(raw)} />;
}
