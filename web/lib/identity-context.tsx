"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  type StoredIdentity,
  getStoredIdentity,
  setStoredIdentity,
  clearStoredIdentity,
} from "./identity";

type IdentityContextValue = {
  identity: StoredIdentity | null;
  ready: boolean;
  setIdentity: (identity: StoredIdentity) => void;
  clearIdentity: () => void;
};

const IdentityContext = createContext<IdentityContextValue | null>(null);

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentityState] = useState<StoredIdentity | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Syncing from localStorage (an external system unavailable during
    // SSR) — must run post-mount, not as a lazy useState initializer, or
    // the server render (no window) and client hydration render (real
    // storage) would disagree and React would flag a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdentityState(getStoredIdentity());
    setReady(true);
  }, []);

  const setIdentity = useCallback((next: StoredIdentity) => {
    setStoredIdentity(next);
    setIdentityState(next);
  }, []);

  const clearIdentity = useCallback(() => {
    clearStoredIdentity();
    setIdentityState(null);
  }, []);

  return (
    <IdentityContext.Provider value={{ identity, ready, setIdentity, clearIdentity }}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error("useIdentity must be used within IdentityProvider");
  return ctx;
}
