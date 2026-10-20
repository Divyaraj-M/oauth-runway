"use client";

import { toast } from "sonner";

import { GuideView } from "@/components/guide/guide-view";
import type { GeneratePayload } from "@/lib/types";

/** A generated guide saved in the database; its URL (/g/<id>) is the share link. */
export function SavedGuideView({ payload, id }: { payload: GeneratePayload; id: string }) {
  return (
    <GuideView
      guide={payload.guide}
      logo={payload.logo}
      research={payload.research}
      guideId={id}
      onShare={async () => {
        try {
          await navigator.clipboard.writeText(`${location.origin}/g/${id}`);
          toast("Share link copied", { description: "Anyone with the link can read this guide." });
        } catch {
          toast("Copy was blocked here. Use Copy as Markdown instead.");
        }
      }}
    />
  );
}
