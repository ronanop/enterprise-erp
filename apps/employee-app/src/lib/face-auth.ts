/** Face verification session (after password login). */

const FACE_VERIFIED_KEY = "ess_face_verified_at";
const FACE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function markFaceVerified() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FACE_VERIFIED_KEY, String(Date.now()));
}

export function clearFaceVerified() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(FACE_VERIFIED_KEY);
}

export function isFaceVerified(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(FACE_VERIFIED_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < FACE_TTL_MS;
}
