import { clearTokens } from "@/lib/auth";
import { authService } from "@/services/api-client";

export async function signOutAndRedirect(): Promise<void> {
  try {
    await authService.logout();
  } catch {
    clearTokens();
  }
  window.location.href = "/login";
}
