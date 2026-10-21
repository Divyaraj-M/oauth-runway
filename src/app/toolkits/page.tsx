import type { Metadata } from "next";
import { Suspense } from "react";

import { type GuideLink, ToolkitBrowser } from "@/components/toolkits/toolkit-browser";
import { Skeleton } from "@/components/ui/skeleton";
import { latestDrafts } from "@/lib/db";
import { GUIDES } from "@/lib/guides";
import { fmtDate } from "@/lib/levels";
import { TOOLKITS, TOOLKITS_SOURCE, TOOLKITS_SYNCED, isOAuth } from "@/lib/toolkits";
import { normName } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Composio toolkits · OAuth Runway",
  description: "Every Composio toolkit with its auth methods and whether Composio provides the OAuth app, linked to our approval guides.",
};

const oauth = TOOLKITS.filter(isOAuth);
const managed = TOOLKITS.filter((t) => t.managed === true).length;
// The browser doesn't need descriptions; keep the payload small.
const rows = TOOLKITS.map((t) => ({ ...t, description: undefined }));

export default function Page() {
  return (
    <div className="flex flex-col gap-8">
      <header className="enter flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Composio toolkits</h1>
        <p className="max-w-[65ch] leading-relaxed text-muted-foreground">
          Composio connects agents to {TOOLKITS.length.toLocaleString("en-US")} apps. {oauth.length} use OAuth. For {managed} of them Composio provides the OAuth app, so your
          users can connect today; the rest need your own app, and that&apos;s where a provider review can hold you up.
        </p>
        <dl className="tnum grid max-w-xl grid-cols-3 gap-3 pt-2">
          {[
            ["Toolkits", TOOLKITS.length],
            ["Use OAuth", oauth.length],
            ["Composio app", managed],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 rounded-lg border bg-card px-4 py-3">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="text-xl font-semibold tracking-tight">{Number(v).toLocaleString("en-US")}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
          From{" "}
          <a href={TOOLKITS_SOURCE} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
            docs.composio.dev/toolkits
          </a>
          , synced {fmtDate(TOOLKITS_SYNCED)}.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Browser />
      </Suspense>
    </div>
  );
}

async function Browser() {
  const community = await latestDrafts();
  const guides: Record<string, GuideLink> = {};
  for (const d of community) guides[d.slug] = { href: `/g/${d.id}`, status: d.status === "approved" ? "approved" : "published" };
  for (const g of Object.values(GUIDES)) guides[normName(g.app)] = { href: `/guides/${g.key}`, status: "reviewed" };
  return <ToolkitBrowser toolkits={rows} guides={guides} />;
}
