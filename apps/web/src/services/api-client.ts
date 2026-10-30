import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  getRequestAccessToken,
  isAccessTokenExpired,
  redirectToLogin,
  setTokens,
} from "@/lib/auth";
import { clampListPageSize, rewriteHrmsApiPath } from "@/lib/hrms-api";
import { env, getApiUrl, resolveApiUrl, setApiUrl } from "@/utils/env";
import type { ApiResponse, ErrorResponse, TokenData, UserProfile } from "@/types/api";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: string[] = [],
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) {
    if (err.errors.length > 0) {
      return `${err.message}: ${err.errors.join("; ")}`;
    }
    return err.message;
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return fallback;
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Internal: skip one refresh retry to avoid loops. */
  _retried?: boolean;
  /** Internal: skip one API-base failover retry. */
  _apiFailover?: boolean;
  /**
   * Internal: omit Authorization header so a valid HttpOnly access cookie can
   * authenticate after a stale/invalid bearer caused 401 (avoids surprise logout).
   */
  _cookieOnly?: boolean;
};

function buildUrl(
  path: string,
  query?: RequestOptions["query"],
  baseUrl: string = getApiUrl(),
): string {
  const resolved = rewriteHrmsApiPath(path);
  const clamped = clampListPageSize(resolved, query);
  const base = `${baseUrl}${resolved}`;
  if (!clamped) return base;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(clamped)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

let refreshInFlight: Promise<boolean> | null = null;
let apiBaseReady: Promise<string> | null = null;
const getInflight = new Map<string, Promise<ApiResponse<unknown>>>();

function ensureApiBase(): Promise<string> {
  if (!apiBaseReady) {
    apiBaseReady = resolveApiUrl().catch(() => getApiUrl());
  }
  return apiBaseReady;
}

async function failoverApiBase(): Promise<void> {
  const before = getApiUrl();
  const resolved = await resolveApiUrl(true);
  if (resolved === before && env.apiUrlFallback !== before) {
    setApiUrl(env.apiUrlFallback);
  }
  apiBaseReady = Promise.resolve(getApiUrl());
}

async function tryRefreshAccessToken(): Promise<boolean> {
  // Already have a usable access token (another tab/request refreshed first).
  if (getAccessToken() && !isAccessTokenExpired()) {
    return true;
  }

  const refreshToken = getRefreshToken();

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        await ensureApiBase();
        const response = await fetch(buildUrl("/auth/refresh"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json()) as ApiResponse<TokenData> | ErrorResponse;
        if (!response.ok || payload.success === false || !payload.data?.access_token) {
          return false;
        }
        setTokens(payload.data.access_token, payload.data.refresh_token);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

/**
 * Foundation HTTP client for all API communication.
 * UI must never access the database directly (DG-01).
 */
export async function apiClient<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const method = (options.method ?? "GET").toUpperCase();
  const coalesce =
    method === "GET" && !options._retried && !options._apiFailover;
  const coalesceKey = coalesce
    ? `${getApiUrl()}|${rewriteHrmsApiPath(path)}|${JSON.stringify(
        clampListPageSize(rewriteHrmsApiPath(path), options.query) ?? {},
      )}`
    : null;
  if (coalesceKey) {
    const existing = getInflight.get(coalesceKey);
    if (existing) return existing as Promise<ApiResponse<T>>;
  }

    const pending = apiClientExecute<T>(path, options);
  if (coalesceKey) {
    getInflight.set(coalesceKey, pending as Promise<ApiResponse<unknown>>);
    void pending.finally(() => {
      getInflight.delete(coalesceKey);
    }).catch(() => undefined);
  }
  return pending;
}

async function apiClientExecute<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const {
    body,
    headers,
    auth = true,
    query,
    _retried,
    _apiFailover,
    _cookieOnly,
    ...rest
  } = options;
  // Prefer a non-expired bearer; otherwise omit so HttpOnly cookie can authenticate.
  if (auth && !_retried && !_cookieOnly && isAccessTokenExpired(getAccessToken())) {
    await tryRefreshAccessToken();
  }
  const token = auth && !_cookieOnly ? getRequestAccessToken() : null;
  const sentBearer = Boolean(token);

  await ensureApiBase();

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    if (!_apiFailover) {
      await failoverApiBase();
      return apiClient<T>(path, { ...options, _apiFailover: true });
    }
    throw new ApiClientError(
      "Cannot reach the API. Confirm the backend is running on port 8000.",
      0,
    );
  }

  let payload: ApiResponse<T> | ErrorResponse;
  try {
    payload = (await response.json()) as ApiResponse<T> | ErrorResponse;
  } catch {
    throw new ApiClientError("Invalid API response", response.status);
  }

  if (auth && response.status === 401 && !_retried) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return apiClient<T>(path, { ...options, _retried: true, _cookieOnly: false });
    }
    // Stale/invalid bearer shadows a still-valid HttpOnly cookie — retry cookie-only.
    if (sentBearer && !_cookieOnly) {
      return apiClient<T>(path, { ...options, _retried: true, _cookieOnly: true });
    }
  }

  if (!response.ok || payload.success === false) {
    const errorPayload = payload as ErrorResponse;
    if (auth && response.status === 401) {
      clearTokens();
    }
    throw new ApiClientError(
      errorPayload.message ?? "API request failed",
      response.status,
      errorPayload.errors ?? [],
    );
  }

  return payload as ApiResponse<T>;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ErrorResponse;
    return payload.message ?? "API request failed";
  } catch {
    return "API request failed";
  }
}

/** Multipart upload. Do not set Content-Type - the browser must supply the boundary. */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options: { _retried?: boolean; _apiFailover?: boolean } = {},
): Promise<ApiResponse<T>> {
  if (!options._retried && isAccessTokenExpired(getAccessToken())) {
    await tryRefreshAccessToken();
  }
  const token = getRequestAccessToken();
  await ensureApiBase();
  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    if (!options._apiFailover) {
      await failoverApiBase();
      return apiUpload<T>(path, formData, { ...options, _apiFailover: true });
    }
    throw new ApiClientError(
      "Cannot reach the API. Confirm the backend is running on port 8000.",
      0,
    );
  }

  if (response.status === 401 && !options._retried) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return apiUpload<T>(path, formData, { _retried: true });
    }
    clearTokens();
  }

  let payload: ApiResponse<T> | ErrorResponse;
  try {
    payload = (await response.json()) as ApiResponse<T> | ErrorResponse;
  } catch {
    throw new ApiClientError("Invalid API response", response.status);
  }

  if (!response.ok || payload.success === false) {
    const errorPayload = payload as ErrorResponse;
    throw new ApiClientError(
      errorPayload.message ?? "API request failed",
      response.status,
      errorPayload.errors ?? [],
    );
  }
  return payload as ApiResponse<T>;
}

export type BlobFetchResult =
  | { kind: "legacy"; externalUrl: string }
  | { kind: "file"; blob: Blob; contentType: string; filename: string };

export async function apiGetBlob(
  path: string,
  query?: RequestOptions["query"],
  options: { _retried?: boolean; _apiFailover?: boolean; baseUrl?: string; timeoutMs?: number } = {},
): Promise<BlobFetchResult> {
  const token = getAccessToken();
  await ensureApiBase();
  const base = options.baseUrl ? options.baseUrl.replace(/\/+$/, "") : getApiUrl();
  const timeoutMs = options.timeoutMs ?? 45_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(buildUrl(path, query, base), {
        method: "GET",
        headers: {
          Accept: "application/pdf,image/jpeg,image/png,application/json,*/*",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ApiClientError(
          "Document download timed out. Please try again.",
          0,
        );
      }
      if (!options._apiFailover) {
        await failoverApiBase();
        return apiGetBlob(path, query, { ...options, _apiFailover: true });
      }
      throw new ApiClientError(
        "Cannot reach the API. Confirm the backend is running on port 8000.",
        0,
      );
    }

    if (response.status === 401 && !options._retried) {
      const refreshed = await tryRefreshAccessToken();
      if (refreshed) {
        return apiGetBlob(path, query, { ...options, _retried: true });
      }
      clearTokens();
      throw new ApiClientError(await parseErrorMessage(response), 401);
    }

    if (!response.ok) {
      throw new ApiClientError(await parseErrorMessage(response), response.status);
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as ApiResponse<{
        is_legacy?: boolean;
        external_url?: string;
      }>;
      const url = payload.data?.external_url;
      if (payload.data?.is_legacy && url) {
        return { kind: "legacy", externalUrl: url };
      }
      throw new ApiClientError(payload.message ?? "Document is not available for preview", 400);
    }

    let blob: Blob;
    try {
      blob = await response.blob();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ApiClientError(
          "Document download timed out. Please try again.",
          0,
        );
      }
      throw err;
    }
    const disposition = response.headers.get("content-disposition") || "";
    const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i.exec(disposition);
    const filename = decodeURIComponent(match?.[1] || match?.[2] || "document");
    return {
      kind: "file",
      blob,
      contentType: response.headers.get("content-type") || blob.type || "application/octet-stream",
      filename,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const healthService = {
  check: () => apiClient<Record<string, string>>("/health", { auth: false }),
};

export const authService = {
  /** `userId` is a work email or HRMS employee code. */
  login: (userId: string, password: string) =>
    apiClient<TokenData>(
      "/auth/login",
      {
        method: "POST",
        auth: false,
        body: { user_id: userId, password },
      },
    ).then((res) => {
      if (res.data?.access_token) {
        setTokens(res.data.access_token, res.data.refresh_token);
      }
      return res;
    }),
  me: () => apiClient<UserProfile>("/auth/me"),
  logout: async () => {
    try {
      await apiClient<null>("/auth/logout", { method: "POST" });
    } finally {
      clearTokens();
    }
  },
  forgotPassword: (userId: string) =>
    apiClient<null>("/auth/password/forgot", {
      method: "POST",
      auth: false,
      body: { user_id: userId },
    }),
  resetPassword: (token: string, newPassword: string) =>
    apiClient<null>("/auth/password/reset", {
      method: "POST",
      auth: false,
      body: { token, new_password: newPassword },
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient<null>("/auth/password/change", {
      method: "POST",
      body: { current_password: currentPassword, new_password: newPassword },
    }),
};

export const contextService = {
  getContext: () =>
    apiClient<{
      tenant_id: string | null;
      user_id: string | null;
      company_id: string | null;
      branch_id: string | null;
      user_type?: string | null;
    }>("/auth/context"),
  listCompanies: () =>
    apiClient<
      Array<{
        id: string;
        company_code: string;
        company_name: string;
        legal_name?: string;
        status?: string;
      }>
    >("/auth/context/companies"),
  listBranches: (companyId: string) =>
    apiClient<OrgBranchOption[]>("/auth/context/branches", {
      query: { company_id: companyId },
    }),
  switchContext: (body: {
    company_id?: string | null;
    branch_id?: string | null;
    all_companies?: boolean;
  }) =>
    apiClient<{ company_id: string | null; branch_id: string | null; all_companies?: boolean }>(
      "/auth/context/switch",
      {
        method: "POST",
        body: {
          company_id: body.company_id ?? null,
          branch_id: body.branch_id ?? null,
          all_companies: body.all_companies ?? false,
        },
      },
    ),
};

export type ListQuery = Record<string, string | number | boolean | null | undefined>;

export const resourceService = {
  list: <T = Record<string, unknown>>(apiPath: string, query?: ListQuery) =>
    apiClient<T[] | T>(apiPath, { method: "GET", query }),

  get: <T = Record<string, unknown>>(apiPath: string, id: string) =>
    apiClient<T>(`${apiPath}/${id}`, { method: "GET" }),

  create: <T = Record<string, unknown>>(apiPath: string, body: unknown) =>
    apiClient<T>(apiPath, { method: "POST", body }),

  update: <T = Record<string, unknown>>(apiPath: string, id: string, body: unknown) =>
    apiClient<T>(`${apiPath}/${id}`, { method: "PATCH", body }),

  delete: <T = null>(apiPath: string, id: string) =>
    apiClient<T>(`${apiPath}/${id}`, { method: "DELETE" }),

  /** POST `/{apiPath}/{id}/{action}` - e.g. submit, approve, post, reverse */
  action: <T = Record<string, unknown>>(
    apiPath: string,
    id: string,
    action: string,
    body?: unknown,
  ) =>
    apiClient<T>(`${apiPath}/${id}/${action}`, {
      method: "POST",
      body: body ?? {},
    }),
};

/** Download a binary/file endpoint (CSV/PDF export). */
export async function downloadApiFile(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
  fallbackName = "export.bin",
  _retried = false,
  _apiFailover = false,
): Promise<void> {
  const token = getAccessToken();
  await ensureApiBase();
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method: "GET",
      headers: {
        Accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });
  } catch {
    if (!_apiFailover) {
      await failoverApiBase();
      return downloadApiFile(path, query, fallbackName, _retried, true);
    }
    throw new ApiClientError(
      "Cannot reach the API. Confirm the backend is running on port 8000.",
      0,
    );
  }

  if (response.status === 401 && !_retried) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return downloadApiFile(path, query, fallbackName, true, _apiFailover);
    }
    clearTokens();
    throw new ApiClientError("Session expired. Please sign in again.", 401);
  }

  if (!response.ok) {
    let message = "Download failed";
    try {
      const payload = (await response.json()) as ErrorResponse;
      message = payload.message ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiClientError(message, response.status);
  }
  const blob = await response.blob();
  const cd = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(cd);
  const filename = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
