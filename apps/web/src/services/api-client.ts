import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/auth";
import { env } from "@/utils/env";
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

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Internal: skip one refresh retry to avoid loops. */
  _retried?: boolean;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = `${env.apiUrl}${path}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function fallbackMessage(status: number): string {
  if (status === 401) return "Please sign in again.";
  if (status === 403) return "You do not have permission to view this.";
  if (status === 404) return "API resource not found.";
  if (status >= 500) return "The API had an internal error. Check the backend terminal.";
  if (status === 0) return "Cannot reach the API. Confirm the backend is running on port 8000.";
  return "API request failed";
}

function messageFromPayload(payload: unknown, status: number): string {
  if (!payload || typeof payload !== "object") return fallbackMessage(status);
  const body = payload as Record<string, unknown>;
  if (typeof body.message === "string" && body.message.trim()) return body.message;
  if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
  if (Array.isArray(body.detail)) {
    const parts = body.detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join("; ");
  }
  return fallbackMessage(status);
}

function errorsFromPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const errors = (payload as ErrorResponse).errors;
  return Array.isArray(errors) ? errors : [];
}

async function parseResponsePayload<T>(
  response: Response,
): Promise<ApiResponse<T> | ErrorResponse> {
  const text = await response.text();
  if (!text.trim()) {
    return { success: false, message: fallbackMessage(response.status), errors: [] };
  }
  try {
    return JSON.parse(text) as ApiResponse<T> | ErrorResponse;
  } catch {
    const looksHtml = /<!DOCTYPE|<html/i.test(text);
    return {
      success: false,
      message: looksHtml
        ? fallbackMessage(response.status >= 400 ? response.status : 500)
        : text.replace(/\s+/g, " ").slice(0, 180),
      errors: [],
    };
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(buildUrl("/auth/refresh"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
          cache: "no-store",
        });
        const payload = await parseResponsePayload<TokenData>(response);
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
  const { body, headers, auth = true, query, _retried, ...rest } = options;
  const token = auth ? getAccessToken() : null;

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
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError(
      "Cannot reach the API. Confirm the backend is running on port 8000.",
      0,
    );
  }

  const payload = await parseResponsePayload<T>(response);

  if (
    auth &&
    !_retried &&
    response.status === 401 &&
    messageFromPayload(payload, response.status)
  ) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return apiClient<T>(path, { ...options, _retried: true });
    }
  }

  if (!response.ok || payload.success === false) {
    if (auth && response.status === 401) {
      clearTokens();
    }
    throw new ApiClientError(
      messageFromPayload(payload, response.status),
      response.status,
      errorsFromPayload(payload),
    );
  }

  return payload as ApiResponse<T>;
}

async function parseErrorMessage(response: Response): Promise<string> {
  const payload = await parseResponsePayload(response);
  return messageFromPayload(payload, response.status);
}

/** Multipart upload. Do not set Content-Type — the browser must supply the boundary. */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options: { _retried?: boolean } = {},
): Promise<ApiResponse<T>> {
  const token = getAccessToken();
  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
      cache: "no-store",
    });
  } catch {
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

  const payload = await parseResponsePayload<T>(response);

  if (!response.ok || payload.success === false) {
    throw new ApiClientError(
      messageFromPayload(payload, response.status),
      response.status,
      errorsFromPayload(payload),
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
  options: { _retried?: boolean } = {},
): Promise<BlobFetchResult> {
  const token = getAccessToken();
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method: "GET",
      headers: {
        Accept: "application/pdf,image/jpeg,image/png,application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError(
      "Cannot reach the API. Confirm the backend is running on port 8000.",
      0,
    );
  }

  if (response.status === 401 && !options._retried) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return apiGetBlob(path, query, { _retried: true });
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

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i.exec(disposition);
  const filename = decodeURIComponent(match?.[1] || match?.[2] || "document");
  return {
    kind: "file",
    blob,
    contentType: response.headers.get("content-type") || blob.type || "application/octet-stream",
    filename,
  };
}

export const healthService = {
  check: () => apiClient<Record<string, string>>("/health", { auth: false }),
};

export const authService = {
  login: (email: string, password: string) =>
    apiClient<TokenData>(
      "/auth/login",
      {
        method: "POST",
        auth: false,
        body: { email, password },
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
  microsoftConfig: () =>
    apiClient<{ enabled: boolean; authorization_path: string }>("/auth/microsoft/config", {
      auth: false,
    }),
  microsoftLoginUrl: (returnTo = "/") => {
    const path = `/auth/microsoft/login?return_to=${encodeURIComponent(returnTo)}`;
    return `${env.apiUrl}${path}`;
  },
  exchangeMicrosoftCode: (code: string) =>
    apiClient<TokenData>("/auth/microsoft/exchange", {
      method: "POST",
      auth: false,
      body: { code },
    }).then((res) => {
      if (res.data?.access_token) {
        setTokens(res.data.access_token, res.data.refresh_token);
      }
      return res;
    }),
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

  /** POST `/{apiPath}/{id}/{action}` — e.g. submit, approve, post, reverse */
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
