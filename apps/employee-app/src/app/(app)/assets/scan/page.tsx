"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import { AlertBox } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import * as ui from "@/theme/classes";

export default function AssetScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraOk, setCameraOk] = useState(false);

  const resolveCode = useCallback(
    async (code: string) => {
      setError(null);
      try {
        const res = await essService.lookupAsset(code);
        const asset = res.data;
        if (!asset) {
          setError("Asset not found");
          return;
        }
        router.push(`/assets/${asset.id}`);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Lookup failed");
      }
    },
    [router],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => {
      detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
    } }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) return;

    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    const detector = new Detector({ formats: ["qr_code"] });

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setCameraOk(true);
        setScanning(true);
        timer = setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const raw = codes[0]?.rawValue;
            if (raw) {
              if (timer) clearInterval(timer);
              stream?.getTracks().forEach((t) => t.stop());
              setScanning(false);
              void resolveCode(raw);
            }
          } catch {
            // ignore frame errors
          }
        }, 500);
      } catch {
        setCameraOk(false);
      }
    }

    void start();
    return () => {
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [resolveCode]);

  function onManualSubmit(e: FormEvent) {
    e.preventDefault();
    const code = manual.trim();
    if (code) void resolveCode(code);
  }

  return (
    <div className="space-y-5">
      <SubHeader title="Scan asset QR" backHref="/assets" />

      {error ? <AlertBox tone="danger">{error}</AlertBox> : null}

      <div className={`${ui.card} overflow-hidden p-2`}>
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full rounded-xl bg-black object-cover"
          playsInline
          muted
        />
        <p className="mt-2 text-center text-xs text-[#434655]">
          {scanning && cameraOk
            ? "Point camera at asset QR code"
            : "Camera unavailable — enter code below"}
        </p>
      </div>

      <form onSubmit={onManualSubmit} className="space-y-3">
        <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
          Asset / QR code
          <input
            className={ui.input}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="AST-001 or QR value"
          />
        </label>
        <button type="submit" className={`${ui.btn} w-full`} disabled={!manual.trim()}>
          Look up asset
        </button>
      </form>
    </div>
  );
}
