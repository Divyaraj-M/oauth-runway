"use client";

import { useState } from "react";

import type { LogoInfo } from "@/lib/types";

import { LOGOS } from "./logos";

const box = "grid size-9 shrink-0 place-items-center rounded-md border bg-muted";

/** Renders the winner of the server-side logo waterfall; a remote image that fails to load drops to the letter tile. */
export function AppLogo({ name, logo }: { name: string; logo?: LogoInfo }) {
  const [broken, setBroken] = useState(false);

  const Local = logo?.local ? LOGOS[logo.local] : undefined;
  if (Local)
    return (
      <span aria-hidden className={box} title="Logo: SVGL (bundled)">
        <Local className="size-5" />
      </span>
    );

  if (logo?.light && !broken)
    return (
      <span aria-hidden className={box} title={`Logo: ${logo.source}`}>
        <picture>
          {logo.dark && <source srcSet={logo.dark} media="(prefers-color-scheme: dark)" />}
          <img src={logo.light} alt="" className="size-5 object-contain" loading="lazy" onError={() => setBroken(true)} />
        </picture>
      </span>
    );

  const letters = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span aria-hidden className={`${box} text-sm font-semibold text-foreground`}>
      {letters}
    </span>
  );
}
