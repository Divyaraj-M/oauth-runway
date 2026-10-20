"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useRef, useState } from "react";

import type { User } from "@/lib/auth/server";
import type { DraftSummary } from "@/lib/db";

import { SignInDialog } from "./sign-in-dialog";

type Me = {
  user: User | null;
  admin: boolean;
  guides: DraftSummary[];
  loading: boolean;
  refresh: () => Promise<User | null>;
  /** Opens the sign-in modal; resolves true once signed in, false if it was closed. */
  requireSignIn: () => Promise<boolean>;
};

const MeContext = createContext<Me>({
  user: null,
  admin: false,
  guides: [],
  loading: true,
  refresh: async () => null,
  requireSignIn: async () => false,
});

/** Who's signed in (from /api/me), shared by the header, the home page and anything that needs sign-in. */
export function MeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<Omit<Me, "refresh" | "requireSignIn">>({ user: null, admin: false, guides: [], loading: true });
  const [open, setOpen] = useState(false);
  const waiting = useRef<((ok: boolean) => void) | null>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await fetch("/api/me", { cache: "no-store" }).then((r) => r.json());
      setState({ user: d.user, admin: d.admin, guides: d.guides ?? [], loading: false });
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
      .then((d) => live && setState({ user: d.user, admin: d.admin, guides: d.guides ?? [], loading: false }))
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
