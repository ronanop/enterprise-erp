import { clearTokens } from "@/lib/auth";
import { authService } from "@/services/api-client";

export async function signOutAndRedirect(): Promise<void> {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const loginHref =
    path === "/admin" || path.startsWith("/admin/") ? "/admin-login" : "/login";
  try {
    await authService.logout();
  } catch {
    clearTokens();
  }
  window.location.href = loginHref;
}
