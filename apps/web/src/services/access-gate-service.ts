/** Landing access-gate client (Sign in code → demo | iConnectPlus). */

import { ApiClientError } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";
import { getApiUrl, resolveApiUrl } from "@/utils/env";

export type AccessGateTarget = "demo" | "connectplus";

export type AccessGateVerifyResult = {
  target: AccessGateTarget;
  redirect_path: string;
  token: string;
  expires_in_hours: number;
};

export type AccessGateSession = {
  target: AccessGateTarget;
  redirect_path: string;
};

const STORAGE_KEY = "icp.accessGateToken";
const VERIFY_RETRY_ATTEMPTS = 3;
const VERIFY_RETRY_DELAY_MS = 700;

export function getAccessGateToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAccessGateToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearAccessGateToken(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isTransientGatewayFailure(status: number, message: string): boolean {
  const msg = message.toLowerCase();
  if (status === 502 || status === 503 || status === 504) return true;
  if (status === 0) return true;
  if (
    status === 500 &&
    (msg.includes("internal server error") || msg.includes("socket") || !msg.trim())
  ) {
    return true;
  }
  return false;
}

async function parseJson<T>(response: Response): Promise<ApiResponse<T>> {
  const raw = await response.text();
  let payload: (ApiResponse<T> & { errors?: string[]; message?: string }) | null = null;
  try {
    payload = raw
      ? (JSON.parse(raw) as ApiResponse<T> & { errors?: string[]; message?: string })
      : null;
  } catch {
    const fallback =
      response.status >= 500
        ? "Cannot reach the API right now. The backend may be restarting — wait a moment and try again."
        : raw.trim().slice(0, 160) || `Request failed (${response.status})`;
    throw new ApiClientError(fallback, response.status);
  }
  if (!payload || !response.ok || payload.success === false) {
    const message = payload?.message || raw.trim().slice(0, 160) || "Request failed";
    if (isTransientGatewayFailure(response.status, message)) {
      throw new ApiClientError(
        "Cannot reach the API right now. The backend may be restarting — wait a moment and try again.",
        response.status,
        payload?.errors ?? [],
      );
    }
    throw new ApiClientError(message, response.status, payload?.errors ?? []);
  }
  return payload;
}

export async function verifyAccessCode(code: string): Promise<AccessGateVerifyResult> {
  await resolveApiUrl();
  let lastError: unknown;

  for (let attempt = 1; attempt <= VERIFY_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${getApiUrl()}/public/access-gate/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ code }),
        cache: "no-store",
      });
      const payload = await parseJson<AccessGateVerifyResult>(response);
      if (!payload.data) {
        throw new ApiClientError("Invalid response from access gate", response.status);
      }
      return payload.data;
    } catch (err) {
      lastError = err;
      const transient =
        err instanceof ApiClientError && isTransientGatewayFailure(err.status, err.message);
      if (!transient || attempt === VERIFY_RETRY_ATTEMPTS) {
        throw err;
      }
      await sleep(VERIFY_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ApiClientError("Cannot reach the API right now. Try again.", 0);
}

export async function fetchAccessGateSession(token: string): Promise<AccessGateSession> {
  await resolveApiUrl();
  const response = await fetch(`${getApiUrl()}/public/access-gate/session`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const payload = await parseJson<AccessGateSession>(response);
  if (!payload.data) {
    throw new ApiClientError("Invalid access gate session", response.status);
  }
  return payload.data;
}
