import type { ComponentType, SVGProps } from "react";

import { AsanaLogo } from "@/components/ui/svgs/asanaLogo";
import { Calendly } from "@/components/ui/svgs/calendly";
import { Drive } from "@/components/ui/svgs/drive";
import { Dropbox } from "@/components/ui/svgs/dropbox";
import { GithubDark } from "@/components/ui/svgs/githubDark";
import { GithubLight } from "@/components/ui/svgs/githubLight";
import { Gmail } from "@/components/ui/svgs/gmail";
import { GoogleCalendar } from "@/components/ui/svgs/googleCalendar";
import { Linear } from "@/components/ui/svgs/linear";
import { MicrosoftOutlook } from "@/components/ui/svgs/microsoftOutlook";
import { MicrosoftTeams } from "@/components/ui/svgs/microsoftTeams";
import { Notion } from "@/components/ui/svgs/notion";
import { Salesforce } from "@/components/ui/svgs/salesforce";
import { Slack } from "@/components/ui/svgs/slack";
import { Zoom } from "@/components/ui/svgs/zoom";

type Svg = ComponentType<SVGProps<SVGSVGElement>>;

/** GitHub's mark is monochrome, so it swaps with the colour scheme. */
const Github: Svg = ({ className, ...props }) => (
  <>
    <GithubLight className={`${className ?? ""} dark:hidden`} {...props} />
    <GithubDark className={`${className ?? ""} hidden dark:block`} {...props} />
  </>
);

/**
 * Brand logos from svgl.app (`npx shadcn add @svgl/<name>`), used under each brand's terms.
 * Keyed by catalog key. SVGL has no entry for Aircall, Jira, Confluence, HubSpot, Zendesk or Airtable
 * (checked against the full API catalog, Oct 2026), so those fall back to the letter tile.
 */
export const LOGOS: Record<string, Svg> = {
  gmail: Gmail,
  slack: Slack,
  notion: Notion,
  linear: Linear,
  github: Github,
  salesforce: Salesforce,
  zoom: Zoom,
  calendly: Calendly,
  googlecalendar: GoogleCalendar,
  googledrive: Drive,
  outlook: MicrosoftOutlook,
  teams: MicrosoftTeams,
  asana: AsanaLogo,
  dropbox: Dropbox,
};
