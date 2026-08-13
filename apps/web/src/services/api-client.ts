import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  redirectToLogin,
  setTokens,
} from "@/lib/auth";
import { env } from "@/utils/env";
import { fetchWithRetry } from "@/lib/fetch-retry";
import { clearStoredOrgContext } from "@/lib/org-context-storage";
import type { ApiResponse, ErrorResponse, TokenData, UserProfile } from "@/types/api";
import type {
  OrgBranchOption,
  OrgCompanyOption,
  OrgSessionContext,
} from "@/types/org-context";

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
  /** Internal: skip refresh retry after a 401. */
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

/** Single in-flight refresh so parallel 401s share one token rotation. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetchWithRetry(buildUrl("/auth/refresh"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
      });

      let payload: ApiResponse<TokenData> | ErrorResponse;
      try {
        payload = (await response.json()) as ApiResponse<TokenData> | ErrorResponse;
      } catch {
        clearTokens();
        return false;
      }

      const data = "data" in payload ? payload.data : null;
      if (!response.ok || payload.success === false || !data?.access_token) {
        clearTokens();
        return false;
      }

      setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      clearTokens();
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

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
  const { body, headers, auth = true, query, _retried = false, ...rest } = options;
  const token = auth ? getAccessToken() : null;

  if (auth && !token) {
    clearTokens();
    redirectToLogin();
    throw new ApiClientError("No active session. Please sign in.", 401);
  }

  let response: Response;
  try {
    response = await fetchWithRetry(buildUrl(path, query), {
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
      "Cannot reach API. Check that the backend is running on port 8000.",
      0,
    );
  }

  if (response.status === 401 && auth) {
    if (!_retried) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiClient<T>(path, { ...options, _retried: true });
      }
    }
    clearTokens();
    redirectToLogin();
    throw new ApiClientError("Session expired. Please sign in again.", 401);
  }

  let payload: ApiResponse<T> | ErrorResponse;
  try {
    payload = (await response.json()) as ApiResponse<T> | ErrorResponse;
  } catch {
    const hint =
      response.status >= 500
        ? `Server error (${response.status}). Check that the API is running and try again.`
        : response.status === 0 || !response.status
          ? "Cannot reach API. Check that the backend is running on port 8000."
          : `Invalid API response (${response.status})`;
    throw new ApiClientError(hint, response.status);
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
      clearStoredOrgContext();
      clearTokens();
    }
  },
};

export const contextService = {
  getContext: () => apiClient<OrgSessionContext>("/auth/context"),
  listCompanies: () => apiClient<OrgCompanyOption[]>("/auth/context/companies"),
  listBranches: (companyId: string) =>
    apiClient<OrgBranchOption[]>("/auth/context/branches", {
      query: { company_id: companyId },
    }),
  switchContext: (body: { company_id: string; branch_id?: string | null }) =>
    apiClient<{ company_id: string; branch_id: string | null }>("/auth/context/switch", {
      method: "POST",
      body: {
        company_id: body.company_id,
        branch_id: body.branch_id ?? null,
      },
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
  if (!token) {
    clearTokens();
    redirectToLogin();
    throw new ApiClientError("No active session. Please sign in.", 401);
  }

  let response: Response;
  try {
    response = await fetchWithRetry(buildUrl(path, query), {
      method: "GET",
      headers: {
        Accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError(
      "Cannot reach API. Check that the backend is running on port 8000.",
      0,
    );
  }

  if (response.status === 401) {
    if (!_retried) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return downloadApiFile(path, query, fallbackName, true);
      }
    }
    clearTokens();
    redirectToLogin();
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
