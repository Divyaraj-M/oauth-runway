"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { LogoInfo } from "@/lib/types";

import { LOGOS } from "./logos";

/** Square avatar: brand marks don't sit well in circles. */
const tile = "size-9 rounded-md bg-muted after:rounded-md";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * Renders the winner of the server-side logo waterfall. shadcn Avatar handles the fallback:
 * a remote image that fails to load shows the letter tile instead.
 */
export function AppLogo({ name, logo }: { name: string; logo?: LogoInfo }) {
  const Local = logo?.local ? LOGOS[logo.local] : undefined;
  return (
    <Avatar className={tile} aria-hidden title={logo && logo.source !== "letter" ? `Logo: ${logo.source}` : undefined}>
      {Local ? (
        <span className="grid size-full place-items-center">
          <Local className="size-5" />
        </span>
      ) : (
        <>
          {logo?.light && (
            <picture className="contents">
              {logo.dark && <source srcSet={logo.dark} media="(prefers-color-scheme: dark)" />}
              <AvatarImage src={logo.light} alt="" className="rounded-none object-contain p-2" />
            </picture>
          )}
          <AvatarFallback className="rounded-md text-sm font-semibold text-foreground">{initials(name)}</AvatarFallback>
        </>
      )}
    </Avatar>
  );
}
