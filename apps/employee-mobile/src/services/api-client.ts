import { clearTokens, getAccessToken, setTokens } from "@/lib/auth";
import { clearFaceVerified } from "@/lib/face-auth";
import { fetchWithRetry } from "@/lib/fetch-retry";
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
    response = await fetchWithRetry(buildUrl(path, query), {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers as Record<string, string> | undefined),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiClientError(
      "Cannot reach the API. Check that the ERP server is running and EXPO_PUBLIC_API_URL is correct.",
      0,
    );
  }

  const text = await response.text();
  let payload: ApiResponse<T> | ErrorResponse;
  try {
    payload = (
      text
        ? JSON.parse(text)
        : { success: false, message: "Empty API response" }
    ) as ApiResponse<T> | ErrorResponse;
  } catch {
    const preview = text.trim().slice(0, 120);
    const hint = preview.startsWith("<")
      ? "Server returned HTML (check API URL)."
      : preview || `HTTP ${response.status}`;
    throw new ApiClientError(`Invalid API response: ${hint}`, response.status);
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

export async function apiClientBytes(path: string): Promise<Uint8Array> {
  const token = getAccessToken();
  let response: Response;
  try {
    response = await fetchWithRetry(buildUrl(path), {
      method: "GET",
      headers: {
        Accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new ApiClientError(
      "Cannot reach the API. Check that the ERP server is running.",
      0,
    );
  }
  if (!response.ok) {
    throw new ApiClientError(
      `Download failed (HTTP ${response.status})`,
      response.status,
    );
  }
  const buf = await response.arrayBuffer();
  return new Uint8Array(buf);
}

export const authService = {
  login: async (email: string, password: string) => {
    if (env.useMock) {
      try {
        const res = await mockApi.login(email, password);
        if (res.data?.access_token) {
          await setTokens(
            res.data.access_token,
            res.data.refresh_token ?? undefined,
          );
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
    }).then(async (res) => {
      if (res.data?.access_token) {
        await setTokens(
          res.data.access_token,
          res.data.refresh_token ?? undefined,
        );
      }
      return res;
    });
  },

  essLogin: async (body: {
    company_code: string;
    employee_code: string;
    password: string;
    captcha_id?: string;
    captcha_answer?: string;
  }) =>
    apiClient<TokenData>("/auth/ess/login", {
      method: "POST",
      auth: false,
      body,
    }).then(async (res) => {
      if (res.data?.access_token) {
        await setTokens(
          res.data.access_token,
          res.data.refresh_token ?? undefined,
        );
      }
      return res;
    }),

  me: () =>
    env.useMock ? mockApi.meProfile() : apiClient<UserProfile>("/auth/me"),

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
      await clearTokens();
      await clearFaceVerified();
    }
  },
};
