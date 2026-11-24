"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  required?: boolean;
  hint?: string;
  /** Existing preview (data URL) */
  previewUrl?: string | null;
  fileName?: string | null;
  disabled?: boolean;
  maxBytes?: number;
  onCapture: (file: File, dataUrl: string) => void | Promise<void>;
};

export function LivePhotoCapture({
  label = "Live photo",
  required,
  hint,
  previewUrl,
  fileName,
  disabled,
  maxBytes = 300 * 1024,
  onCapture,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Attach stream after <video> mounts — assigning before mount caused a black preview.
  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    const play = () => {
      void video.play().catch(() => {
        setError("Could not start camera preview. Try again.");
      });
    };

    if (video.readyState >= 2) {
      play();
    } else {
      video.onloadedmetadata = play;
    }

    return () => {
      video.onloadedmetadata = null;
    };
  }, [active]);

  async function startCamera() {
    setError(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera is not supported in this browser.");
      setActive(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      setActive(true);
    } catch {
      setError("Camera access denied or unavailable. Allow camera permission and try again.");
      setActive(false);
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || !active) return;
    if (!video.videoWidth || !video.videoHeight) {
      setError("Camera is still starting. Wait for the preview, then capture.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      const w = video.videoWidth;
      const h = video.videoHeight;
      // Crop center square so saved photo matches the square frame
      const side = Math.min(w, h);
      const sx = Math.max(0, Math.floor((w - side) / 2));
      const sy = Math.max(0, Math.floor((h - side) / 2));
      canvas.width = side;
      canvas.height = side;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const blob = await (await fetch(dataUrl)).blob();
      if (blob.size > maxBytes) {
        setError(`Photo is too large (${Math.ceil(blob.size / 1024)} KB). Move closer / retake.`);
        return;
      }
      const file = new File([blob], `live-photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      await onCapture(file, dataUrl);
      stopCamera();
    } catch {
      setError("Could not capture photo. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </p>

      {previewUrl && !active ? (
        <div className="w-full max-w-[240px]">
          <div className="aspect-square overflow-hidden rounded-lg border border-border bg-muted/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Live photo preview"
              className="size-full object-cover"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {fileName || "Live photo captured"}
          </p>
        </div>
      ) : null}

      {active ? (
        <div className="aspect-square w-full max-w-[240px] overflow-hidden rounded-lg border border-border bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="size-full object-cover"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!active ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={disabled || busy}
            onClick={() => void startCamera()}
          >
            <Camera className="size-3.5" />
            {previewUrl ? "Retake live photo" : "Open camera"}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              className="cursor-pointer"
              disabled={disabled || busy}
              onClick={() => void capture()}
            >
              <Camera className="size-3.5" />
              {busy ? "Capturing…" : "Capture"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="cursor-pointer"
              disabled={busy}
              onClick={stopCamera}
            >
              <RefreshCw className="size-3.5" />
              Cancel
            </Button>
          </>
        )}
      </div>

      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
      {error ? <p className={cn("text-[10px] text-destructive")}>{error}</p> : null}
    </div>
  );
}
