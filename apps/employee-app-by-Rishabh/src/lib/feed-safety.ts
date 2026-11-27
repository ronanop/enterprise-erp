import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Local UGC safety controls for App Store Guideline 2.1 / 1.2:
 * report content + block authors. Persisted on-device so reviewers (and
 * employees) can demonstrate the flows without waiting on HR tooling.
 */

const BLOCKED_KEY = "ess.feed.blockedAuthors.v1";
const REPORTED_KEY = "ess.feed.reportedPosts.v1";

async function readStringSet(key: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

async function writeStringSet(key: string, values: Set<string>): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify([...values]));
}

export async function getBlockedAuthorIds(): Promise<string[]> {
  return [...(await readStringSet(BLOCKED_KEY))];
}

export async function isAuthorBlocked(authorEmployeeId: string): Promise<boolean> {
  const set = await readStringSet(BLOCKED_KEY);
  return set.has(authorEmployeeId);
}

export async function blockAuthor(authorEmployeeId: string): Promise<void> {
  const id = authorEmployeeId.trim();
  if (!id) return;
  const set = await readStringSet(BLOCKED_KEY);
  set.add(id);
  await writeStringSet(BLOCKED_KEY, set);
}

export async function unblockAuthor(authorEmployeeId: string): Promise<void> {
  const set = await readStringSet(BLOCKED_KEY);
  set.delete(authorEmployeeId);
  await writeStringSet(BLOCKED_KEY, set);
}

export async function reportPost(postId: string): Promise<void> {
  const id = postId.trim();
  if (!id) return;
  const set = await readStringSet(REPORTED_KEY);
  set.add(id);
  await writeStringSet(REPORTED_KEY, set);
}

export async function isPostReported(postId: string): Promise<boolean> {
  const set = await readStringSet(REPORTED_KEY);
  return set.has(postId);
}
