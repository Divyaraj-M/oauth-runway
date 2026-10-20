"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useRef, useState } from "react";

import type { User } from "@/lib/auth/server";
import { clearLegacy, readLegacy, saveSettings } from "@/lib/ai-settings";
import type { AiSettingsSummary, DraftSummary } from "@/lib/db";

import { SignInDialog } from "./sign-in-dialog";

type Me = {
  user: User | null;
  admin: boolean;
  guides: DraftSummary[];
  /** AI settings on the account (no key, just its last 4 characters). */
  ai: AiSettingsSummary;
  loading: boolean;
  refresh: () => Promise<User | null>;
  /** Opens the sign-in modal; resolves true once signed in, false if it was closed. */
  requireSignIn: () => Promise<boolean>;
};

const MeContext = createContext<Me>({
  user: null,
  admin: false,
  guides: [],
  ai: null,
  loading: true,
  refresh: async () => null,
  requireSignIn: async () => false,
});

/** Who's signed in (from /api/me), shared by the header, the home page and anything that needs sign-in. */
export function MeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<Omit<Me, "refresh" | "requireSignIn">>({ user: null, admin: false, guides: [], ai: null, loading: true });
  const [open, setOpen] = useState(false);
  const waiting = useRef<((ok: boolean) => void) | null>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await fetch("/api/me", { cache: "no-store" }).then((r) => r.json());
      setState({ user: d.user, admin: d.admin, guides: d.guides ?? [], ai: d.ai ?? null, loading: false });
      // Earlier versions kept the key in localStorage. Move it to the account once, then wipe it from the browser.
      const legacy = readLegacy();
      if (legacy) {
        if (d.user && !d.ai) {
          const saved = await saveSettings(legacy).catch(() => null);
          if (saved) setState((st) => ({ ...st, ai: saved.ai }));
        }
        // Signed in: moved above. Signed out: wipe anyway, so no key outlives a session in this browser.
        clearLegacy();
      }
      return d.user as User | null;
    } catch {
      setState((s) => ({ ...s, loading: false }));
      return null;
    }
  }, []);

  const requireSignIn = useCallback(() => {
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      waiting.current?.(false);
      waiting.current = resolve;
    });
  }, []);

  useEffect(() => {
    let live = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        setState({ user: d.user, admin: d.admin, guides: d.guides ?? [], ai: d.ai ?? null, loading: false });
        // One-time move of an old browser-stored key into the account (see refresh()).
        const legacy = readLegacy();
        if (legacy) {
          (d.user && !d.ai ? saveSettings(legacy).catch(() => null) : Promise.resolve(null)).then((saved) => {
            if (saved && live) setState((st) => ({ ...st, ai: saved.ai }));
            clearLegacy();
          });
        }
      })
      .catch(() => live && setState((s) => ({ ...s, loading: false })));
    // API routes answer 401 "sign_in" when the session is missing or expired.
    const onRequired = () => requireSignIn();
    window.addEventListener("sign-in-required", onRequired);
    return () => {
      live = false;
      window.removeEventListener("sign-in-required", onRequired);
    };
  }, [requireSignIn]);

  return (
    <MeContext value={{ ...state, refresh, requireSignIn }}>
      {children}
      <SignInDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            waiting.current?.(false);
            waiting.current = null;
          }
        }}
        onSignedIn={async () => {
          // Claim the waiting action before the dialog closes (closing resolves it as "cancelled").
          const resume = waiting.current;
          waiting.current = null;
          await refresh();
          router.refresh();
          resume?.(true);
        }}
      />
    </MeContext>
  );
}

export const useMe = () => use(MeContext);
