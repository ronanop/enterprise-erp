/** Client-safe environment configuration with API URL fallback. */

function normalizeApiUrl(raw: string | undefined | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value.replace(/\/$/, "");
  }
  const relative = value.startsWith("/") ? value : `/${value}`;
  const trimmed = relative.replace(/\/$/, "");
  return trimmed || "/api/v1";
}

const primaryApiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL) ?? "/api/v1";
const fallbackApiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL_FALLBACK);

let activeApiUrl = primaryApiUrl;
let probePromise: Promise<string> | null = null;

async function probeApiBase(base: string): Promise<boolean> {
  if (!base.startsWith("http://") && !base.startsWith("https://")) {
    return true;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${base}/health`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

/** Resolve API base: prefer primary, switch to fallback when primary health fails. */
export async function resolveApiUrl(): Promise<string> {
  if (!fallbackApiUrl || fallbackApiUrl === primaryApiUrl) {
    activeApiUrl = primaryApiUrl;
    return activeApiUrl;
  }
  if (!probePromise) {
    probePromise = (async () => {
      if (await probeApiBase(primaryApiUrl)) {
        activeApiUrl = primaryApiUrl;
        return activeApiUrl;
      }
      if (await probeApiBase(fallbackApiUrl)) {
        activeApiUrl = fallbackApiUrl;
        return activeApiUrl;
      }
      activeApiUrl = primaryApiUrl;
      return activeApiUrl;
    })().finally(() => {
      probePromise = null;
    });
  }
  return probePromise;
}

export function getActiveApiUrl(): string {
  return activeApiUrl;
}

/** Force switch after a network failure against the current base. */
export function preferApiFallback(): string {
  if (fallbackApiUrl && activeApiUrl === primaryApiUrl) {
    activeApiUrl = fallbackApiUrl;
  }
  return activeApiUrl;
}

export const env = {
  get apiUrl() {
    return activeApiUrl;
  },
  apiUrlPrimary: primaryApiUrl,
  apiUrlFallback: fallbackApiUrl,
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Enterprise ERP",
  demoEmail: process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "admin@example.com",
  /** Shared default for every demo / module login account. */
  demoPassword: process.env.NEXT_PUBLIC_DEMO_PASSWORD || "Secure1!",
} as const;
