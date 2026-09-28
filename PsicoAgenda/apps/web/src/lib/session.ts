import { type SessionUser } from "@psicoagenda/shared";

const SESSION_KEY = "psicoagenda_session";
const TOKEN_KEY = "psicoagenda_token";
const COOKIE_NAME = "pa_session";

export interface Session {
  user: SessionUser;
  token: string;
}

export function saveSession(session: Session): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session.user));
  document.cookie = `${COOKIE_NAME}=1; path=/; SameSite=Lax`;
}

let cachedKey: string | null | undefined = undefined;
let cachedSession: Session | null = null;

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;

  const token = localStorage.getItem(TOKEN_KEY);
  const userJson = localStorage.getItem(SESSION_KEY);
  const key = token === null && userJson === null ? null : `${token}\u0000${userJson}`;

  if (key !== undefined && key === cachedKey) {
    return cachedSession;
  }

  cachedKey = key;

  if (!token || !userJson) {
    cachedSession = null;
    return null;
  }

  try {
    const user = JSON.parse(userJson) as SessionUser;
    cachedSession = { token, user };
    return cachedSession;
  } catch {
    cachedSession = null;
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
  document.cookie = `${COOKIE_NAME}=; path=/; SameSite=Lax; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function hasSessionCookie(): boolean {
  if (typeof window === "undefined") return false;
  return document.cookie.split("; ").some((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
}
