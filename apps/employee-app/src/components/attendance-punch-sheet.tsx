"use client";

import { useState } from "react";
import { FaceCapture } from "@/components/face-capture";
import { IconClose } from "@/components/icons";
import type { EssPunchPolicy } from "@/types/api";
import * as ui from "@/theme/classes";

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
  onConfirm: (imageBase64: string | null) => void;
}) {
  const [image, setImage] = useState<string | null>(null);
  const needCamera = Boolean(
    policy?.selfie_required || policy?.face_at_punch_required,
  );

  if (!open) return null;

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
            Confirm punch{policy?.geofence_required ? " at your work location" : ""}.
          </p>
        )}
        <button
          type="button"
          disabled={loading || (needCamera && !image)}
          className={`${ui.btn} w-full disabled:opacity-60`}
          onClick={() => onConfirm(needCamera ? image : null)}
        >
          {loading ? "Punching…" : kind === "in" ? "Confirm check in" : "Confirm check out"}
        </button>
      </div>
    </div>
  );
}
