"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertBox } from "@/components/ui";
import * as ui from "@/theme/classes";

type Props = {
  onCapture: (imageBase64: string) => void | Promise<void>;
  busy?: boolean;
  label?: string;
};

export function FaceCapture({ onCapture, busy, label = "Capture face" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    setError(null);
    (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (!active) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = media;
        const video = videoRef.current;
        if (video) {
          video.srcObject = media;
          await video.play();
        }
        setReady(true);
      } catch {
        if (active) {
          setError("Camera access is required for face verification.");
        }
      }
    })();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    await onCapture(dataUrl);
  }, [onCapture]);

  return (
    <div className="space-y-4">
      {error ? <AlertBox>{error}</AlertBox> : null}
      <div className="relative overflow-hidden rounded-2xl bg-[#0b1c30]">
        <video
          ref={videoRef}
          className="aspect-[3/4] w-full object-cover"
          playsInline
          muted
        />
        <div className="pointer-events-none absolute inset-8 rounded-[40%] border-2 border-dashed border-white/40" />
      </div>
      <button
        type="button"
        className={`${ui.btn} w-full`}
        disabled={busy || Boolean(error) || !ready}
        onClick={() => void capture()}
      >
        {busy ? "Working…" : label}
      </button>
    </div>
  );
}
