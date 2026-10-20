"use client";

import { BadgeCheckIcon, ClockIcon, EyeOffIcon, SendIcon, Undo2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { approveGuide, publishGuide, sendBackGuide } from "@/app/g/actions";
import { GuideView } from "@/components/guide/guide-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Review } from "@/lib/db";
import { fmtDate } from "@/lib/levels";
import type { GeneratePayload } from "@/lib/types";

/** A generated guide saved in the database, with its review state: draft → pending approval → approved. */
export function SavedGuideView({
  payload,
  id,
  review,
  isOwner,
  isAdmin,
}: {
  payload: GeneratePayload;
  id: string;
  review: Review;
  isOwner: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: (id: string) => Promise<{ ok: boolean; message?: string }>, done: string) =>
    start(async () => {
      const r = await action(id);
      if (!r.ok) return void toast(r.message ?? "That didn't work.");
      toast(done);
      router.refresh();
    });

  const statusBadge =
    review.status === "approved" ? (
      <Badge variant="outline" className="rounded-md border-l1/30 bg-l1/10 px-2.5 font-semibold text-l1">
        <BadgeCheckIcon />
        Approved by {review.approvedBy ?? "a reviewer"}
      </Badge>
    ) : review.status === "published" ? (
      <Badge variant="outline" className="rounded-md border-l3/30 bg-l3/10 px-2.5 font-semibold text-l3">
        <ClockIcon />
        Pending approval
      </Badge>
    ) : (
      <Badge variant="secondary" className="rounded-md px-2.5 font-semibold">
        <EyeOffIcon />
        Draft
      </Badge>
    );

  const notice =
    review.status === "draft" ? (
      <Alert>
        <EyeOffIcon />
        <AlertTitle>Draft: only you can see this</AlertTitle>
        <AlertDescription>
          {isOwner
            ? "Check it over, then publish it. Published guides appear in the library as pending approval until a reviewer approves them."
            : "This draft hasn't been published by its author yet."}
        </AlertDescription>
      </Alert>
    ) : review.status === "published" ? (
      <Alert className="border-l3/40">
        <ClockIcon className="text-l3!" />
        <AlertTitle>Published, pending approval</AlertTitle>
        <AlertDescription>Anyone can read it. A reviewer hasn&apos;t checked it yet, so treat every line as Unverified until approved.</AlertDescription>
      </Alert>
    ) : (
      <Alert className="border-l1/40">
        <BadgeCheckIcon className="text-l1!" />
        <AlertTitle>Approved by {review.approvedBy ?? "a reviewer"}</AlertTitle>
        <AlertDescription>
          Reviewed{review.approvedAt ? ` on ${fmtDate(review.approvedAt.slice(0, 10))}` : ""}. Evidence labels still apply line by line.
        </AlertDescription>
      </Alert>
    );

  const actions = (
    <>
      {isOwner && review.status === "draft" && (
        <Button size="lg" className="px-4" disabled={pending} onClick={() => run(publishGuide, "Published. It's in the library, pending approval.")}>
          {pending ? <Spinner /> : <SendIcon />}
          Publish
        </Button>
      )}
      {isAdmin && review.status === "published" && (
        <Button size="lg" className="px-4" disabled={pending} onClick={() => run(approveGuide, "Approved")}>
          {pending ? <Spinner /> : <BadgeCheckIcon />}
          Approve
        </Button>
      )}
      {isAdmin && review.status !== "draft" && (
        <Button size="lg" variant="outline" className="px-4" disabled={pending} onClick={() => run(sendBackGuide, "Sent back to draft")}>
          <Undo2Icon />
          Send back to draft
        </Button>
      )}
    </>
  );

  return (
    <GuideView
      guide={payload.guide}
      logo={payload.logo}
      research={payload.research}
      guideId={id}
      statusBadge={statusBadge}
      notice={notice}
      actions={actions}
      // A draft's link only works for its author, so offer sharing once it's published.
      onShare={
        review.status === "draft"
          ? undefined
          : async () => {
              try {
                await navigator.clipboard.writeText(`${location.origin}/g/${id}`);
                toast("Share link copied", { description: "Anyone with the link can read this guide." });
              } catch {
                toast("Copy was blocked here. Use Copy as Markdown instead.");
              }
            }
      }
    />
  );
}
