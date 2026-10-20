import { ClockIcon, ExternalLinkIcon, RefreshCwIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EVIDENCE_LABEL, LEVELS, LEVEL_CLASS, fmtDate } from "@/lib/levels";
import type { Evidence, Guide } from "@/lib/types";
import { cn } from "@/lib/utils";

const EV_CLASS: Record<Evidence, string> = {
  tested: LEVEL_CLASS[1].badge,
  sourced: LEVEL_CLASS[2].badge,
  uncertain: LEVEL_CLASS[3].badge,
};

/** Square-cornered badge to match the prototype's shadcn new-york look. */
export const tag = "rounded-md px-2.5 font-semibold";

/** `src` (generated guides) is the page the agent opened for this claim; the badge links to it. */
export function EvidenceBadge({ ev, src }: { ev: Evidence; src?: string }) {
  const k: Evidence = EVIDENCE_LABEL[ev] ? ev : "uncertain";
  if (src && k === "sourced") {
    let host = src;
    try {
      host = new URL(src).hostname.replace(/^www\./, "");
    } catch {}
    return (
      <Badge asChild variant="outline" className={cn(tag, EV_CLASS[k], "hover:underline")}>
        <a href={src} target="_blank" rel="noopener noreferrer" title={`Read on ${src}`}>
          {EVIDENCE_LABEL[k]} · {host}
          <ExternalLinkIcon />
        </a>
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn(tag, EV_CLASS[k])}>
      {EVIDENCE_LABEL[k]}
    </Badge>
  );
}

export function LevelMeter({ n, className = "h-1.5" }: { n: number; className?: string }) {
  const lc = LEVEL_CLASS[n as 1 | 2 | 3 | 4];
  return (
    <div className="flex w-full gap-1" role="img" aria-label={n ? `Difficulty level ${n} of 4` : "Not rated"}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={cn(className, "flex-1 rounded-full", lc && i <= n ? lc.bg : "bg-muted")} />
      ))}
    </div>
  );
}

export function LevelBadge({ n }: { n: 1 | 2 | 3 | 4 }) {
  return (
    <Badge variant="outline" className={cn(tag, LEVEL_CLASS[n].badge)}>
      Level {n} · {LEVELS[n - 1].name}
    </Badge>
  );
}

/** Reviewed guides: the date checked by hand. Generated guides: when the provider's pages were read (at generation). */
export function Freshness({ g, pagesRead }: { g: Guide; pagesRead?: number }) {
  if (g._generated)
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" tabIndex={0} className={cn(tag, "text-muted-foreground")}>
            <ClockIcon />
            Researched {g.checked ? fmtDate(g.checked) : "just now"}
            {pagesRead !== undefined && ` · ${pagesRead} page${pagesRead === 1 ? "" : "s"} read`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">
          The agent opened the provider&apos;s pages on this date while writing the guide. See the Sources tab for exactly which ones.
        </TooltipContent>
      </Tooltip>
    );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" tabIndex={0} className={cn(tag, "text-muted-foreground")}>
          <RefreshCwIcon />
          Last updated {fmtDate(g.checked ?? "2026-10-20")}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">
        Updated by hand on this date. A weekly re-crawl of provider docs is specified but not running in this prototype.
      </TooltipContent>
    </Tooltip>
  );
}
