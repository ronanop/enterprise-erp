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

/** Surface API validation lines and non-ApiClientError messages in forms. */
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
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = env.apiUrl.replace(/\/$/, "");
  const url = `${base}${normalizedPath}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

function messageFromUnknownPayload(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  if (record.success === false && typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }
  if (typeof record.detail === "string" && record.detail.trim()) {
    return record.detail.trim();
  }
  if (Array.isArray(record.detail)) {
    const parts = record.detail
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const row = item as Record<string, unknown>;
        const msg = typeof row.msg === "string" ? row.msg : "";
        const loc = Array.isArray(row.loc) ? row.loc.map(String).join(".") : "";
        return loc && msg ? `${loc}: ${msg}` : msg || loc;
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join("; ");
  }
  if (Array.isArray(record.errors) && record.errors.length > 0) {
    return record.errors.map(String).join("; ");
  }
  return fallback;
}

async function parseJsonResponse<T>(
  response: Response,
): Promise<ApiResponse<T> | ErrorResponse> {
  const text = await response.text();
  if (!text.trim()) {
    if (response.status === 401) {
      return { success: false, message: "Session expired. Sign in again.", errors: [] };
    }
    throw new ApiClientError(
      response.ok
        ? "Empty API response"
        : `API request failed (${response.status})`,
      response.status,
    );
  }
  try {
    return JSON.parse(text) as ApiResponse<T> | ErrorResponse;
  } catch {
    const snippet = text.trimStart().slice(0, 80).toLowerCase();
    if (snippet.startsWith("<!doctype") || snippet.startsWith("<html")) {
      throw new ApiClientError(
        "Received a web page instead of API data. Check NEXT_PUBLIC_API_URL is /api/v1 and the API is running.",
        response.status,
      );
    }
    try {
      const partial = JSON.parse(text) as unknown;
      const detail = messageFromUnknownPayload(partial, "");
      if (detail) {
        throw new ApiClientError(detail, response.status);
      }
    } catch (inner) {
      if (inner instanceof ApiClientError) throw inner;
    }
    if (text.trim().toLowerCase() === "internal server error") {
      throw new ApiClientError(
        "Internal server error. Restart the ERP API (port 8000) and try again.",
        response.status,
      );
    }
    const preview = text.trim().replace(/\s+/g, " ").slice(0, 120);
    throw new ApiClientError(
      preview
        ? `Invalid API response (${response.status}): ${preview}`
        : `Invalid API response (${response.status})`,
      response.status,
    );
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
        const payload = await parseJsonResponse<TokenData>(response);
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

  const response = await fetch(buildUrl(path, query), {
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

  let payload: ApiResponse<T> | ErrorResponse;
  try {
    payload = await parseJsonResponse<T>(response);
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new ApiClientError("Invalid API response", response.status);
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
    const fallbackMessage =
      response.status === 404
        ? "API route not found. Restart the ERP API on port 8000 after pulling or changing backend code."
        : "API request failed";
    throw new ApiClientError(
      messageFromUnknownPayload(errorPayload, errorPayload.message ?? fallbackMessage),
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
