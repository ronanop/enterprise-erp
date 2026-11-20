import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Button } from "@/components/ui";
import { IconClose, IconLocation } from "@/components/icons";
import {
  evaluateWorkGeofence,
  matchWorkLocationLabel,
  requestPunchCoords,
  type LiveCoords,
  type WorkLocationFence,
} from "@/lib/live-location";
import type { EssPunchPolicy } from "@/types/api";
import { colors } from "@/theme/colors";

export type PunchConfirmPayload = {
  imageBase64: string | null;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
};

/** Native port of web AttendancePunchSheet (GPS + geofence + selfie). */
export function AttendancePunchSheet({
  open,
  kind,
  policy,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  kind: "in" | "out";
  policy: EssPunchPolicy | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: (payload: PunchConfirmPayload) => void;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [coords, setCoords] = useState<LiveCoords | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [gpsError, setGpsError] = useState<string | null>(null);

  const needCamera = Boolean(
    policy?.selfie_required || policy?.face_at_punch_required,
  );
  const workLocations = (policy?.work_locations ?? []) as WorkLocationFence[];
  const homeOfficeName = policy?.home_office_name ?? null;
  const fencesConfigured = workLocations.some((loc) => {
    const radius = Number(loc.geofence_radius_meters);
    return (
      Number.isFinite(radius) &&
      radius > 0 &&
      Number.isFinite(Number(loc.latitude)) &&
      Number.isFinite(Number(loc.longitude))
    );
  });
  const requireGps =
    kind === "out"
      ? false
      : Boolean(policy?.geofence_required) || fencesConfigured;

  const fence = useMemo(() => {
    if (!coords) return null;
    return evaluateWorkGeofence(coords, workLocations);
  }, [coords, workLocations]);

  const outsideFence =
    kind === "in" && fencesConfigured && coords != null && fence != null
      ? !fence.inside
      : false;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setImage(null);
    setCoords(null);
    setLocationLabel(homeOfficeName || "Detecting…");
    setGpsError(null);
    setGpsStatus("loading");

    (async () => {
      try {
        const next = await requestPunchCoords({ required: requireGps });
        if (cancelled) return;
        if (!next) {
          setGpsStatus(requireGps ? "error" : "ok");
          setGpsError(
            requireGps
              ? "Could not read GPS. Enable location and try again."
              : null,
          );
          setLocationLabel(homeOfficeName || "Office");
          return;
        }
        setCoords(next);
        const matched =
          matchWorkLocationLabel(next, workLocations, homeOfficeName) ||
          homeOfficeName ||
          "Current location";
        setLocationLabel(matched);
        setGpsStatus("ok");
      } catch (err) {
        if (cancelled) return;
        setGpsStatus("error");
        setGpsError(
          err instanceof Error ? err.message : "Could not read GPS location.",
        );
        setLocationLabel(homeOfficeName || "Location unavailable");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, requireGps, homeOfficeName, workLocations]);

  async function captureSelfie() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setGpsError("Camera permission is required for selfie punch.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setImage(result.assets[0].base64);
    }
  }

  const canConfirm =
    !loading &&
    gpsStatus !== "loading" &&
    !(requireGps && (gpsStatus === "error" || !coords)) &&
    !outsideFence &&
    !(needCamera && !image);

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!loading) onClose();
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>
              {kind === "in" ? "Check in" : "Check out"}
            </Text>
            <Pressable
              accessibilityLabel="Close"
              disabled={loading}
              onPress={onClose}
              hitSlop={8}
            >
              <IconClose size={22} color="#0b1c30" />
            </Pressable>
          </View>

          <View style={styles.locRow}>
            <IconLocation size={18} color="#004ac6" />
            <View style={{ flex: 1 }}>
              <Text style={styles.locLabel}>
                {gpsStatus === "loading"
                  ? "Detecting location…"
                  : locationLabel || "Office"}
              </Text>
              {fence?.distanceMeters != null ? (
                <Text style={styles.locMeta}>
                  {fence.inside
                    ? `Inside fence · ${fence.distanceMeters}m`
                    : `Outside fence · ${fence.distanceMeters}m`}
                </Text>
              ) : null}
            </View>
          </View>

          {gpsError ? <Text style={styles.error}>{gpsError}</Text> : null}
          {outsideFence ? (
            <Text style={styles.error}>
              You are outside the office geofence. Move closer to check in.
            </Text>
          ) : null}

          {needCamera ? (
            <Button
              title={image ? "Selfie captured ✓" : "Take selfie"}
              variant="secondary"
              onPress={() => void captureSelfie()}
            />
          ) : (
            <Text style={styles.copy}>
              Confirm punch
              {requireGps ? " at your work location" : ""}.
            </Text>
          )}

          <View style={styles.actions}>
            <Button
              title="Cancel"
              variant="secondary"
              disabled={loading}
              onPress={onClose}
              style={{ flex: 1 }}
            />
            <Button
              title={kind === "in" ? "Confirm check in" : "Confirm check out"}
              loading={loading}
              disabled={!canConfirm}
              onPress={() =>
                onConfirm({
                  imageBase64: image,
                  latitude: coords?.latitude ?? null,
                  longitude: coords?.longitude ?? null,
                  locationLabel,
                })
              }
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(11,28,48,0.45)",
    padding: 16,
  },
  sheet: {
    gap: 14,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    padding: 20,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#0b1c30" },
  locRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    backgroundColor: "#eff4ff",
    padding: 12,
  },
  locLabel: { fontSize: 14, fontWeight: "600", color: "#0b1c30" },
  locMeta: { marginTop: 2, fontSize: 12, color: "#434655" },
  copy: { fontSize: 14, lineHeight: 20, color: "#434655" },
  error: { fontSize: 13, fontWeight: "600", color: "#ba1a1a" },
  actions: { flexDirection: "row", gap: 12 },
});
