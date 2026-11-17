"use client";

import { useEffect, useMemo, useState } from "react";
import { FaceCapture } from "@/components/face-capture";
import { IconClose, IconLocation } from "@/components/icons";
import {
  evaluateWorkGeofence,
  geolocationBlockedReason,
  matchWorkLocationLabel,
  requestPunchCoords,
  type LiveCoords,
  type WorkLocationFence,
} from "@/lib/live-location";
import type { EssPunchPolicy } from "@/types/api";
import * as ui from "@/theme/classes";

export type PunchConfirmPayload = {
  imageBase64: string | null;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
};

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
  /** Check-in requires GPS when HRMS has a fence or the attendance rule says so. */
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

    const blocked = geolocationBlockedReason();
    if (blocked && requireGps) {
      setGpsStatus("error");
      setGpsError(blocked);
      setLocationLabel(homeOfficeName || "Location unavailable");
      return;
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when sheet opens
  }, [open, kind]);

  if (!open) return null;

  const canConfirm =
    !loading &&
    gpsStatus !== "loading" &&
    !(needCamera && !image) &&
    !(requireGps && !coords) &&
    !outsideFence &&
    gpsStatus !== "error";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
      <div className={`${ui.card} w-full max-w-lg space-y-4 p-5`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0b1c30]">
            {kind === "in" ? "Check in" : "Check out"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <IconClose size={20} />
          </button>
        </div>

        <div className="rounded-xl border border-[#dbe3f5] bg-[#f7f9ff] px-3.5 py-3">
          <div className="flex items-start gap-2">
            <IconLocation size={18} className="mt-0.5 shrink-0 text-[#004ac6]" />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                Your location
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[#0b1c30]">
                {gpsStatus === "loading"
                  ? "Getting GPS…"
                  : locationLabel || "Office"}
              </p>
              {gpsStatus === "ok" && coords ? (
                <p className="mt-1 text-[11px] tabular-nums text-[#64748B]">
                  {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                  {coords.accuracyMeters
                    ? ` · ±${Math.round(coords.accuracyMeters)}m`
                    : ""}
                </p>
              ) : null}
              {kind === "in" && fence && fence.distanceMeters != null ? (
                <p
                  className={`mt-1 text-xs ${
                    fence.inside ? "text-emerald-700" : "text-[#b42318]"
                  }`}
                >
                  {fence.inside
                    ? `Inside ${homeOfficeName || fence.locationName || "office"} geofence (~${fence.distanceMeters}m / ${fence.radiusMeters}m)`
                    : `Outside geofence (~${fence.distanceMeters}m away; allowed ${fence.radiusMeters}m). Move closer to ${homeOfficeName || "the office"}.`}
                </p>
              ) : null}
              {gpsError ? (
                <p className="mt-1 text-xs text-[#b42318]">{gpsError}</p>
              ) : null}
            </div>
          </div>
        </div>

        {needCamera ? (
          <>
            <p className="text-sm text-[#434655]">
              {policy?.face_at_punch_required
                ? "Capture your face to verify identity."
                : "Take a selfie for attendance."}
            </p>
            <FaceCapture onCapture={setImage} />
            {!image ? (
              <p className="text-center text-xs text-[#434655]">
                Position your face in the frame, then capture.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-[#434655]">
            {kind === "in"
              ? `Check in only works inside ${homeOfficeName || "the office"} geofence.`
              : locationLabel
                ? `Confirm check out at ${locationLabel}.`
                : "Confirm check out."}
          </p>
        )}
        <button
          type="button"
          disabled={!canConfirm}
          className={`${ui.btn} w-full disabled:opacity-60`}
          onClick={() =>
            onConfirm({
              imageBase64: needCamera ? image : null,
              latitude: coords?.latitude ?? null,
              longitude: coords?.longitude ?? null,
              locationLabel,
            })
          }
        >
          {loading
            ? "Punching…"
            : gpsStatus === "loading"
              ? "Getting location…"
              : outsideFence
                ? "Too far from office"
                : kind === "in"
                  ? "Confirm check in"
                  : "Confirm check out"}
        </button>
      </div>
    </div>
  );
}
