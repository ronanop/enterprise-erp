/** HRMS HTTP prefix shown in the Network tab. UI routes remain /hr/*. */

export const HRMS_API_PREFIX = "/hrms";

/** Map legacy `/hr/...` API paths to `/hrms/...` (UI hrefs are unchanged). */
export function rewriteHrmsApiPath(path: string): string {
  if (path === "/hr" || path.startsWith("/hr/")) {
    return `${HRMS_API_PREFIX}${path.slice(3)}`;
  }
  return path;
}

export function clampListPageSize(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean | null | undefined> | undefined {
  if (!query || query.page_size == null || query.page_size === "") return query;
  const n = Number(query.page_size);
  if (!Number.isFinite(n)) return query;
  const max = path.startsWith("/finance") ? 1000 : 200;
  if (n > max) {
    return { ...query, page_size: max };
  }
  return query;
}
