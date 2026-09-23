"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as api from "@/lib/api-client";
import type { Overview } from "@/lib/types";

type ConsoleData = {
  overview: Overview | null;
  refreshOverview: () => Promise<void>;
};

const Ctx = createContext<ConsoleData>({ overview: null, refreshOverview: async () => {} });

/**
 * Shared, lightly-polled console state (pending approvals badge, today's
 * spend). Pages that change it — approving, placing an order — call
 * refreshOverview() so the sidebar updates immediately.
 */
export function ConsoleDataProvider({ children }: { children: React.ReactNode }) {
  const [overview, setOverview] = useState<Overview | null>(null);

  const refreshOverview = useCallback(async () => {
    try {
      setOverview(await api.getOverview());
    } catch {
      // badge is best-effort; pages surface their own errors
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch + polling from the REST API
    refreshOverview();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshOverview();
    }, 20000);
    return () => window.clearInterval(id);
  }, [refreshOverview]);

  return <Ctx.Provider value={{ overview, refreshOverview }}>{children}</Ctx.Provider>;
}

export function useConsoleData() {
  return useContext(Ctx);
}
