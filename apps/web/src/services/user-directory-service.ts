import { ApiClientError, resourceService } from "@/services/api-client";

export type UserDirectory = Record<string, string>;

let cache: UserDirectory | null = null;
let inflight: Promise<UserDirectory> | null = null;
let denied = false;

function displayName(row: Record<string, unknown>): string {
  const candidates = [row.display_name, row.full_name, row.name, row.email];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

/** GET /users once per session. Skip when the role cannot read the user catalog. */
export async function loadUserDirectory(allowed: boolean): Promise<UserDirectory> {
  if (!allowed || denied) return cache ?? {};
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await resourceService.list("/users");
      const list = Array.isArray(res.data) ? res.data : [];
      const map: UserDirectory = {};
      for (const row of list) {
        const r = row as Record<string, unknown>;
        const id = String(r.id ?? "");
        if (!id) continue;
        map[id] = displayName(r) || id.slice(0, 8);
      }
      cache = map;
      return map;
    } catch (err) {
      if (err instanceof ApiClientError && (err.status === 403 || err.status === 401)) {
        denied = true;
      }
      cache = {};
      return cache;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
