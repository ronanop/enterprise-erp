function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableHttpStatus(status: number): boolean {
  // 500: Next.js rewrite often returns plain "Internal Server Error" when
  // the API proxy gets ECONNRESET during uvicorn --reload.
  return status === 500 || status === 502 || status === 503 || status === 504;
}

async function shouldRetryResponse(
  response: Response,
  idempotent: boolean,
): Promise<boolean> {
  if (!idempotent || !isRetryableHttpStatus(response.status)) return false;
  if (response.status !== 500) return true;
  // Only retry plain/non-JSON 500s (proxy blips), not structured API errors.
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return false;
  try {
    const clone = response.clone();
    const text = (await clone.text()).trim();
    return (
      text.length === 0 ||
      text === "Internal Server Error" ||
      text.startsWith("<")
    );
  } catch {
    return true;
  }
}

/** GET-safe retry for dev proxy blips (ECONNRESET) and brief API/DB outages. */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: { attempts?: number; baseDelayMs?: number },
): Promise<Response> {
  const attempts = options?.attempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 400;
  const method = (init?.method ?? "GET").toUpperCase();
  const idempotent = method === "GET" || method === "HEAD";

  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, init);
      if (
        attempt < attempts - 1 &&
        (await shouldRetryResponse(response, idempotent))
      ) {
        await sleep(baseDelayMs * (attempt + 1));
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        await sleep(baseDelayMs * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}
