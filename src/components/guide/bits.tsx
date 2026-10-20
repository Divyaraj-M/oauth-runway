import { ClockIcon, RefreshCwIcon } from "lucide-react";

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

export function EvidenceBadge({ ev }: { ev: Evidence }) {
  const k: Evidence = EVIDENCE_LABEL[ev] ? ev : "uncertain";
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

/** Letter tile. If brand SVGs are added later (developer supplies them under each brand's terms), keep this as the fallback. */
export function AppTile({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-md border bg-muted text-sm font-semibold text-foreground">
      {letters}
    </span>
  );
}

export function Freshness({ g }: { g: Guide }) {
  if (g._generated)
    return (
      <Badge variant="outline" className={cn(tag, "text-muted-foreground")}>
        <ClockIcon />
        Generated just now
      </Badge>
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
