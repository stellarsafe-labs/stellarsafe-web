/**
 * API session (JWT) obtained by signing an auth challenge with the wallet.
 * Kept in sessionStorage so it dies with the tab; never in localStorage.
 */
const KEY = "stellarsafe:api-session";

export interface ApiSession {
  address: string;
  token: string;
  expiresAt: number;
}

let current: ApiSession | null = null;

export function getSession(address?: string | null): ApiSession | null {
  if (!current && typeof window !== "undefined") {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) {
      try {
        current = JSON.parse(raw) as ApiSession;
      } catch {
        current = null;
      }
    }
  }
  if (!current || current.expiresAt <= Date.now()) return null;
  if (address && current.address !== address) return null;
  return current;
}

export function setSession(session: ApiSession | null) {
  current = session;
  if (typeof window === "undefined") return;
  if (session) window.sessionStorage.setItem(KEY, JSON.stringify(session));
  else window.sessionStorage.removeItem(KEY);
}
