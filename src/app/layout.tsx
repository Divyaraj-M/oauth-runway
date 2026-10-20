import { KeyRoundIcon } from "lucide-react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";

import { AccountMenu } from "@/components/auth/account-menu";
import { MeProvider } from "@/components/auth/me";
import { AiSettingsButton } from "@/components/settings/ai-settings";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OAuth Runway",
  description: "How long until your OAuth app is approved? Difficulty, work vs waiting time, and blockers for each provider.",
};

export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <TooltipProvider delayDuration={300} skipDelayDuration={150}>
          <MeProvider>
          <div className="mx-auto flex max-w-4xl flex-col">
            <header className="flex h-14 items-center justify-between border-b">
              <Link href="/" className="flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none">
                <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
                  <KeyRoundIcon className="size-3.5" />
                </span>
                OAuth Runway
              </Link>
              <div className="flex items-center gap-2">
                <AiSettingsButton />
                <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
                  <AccountMenu />
                </Suspense>
              </div>
            </header>
            <main className="pt-8">{children}</main>
            <footer className="pt-16 text-xs text-muted-foreground">
              Logos from{" "}
              <a href="https://svgl.app" className="underline underline-offset-2 hover:text-foreground">SVGL</a>,{" "}
              <a href="https://www.brandbird.app/tools/svg-company-logos" className="underline underline-offset-2 hover:text-foreground">BrandBird</a> and{" "}
              <a href="https://logo.dev" className="underline underline-offset-2 hover:text-foreground">Logo.dev</a>. Trademarks belong to their owners.
            </footer>
          </div>
          <Toaster position="bottom-right" />
          </MeProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
