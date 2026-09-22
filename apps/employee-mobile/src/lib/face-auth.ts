import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const FACE_VERIFIED_KEY = "ess_face_verified_at";
const FACE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

let faceVerifiedAt: number | null = null;
let hydrated = false;

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") return AsyncStorage.getItem(key);
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
    // ignore
  }
}

export async function hydrateFaceAuth(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await getItem(FACE_VERIFIED_KEY);
    faceVerifiedAt = raw ? Number(raw) : null;
    if (faceVerifiedAt !== null && !Number.isFinite(faceVerifiedAt)) {
      faceVerifiedAt = null;
    }
  } catch {
    faceVerifiedAt = null;
  }
  hydrated = true;
}

export async function markFaceVerified(): Promise<void> {
  faceVerifiedAt = Date.now();
  await setItem(FACE_VERIFIED_KEY, String(faceVerifiedAt));
}

export async function clearFaceVerified(): Promise<void> {
  faceVerifiedAt = null;
  await deleteItem(FACE_VERIFIED_KEY);
}

export function isFaceVerified(): boolean {
  if (faceVerifiedAt === null) return false;
  return Date.now() - faceVerifiedAt < FACE_TTL_MS;
}
