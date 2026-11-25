import * as Location from "expo-location";

/**
 * High-accuracy (precise GPS) fix for attendance punch.
 * Requests foreground location if needed; returns empty coords if denied.
 */
export async function readGeolocation(): Promise<{
  latitude?: number;
  longitude?: number;
}> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return {};

    // Prefer precise GPS over coarse / network-only accuracy.
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      mayShowUserSettingsDialog: true,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch {
    return {};
  }
}
