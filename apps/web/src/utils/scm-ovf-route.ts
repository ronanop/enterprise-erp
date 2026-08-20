const OVF_PATH_RE =
  /\/procurement\/scm\/ovf\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/(?:po|from-stock))?\/?$/i;

/** OVF id from rewrite query or from `/procurement/scm/ovf/{id}` in the browser URL. */
export function resolveScmOvfIdFromUrl(
  pathname: string,
  searchParams: Pick<URLSearchParams, "get"> | null,
): string {
  const fromQuery = searchParams?.get("ovfId")?.trim();
  if (fromQuery) return fromQuery;
  const match = pathname.match(OVF_PATH_RE);
  return match?.[1] ?? "";
}
