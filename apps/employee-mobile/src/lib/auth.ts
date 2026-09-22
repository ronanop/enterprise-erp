import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/** Prefer SecureStore on native; AsyncStorage on web (SecureStore unsupported). */

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore missing keys
  }
}

const ACCESS_TOKEN_KEY = "ess_access_token";
const REFRESH_TOKEN_KEY = "ess_refresh_token";

let accessTokenCache: string | null = null;
let refreshTokenCache: string | null = null;
let hydrated = false;

export async function hydrateAuth(): Promise<void> {
  if (hydrated) return;
  try {
    accessTokenCache = await getItem(ACCESS_TOKEN_KEY);
    refreshTokenCache = await getItem(REFRESH_TOKEN_KEY);
  } catch {
    accessTokenCache = null;
    refreshTokenCache = null;
  }
  hydrated = true;
}

export function getAccessToken(): string | null {
  return accessTokenCache;
}

export function getRefreshToken(): string | null {
  return refreshTokenCache;
}

export async function setTokens(
  accessToken: string,
  refreshToken?: string,
): Promise<void> {
  accessTokenCache = accessToken;
  await setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    refreshTokenCache = refreshToken;
    await setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export async function clearTokens(): Promise<void> {
  accessTokenCache = null;
  refreshTokenCache = null;
  await deleteItem(ACCESS_TOKEN_KEY);
  await deleteItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(accessTokenCache);
}
