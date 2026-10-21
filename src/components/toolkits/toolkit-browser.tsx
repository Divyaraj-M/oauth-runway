"use client";

import { ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon, SearchIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";

import { AppLogo } from "@/components/guide/app-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type Toolkit, authLabel, isOAuth, toolkitUrl } from "@/lib/toolkit-meta";
import { cn, normName } from "@/lib/utils";

export type ToolkitRow = Omit<Toolkit, "description">;
/** Our guide for a toolkit, keyed by normalized app name. */
export type GuideLink = { href: string; status: "reviewed" | "approved" | "published" };

const PAGE = 50;

const FILTERS = [
  ["all", "All"],
  ["oauth", "OAuth"],
  ["managed", "Composio app"],
  ["own", "Bring your own app"],
  ["other", "No OAuth"],
] as const;
type Filter = (typeof FILTERS)[number][0];

const test: Record<Filter, (t: ToolkitRow) => boolean> = {
  all: () => true,
  oauth: isOAuth,
  managed: (t) => t.managed === true,
  own: (t) => t.managed === false,
  other: (t) => !isOAuth(t),
};

const logoOf = (t: ToolkitRow) => ({ source: "composio" as const, light: `https://logos.composio.dev/api/${t.page}`, tried: [] });

export function ToolkitBrowser({ toolkits, guides }: { toolkits: ToolkitRow[]; guides: Record<string, GuideLink> }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("oauth");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const q = useDeferredValue(query.trim().toLowerCase());

  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, toolkits.filter(test[k]).length])) as Record<Filter, number>;
  const matches = toolkits.filter((t) => test[filter](t) && (!q || `${t.name} ${t.slug} ${t.category ?? ""}`.toLowerCase().includes(q)));
  // Toolkits we already have a guide for come first.
  const guideOf = (t: ToolkitRow) => guides[normName(t.name)];
  const sorted = q ? matches : [...matches].sort((a, b) => Number(!!guideOf(b)) - Number(!!guideOf(a)));
  const rows = sorted.slice(0, limit);

  const generate = (t: ToolkitRow) => router.push(`/?generate=${encodeURIComponent(t.name)}`);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="h-9 sm:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Search 1,600+ toolkits…"
            aria-label="Search toolkits"
          />
        </InputGroup>
        <div className="overflow-x-auto">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={filter}
            onValueChange={(v) => {
              if (!v) return;
              setFilter(v as Filter);
              setLimit(PAGE);
            }}
            aria-label="Filter by auth"
          >
            {FILTERS.map(([k, label]) => (
              <ToggleGroupItem key={k} value={k} className="px-3 whitespace-nowrap">
                {label}
                <span className="tnum font-mono text-[10px] text-muted-foreground">{counts[k]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {rows.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchXIcon />
              </EmptyMedia>
              <EmptyTitle>No toolkits match</EmptyTitle>
              <EmptyDescription>Composio may list it under another name. Or describe the app on the home page and the agent researches a guide.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 px-4">Toolkit</TableHead>
                <TableHead className="hidden h-10 md:table-cell">Auth</TableHead>
                <TableHead className="h-10">OAuth app</TableHead>
                <TableHead className="hidden h-10 text-right lg:table-cell">Tools</TableHead>
                <TableHead className="h-10 px-4 text-right">Guide</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => {
                const g = guideOf(t);
                return (
                  <TableRow key={t.slug} className={cn(g && "cursor-pointer")} onClick={g ? () => router.push(g.href) : undefined}>
                    <TableCell className="max-w-64 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <AppLogo name={t.name} logo={logoOf(t)} />
                        <div className="flex min-w-0 flex-col">
                          <a
                            href={toolkitUrl(t)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 truncate font-medium hover:underline"
                          >
                            {t.name}
                            <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground" />
                          </a>
                          <span className="truncate text-xs text-muted-foreground">
                            <span className="font-mono">{t.slug}</span>
                            {t.category ? ` · ${t.category}` : ""}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden whitespace-normal md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {t.auth.map((a) => (
                          <Badge key={a} variant="outline" className="rounded-md px-1.5 text-[11px] font-normal">
                            {authLabel(a)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {t.managed === true ? (
                        <Badge variant="outline" className="rounded-md border-l1/30 bg-l1/10 text-l1" title="Composio provides the OAuth app; users can connect without you registering one">
                          Composio provides
                        </Badge>
                      ) : t.managed === false ? (
                        <Badge variant="outline" className="rounded-md border-l3/30 bg-l3/10 text-l3" title="Register your own OAuth app and give Composio its client ID and secret">
                          Bring your own
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not needed</span>
                      )}
                    </TableCell>
                    <TableCell className="tnum hidden text-right lg:table-cell">
                      <div className="flex flex-col">
                        <span>{t.tools}</span>
                        {t.triggers > 0 && <span className="text-xs text-muted-foreground">{t.triggers} triggers</span>}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 text-right">
                      {g ? (
                        <Link href={g.href} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
                          {g.status === "reviewed" ? "Reviewed" : g.status === "approved" ? "Approved" : "Pending"}
                          <ChevronRightIcon className="size-4 text-muted-foreground" />
                        </Link>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => generate(t)}>
                          Generate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {sorted.length > limit && (
          <Button variant="outline" size="lg" className="px-4" onClick={() => setLimit((n) => n + PAGE * 2)}>
            Show more
            <ChevronDownIcon />
          </Button>
        )}
        <span className="tnum font-mono text-xs text-muted-foreground">
          {Math.min(limit, sorted.length)} of {sorted.length}
        </span>
      </div>
    </section>
  );
}
