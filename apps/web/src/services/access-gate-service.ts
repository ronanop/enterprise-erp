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

async function parseJson<T>(response: Response): Promise<ApiResponse<T>> {
  const raw = await response.text();
  let payload: (ApiResponse<T> & { errors?: string[]; message?: string }) | null = null;
  try {
    payload = raw ? (JSON.parse(raw) as ApiResponse<T> & { errors?: string[]; message?: string }) : null;
  } catch {
    throw new ApiClientError(
      raw.trim().slice(0, 160) || `Request failed (${response.status})`,
      response.status,
    );
  }
  if (!payload || !response.ok || payload.success === false) {
    throw new ApiClientError(
      payload?.message || raw.trim().slice(0, 160) || "Request failed",
      response.status,
      payload?.errors ?? [],
    );
  }
  return payload;
}

export async function verifyAccessCode(code: string): Promise<AccessGateVerifyResult> {
  await resolveApiUrl();
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
}

export async function fetchAccessGateSession(
  token: string,
): Promise<AccessGateSession> {
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
