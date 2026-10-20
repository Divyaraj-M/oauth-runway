"use client";

import { createContext, use, useCallback, useEffect, useState } from "react";

import type { User } from "@/lib/auth/server";
import type { DraftSummary } from "@/lib/db";

type Me = { user: User | null; admin: boolean; guides: DraftSummary[]; loading: boolean; refresh: () => void };

const MeContext = createContext<Me>({ user: null, admin: false, guides: [], loading: true, refresh: () => {} });

/** Who's signed in (from /api/me), shared by the header menu and the home page's recent guides. */
export function MeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<Me, "refresh">>({ user: null, admin: false, guides: [], loading: true });
  const refresh = useCallback(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setState({ user: d.user, admin: d.admin, guides: d.guides ?? [], loading: false }))
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }, []);
  useEffect(refresh, [refresh]);
  return <MeContext value={{ ...state, refresh }}>{children}</MeContext>;
}

export const useMe = () => use(MeContext);
