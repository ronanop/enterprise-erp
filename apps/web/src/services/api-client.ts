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
    payload = (await response.json()) as ApiResponse<T> | ErrorResponse;
  } catch {
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
