import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/auth";
import { env, preferApiFallback, resolveApiUrl } from "@/utils/env";
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
  /** Internal: already tried API URL fallback. */
  _urlFallbackTried?: boolean;
};

function buildUrl(path: string, query?: RequestOptions["query"], baseUrl?: string): string {
  const base = `${baseUrl ?? env.apiUrl}${path}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const apiBase = await resolveApiUrl();
        const response = await fetch(buildUrl("/auth/refresh", undefined, apiBase), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
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
  const { body, headers, auth = true, query, _retried, _urlFallbackTried, ...rest } = options;
  const token = auth ? getAccessToken() : null;
  const apiBase = await resolveApiUrl();

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query, apiBase), {
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
    if (!_urlFallbackTried && env.apiUrlFallback) {
      preferApiFallback();
      return apiClient<T>(path, { ...options, _urlFallbackTried: true });
    }
    throw new ApiClientError(
      "Cannot reach the API. Confirm the backend is running on port 8000.",
      0,
    );
  }

  const rawBody = await response.text();
  let payload: ApiResponse<T> | ErrorResponse;
  try {
    payload = JSON.parse(rawBody) as ApiResponse<T> | ErrorResponse;
  } catch {
    const looksLikeHtml = /^\s*</.test(rawBody);
    throw new ApiClientError(
      looksLikeHtml
        ? "API returned HTML instead of JSON. Check NEXT_PUBLIC_API_URL points at the backend (port 8000)."
        : "Invalid API response",
      response.status,
    );
  }

  if (
    auth &&
    !_retried &&
    response.status === 401 &&
    (payload as ErrorResponse).message
  ) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return apiClient<T>(path, { ...options, _retried: true });
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
  microsoftLoginUrl: async (returnTo = "/organization") => {
    const base = await resolveApiUrl();
    const path = `/auth/microsoft/login?return_to=${encodeURIComponent(returnTo)}`;
    return `${base}${path}`;
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

/** Download a binary/file endpoint (CSV/PDF export). */
export async function downloadApiFile(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
  fallbackName = "export.bin",
  _retried = false,
): Promise<void> {
  const token = getAccessToken();
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
    throw new ApiClientError(
      "Cannot reach the API. Confirm the backend is running on port 8000.",
      0,
    );
  }

  if (response.status === 401 && !_retried) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return downloadApiFile(path, query, fallbackName, true);
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
