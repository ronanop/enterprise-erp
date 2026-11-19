import { clearTokens, getAccessToken, setTokens } from "@/lib/auth";
import { mockApi } from "@/data/mock-ess";
import type {
  ApiResponse,
  ErrorResponse,
  TokenData,
  UserProfile,
} from "@/types/api";
import { env } from "@/utils/env";

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

export async function apiClient<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const { body, headers, auth = true, query, ...rest } = options;
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
      "Cannot reach the API. Check that the ERP server is running.",
      0,
    );
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

export const authService = {
  login: async (email: string, password: string) => {
    if (env.useMock) {
      try {
        const res = await mockApi.login(email, password);
        if (res.data?.access_token) {
          setTokens(res.data.access_token, res.data.refresh_token ?? undefined);
        }
        return res;
      } catch (err) {
        throw new ApiClientError(
          err instanceof Error ? err.message : "Login failed",
          400,
        );
      }
    }

    return apiClient<TokenData>("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    }).then((res) => {
      if (res.data?.access_token) {
        setTokens(res.data.access_token, res.data.refresh_token ?? undefined);
      }
      return res;
    });
  },

  me: () =>
    env.useMock
      ? mockApi.meProfile()
      : apiClient<UserProfile>("/auth/me"),

  logout: async () => {
    try {
      if (env.useMock) {
        await mockApi.logout();
      } else {
        await apiClient<null>("/auth/logout", { method: "POST" });
      }
    } catch {
      // Offline / expired token — still sign out locally.
    } finally {
      clearTokens();
    }
  },
};
