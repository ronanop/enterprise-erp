/** Client-side auth token storage for API calls. */

const ACCESS_TOKEN_KEY = "erp_access_token";
const REFRESH_TOKEN_KEY = "erp_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken?: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
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
