/** First-run splash / onboarding flags for Employee App. */

const ONBOARDING_KEY = "ess_onboarding_complete";
const SPLASH_SEEN_KEY = "ess_splash_seen_session";

export function isOnboardingComplete(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ONBOARDING_KEY) === "1";
}

export function markOnboardingComplete() {
  window.localStorage.setItem(ONBOARDING_KEY, "1");
}

export function resetOnboarding() {
  window.localStorage.removeItem(ONBOARDING_KEY);
}

/** Session-only: show cinematic splash once per tab session. */
export function hasSeenSplashThisSession(): boolean {
  if (typeof window === "undefined") return true;
  return window.sessionStorage.getItem(SPLASH_SEEN_KEY) === "1";
}

export function markSplashSeenThisSession() {
  window.sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
}
