const STORAGE_KEY = "erp.scm.queue.seenOvfIds";
const BOOTSTRAPPED_KEY = "erp.scm.queue.seenBootstrapped";

function readSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0));
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore quota / private mode
  }
}

function isBootstrapped(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(BOOTSTRAPPED_KEY) === "1";
}

function markBootstrapped(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BOOTSTRAPPED_KEY, "1");
  } catch {
    // ignore
  }
}

/** First load: treat current queue as already seen so only future arrivals notify. */
export function bootstrapScmQueueSeen(ovfIds: string[]): void {
  if (typeof window === "undefined") return;
  if (isBootstrapped()) return;
  const next = new Set(readSeen());
  for (const id of ovfIds) {
    if (id) next.add(id);
  }
  writeSeen(next);
  markBootstrapped();
}

export function getUnseenScmOvfIds(ovfIds: string[]): string[] {
  if (typeof window === "undefined") return [];
  bootstrapScmQueueSeen(ovfIds);
  const seen = readSeen();
  return ovfIds.filter((id) => id && !seen.has(id));
}

/** Mark queue OVFs as seen (clears dashboard notification on next check). */
export function markScmQueueSeen(ovfIds: string[]): void {
  if (typeof window === "undefined") return;
  const next = readSeen();
  for (const id of ovfIds) {
    if (id) next.add(id);
  }
  writeSeen(next);
  markBootstrapped();
  try {
    window.dispatchEvent(new Event("erp:scm-queue-seen"));
  } catch {
    // ignore
  }
}

export function isScmOvfUnseen(ovfId: string): boolean {
  if (!ovfId || typeof window === "undefined") return false;
  return !readSeen().has(ovfId) && isBootstrapped();
}
