import { ESS_API_HEALTH, env } from "@/utils/env";

export type EssHealthResult = {
  ok: boolean;
  status: number | null;
  elapsedMs: number;
  bodyPreview: string;
  error?: string;
};

let lastHealth: EssHealthResult | null = null;
let inFlight: Promise<EssHealthResult> | null = null;

export function getLastEssHealth(): EssHealthResult | null {
  return lastHealth;
}

/**
 * Probe https://ess-api.iconnectplus.in/api/v1/health and keep the last result
 * for login / offline error copy.
 */
export function warmEssApi(): Promise<EssHealthResult> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const started = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(ESS_API_HEALTH, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = (await res.text()).trim();
      const result: EssHealthResult = {
        ok: res.ok,
        status: res.status,
        elapsedMs: Date.now() - started,
        bodyPreview: text.slice(0, 280),
      };
      lastHealth = result;
      if (!res.ok) {
        console.warn(
          `[ESS API] health ${res.status} in ${result.elapsedMs}ms`,
          ESS_API_HEALTH,
          result.bodyPreview,
        );
      } else {
        console.info(
          `[ESS API] health OK in ${result.elapsedMs}ms`,
          ESS_API_HEALTH,
        );
      }
      return result;
    } catch (err) {
      const result: EssHealthResult = {
        ok: false,
        status: null,
        elapsedMs: Date.now() - started,
        bodyPreview: "",
        error: err instanceof Error ? err.message : String(err),
      };
      lastHealth = result;
      console.warn(
        `[ESS API] health unreachable in ${result.elapsedMs}ms`,
        ESS_API_HEALTH,
        result.error,
      );
      return result;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function essUnreachableMessage(): string {
  const h = lastHealth;
  if (!h) {
    return `Cannot reach ESS API. Check ${env.healthUrl}`;
  }
  if (h.status != null) {
    return `ESS API health returned HTTP ${h.status}. ${env.healthUrl}`;
  }
  return `Cannot reach ESS API (${h.error || "network error"}). ${env.healthUrl}`;
}
