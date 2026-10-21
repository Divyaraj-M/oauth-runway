"use client";

import { BlocksIcon, ExternalLinkIcon, MessageCircleIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type Toolkit, authLabel, isOAuth, toolkitUrl } from "@/lib/toolkit-meta";
import { cn } from "@/lib/utils";

import { EvidenceBadge, tag } from "./bits";

const MANAGED_AUTH = "https://docs.composio.dev/toolkits/managed-auth";
const MANAGED_VS_CUSTOM = "https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app";

/**
 * What Composio's toolkit catalog says about this app: auth methods, whether Composio provides the OAuth app,
 * and the tool/trigger counts. Sourced from docs.composio.dev, synced by scripts/sync-toolkits.mjs.
 */
export function ComposioToolkit({ toolkit: t, app, onAsk }: { toolkit: Toolkit; app: string; onAsk: (text: string) => void }) {
  const oauth = isOAuth(t);
  const verdict =
    t.managed === true
      ? {
          title: "Composio provides the OAuth app",
          text: `Your users can connect ${app} through Composio's app today, without you registering one. The trade-offs: the consent screen says Composio, quota is shared with other Composio users, default scopes only, and polling triggers run every 15 minutes at most. Switch to your own app (the rest of this guide) for your name, custom scopes and your own quota.`,
          cls: "border-l1/30 bg-l1/10 text-l1",
          badge: "Managed app",
        }
      : t.managed === false
        ? {
            title: "Bring your own OAuth app",
            text: `Composio doesn't provide an app for ${app}. Register your own (the steps below), then add its client ID and secret to a Composio auth config.`,
            cls: "border-l3/30 bg-l3/10 text-l3",
            badge: "Your own app",
          }
        : {
            title: "No OAuth app needed",
            text: `Composio connects ${app} with ${t.auth.map(authLabel).join(" or ").toLowerCase()}, so there's no OAuth app to create or get approved.`,
            cls: "",
            badge: "No OAuth",
          };

  return (
    <Card className="gap-3 p-5" aria-label="Composio toolkit">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <BlocksIcon className="size-4" />
          On Composio
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-normal">{t.slug}</code>
        </div>
        <Badge variant="outline" className={cn(tag, verdict.cls)}>
          {verdict.badge}
        </Badge>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{verdict.title}</span>
        <p className="text-sm text-muted-foreground">{verdict.text}</p>
      </div>
      <dl className="tnum grid grid-cols-3 gap-3 border-t pt-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Auth</dt>
          <dd className="font-medium">{t.auth.map(authLabel).join(", ")}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Tools</dt>
          <dd className="font-medium">{t.tools}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Triggers</dt>
          <dd className="font-medium">{t.triggers}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <EvidenceBadge ev="sourced" src={t.managed === true ? MANAGED_VS_CUSTOM : t.managed === false ? MANAGED_AUTH : toolkitUrl(t)} />
        <Button variant="outline" size="xs" asChild>
          <a href={toolkitUrl(t)} target="_blank" rel="noopener noreferrer">
            Toolkit docs
            <ExternalLinkIcon />
          </a>
        </Button>
        {oauth && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() =>
              onAsk(
                t.managed
                  ? `I'm using Composio's managed app for ${app} (${t.slug}). When do I need my own OAuth app, and how do I switch without reconnecting every user?`
                  : `How do I set up a Composio auth config for ${app} (${t.slug}) with my own OAuth app?`,
              )
            }
          >
            <MessageCircleIcon />
            Ask
          </Button>
        )}
      </div>
    </Card>
  );
}
