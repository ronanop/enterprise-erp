"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { FaceCapture } from "@/components/face-capture";
import { AlertBox } from "@/components/ui";
import { markFaceVerified } from "@/lib/face-auth";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import * as ui from "@/theme/classes";

export default function FaceVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onCapture(imageBase64: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await essService.faceVerify(imageBase64);
      if (!res.data?.verified) {
        setError("Face verification failed. Try again or contact HR.");
        return;
      }
      markFaceVerified();
      const next = searchParams.get("next") || "/home";
      router.replace(next);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Verification failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`${ui.shellPlain} mx-auto max-w-lg space-y-5 px-5 py-8`}>
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Verify it&apos;s you</h1>
        <p className={`mt-2 text-sm ${ui.muted}`}>
          Position your face in the frame. This stops others from using your account
          after they know your password.
        </p>
      </div>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <FaceCapture onCapture={onCapture} busy={busy} label="Verify face" />
    </main>
  );
}
