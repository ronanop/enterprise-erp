function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/** GET-safe retry for dev proxy blips (ECONNRESET) and brief API/DB outages. */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: { attempts?: number; baseDelayMs?: number },
): Promise<Response> {
  const attempts = options?.attempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 350;
  const method = (init?.method ?? "GET").toUpperCase();
  const idempotent = method === "GET" || method === "HEAD";

  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, init);
      if (
        idempotent &&
        isRetryableHttpStatus(response.status) &&
        attempt < attempts - 1
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
