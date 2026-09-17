const STORAGE_KEY = "erp_welcome_splash";

export type WelcomeSplashPayload = {
  userName: string;
  createdAt: number;
};

/** Persist a one-shot welcome splash after Microsoft login. */
export function queueWelcomeSplash(userName: string): void {
  if (typeof window === "undefined") return;
  const payload: WelcomeSplashPayload = {
    userName: userName.trim() || "there",
    createdAt: Date.now(),
  };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

/** Read without clearing — AuthGate peeks until splash finishes. */
export function peekWelcomeSplash(): WelcomeSplashPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WelcomeSplashPayload;
    if (!parsed?.userName || typeof parsed.createdAt !== "number") return null;
    // Ignore stale payloads (> 2 min).
    if (Date.now() - parsed.createdAt > 120_000) {
      clearWelcomeSplash();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearWelcomeSplash(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
