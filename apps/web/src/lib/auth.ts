/** Client-side auth token helpers.

Prefer HttpOnly cookies set by the API (VAPT: tokens must not live in localStorage).
Bearer tokens in memory remain as a fallback for same-tab API calls and legacy clients.
HttpOnly cookies are invisible to JS — use a session hint so UI knows a cookie session exists.
*/
const ACCESS_TOKEN_KEY = "erp_access_token";
const REFRESH_TOKEN_KEY = "erp_refresh_token";
/** Non-secret flag: cookie session confirmed (HttpOnly tokens cannot be read by JS). */
const SESSION_HINT_KEY = "erp_session_hint";

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

function purgeLegacyWebStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // ignore quota / privacy mode
  }
}

function dispatchAuthChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event("erp-auth-change"));
  } catch {
    // ignore
  }
}

function hasSessionHint(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mark that an HttpOnly cookie session was confirmed (e.g. /auth/me succeeded). */
export function markSessionPresent(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_HINT_KEY, "1");
  } catch {
    // ignore
  }
  dispatchAuthChange();
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  if (memoryAccessToken) return memoryAccessToken;
  // Migrate once from legacy localStorage, then purge.
  const legacy = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (legacy) {
    memoryAccessToken = legacy;
    purgeLegacyWebStorage();
    return legacy;
  }
  return null;
}

/** True when JWT `exp` is missing/unreadable or already past (with small skew). */
export function isAccessTokenExpired(token: string | null = getAccessToken()): boolean {
  if (!token) return true;
  const parts = token.split(".");
  if (parts.length < 2) return true;
  try {
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
    };
    if (typeof payload.exp !== "number") return false;
    // 30s skew — refresh before the API hard-rejects.
    return payload.exp * 1000 <= Date.now() + 30_000;
  } catch {
    return true;
  }
}

/**
 * Token for the Authorization header. Returns null when missing/expired so the
 * request can fall back to the HttpOnly access cookie instead of sending a
 * dead bearer that forces 401 → logout.
 */
export function getRequestAccessToken(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  if (isAccessTokenExpired(token)) return null;
  return token;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  if (memoryRefreshToken) return memoryRefreshToken;
  const legacy = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  if (legacy) {
    memoryRefreshToken = legacy;
    purgeLegacyWebStorage();
    return legacy;
  }
  // Refresh may exist only as HttpOnly cookie — return null; refresh endpoint reads cookie.
  return null;
}

export function setTokens(accessToken: string, refreshToken?: string) {
  memoryAccessToken = accessToken;
  if (refreshToken) {
    memoryRefreshToken = refreshToken;
  }
  purgeLegacyWebStorage();
  markSessionPresent();
}

export function clearTokens() {
  memoryAccessToken = null;
  memoryRefreshToken = null;
  purgeLegacyWebStorage();
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(SESSION_HINT_KEY);
    } catch {
      // ignore
    }
  }
  dispatchAuthChange();
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken()) || hasSessionHint();
}

/** Send user to login with return URL (client-only). */
export function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path.startsWith("/login") || path.startsWith("/onboarding")) return;
  const next = `${path}${window.location.search}`;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

/** Best-effort JWT `sub` for UI-only checks (SoD hints). Not a security boundary. */
export function getAccessTokenUserId(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
      sub?: string;
    };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
