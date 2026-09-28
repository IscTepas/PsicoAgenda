"use client";

import * as React from "react";
import { type SessionUser } from "@psicoagenda/shared";
import { readSession, saveSession, clearSession, type Session } from "@/lib/session";

interface SessionContextValue {
  user: SessionUser | null;
  token: string | null;
  logout: () => void;
  setSession: (session: Session) => void;
}

const SESSION_EVENT = "psicoagenda:session-change";

function notifySessionChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EVENT));
  }
}

function getSessionSnapshot(): Session | null {
  return readSession();
}

function subscribe(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener(SESSION_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(SESSION_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const session = React.useSyncExternalStore(
    subscribe,
    getSessionSnapshot,
    () => null,
  );

  const value = React.useMemo<SessionContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      logout: () => {
        clearSession();
        notifySessionChange();
      },
      setSession: (nextSession) => {
        saveSession(nextSession);
        notifySessionChange();
      },
    }),
    [session],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = React.useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
