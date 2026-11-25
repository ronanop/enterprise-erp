import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { getAccessToken } from "@/lib/auth";
import { apiClientBytes } from "@/services/api-client";
import { env } from "@/utils/env";

const uriCache = new Map<string, string>();

/** Resolve an authenticated feed media path to a local/blob URI for Image/Video. */
export async function resolveFeedMediaUri(
  apiPath: string,
  mediaId: string,
): Promise<string> {
  const cached = uriCache.get(mediaId);
  if (cached) return cached;

  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;

  if (Platform.OS === "web") {
    const bytes = await apiClientBytes(path);
    const copy = new Uint8Array(bytes);
    const blob = new Blob([copy.buffer], { type: "application/octet-stream" });
    const objectUrl = URL.createObjectURL(blob);
    uriCache.set(mediaId, objectUrl);
    return objectUrl;
  }

  const token = getAccessToken();
  const dest = `${FileSystem.cacheDirectory}ess-feed-${mediaId}`;
  const result = await FileSystem.downloadAsync(
    `${env.apiUrl}${path}`,
    dest,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Media download failed (${result.status})`);
  }
  uriCache.set(mediaId, result.uri);
  return result.uri;
}

export function aspectToStyle(ratio: string): { aspectRatio: number } {
  switch (ratio) {
    case "3:4":
      return { aspectRatio: 3 / 4 };
    case "4:3":
      return { aspectRatio: 4 / 3 };
    case "1:1":
    default:
      return { aspectRatio: 1 };
  }
}

export function aspectTuple(ratio: string): [number, number] {
  switch (ratio) {
    case "3:4":
      return [3, 4];
    case "4:3":
      return [4, 3];
    case "1:1":
    default:
      return [1, 1];
  }
}
