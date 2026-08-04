"use client";

import { useCallback, useState } from "react";
import { Loader2, Mic, MicOff, PhoneOff } from "lucide-react";
import { useConversationControls, useConversationStatus } from "@elevenlabs/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchVoiceAgentSignedUrl } from "@/services/voice-agent-service";

const MIC_CONSENT_MESSAGE =
  "The voice assistant uses your microphone so you can speak with the ERP agent. " +
  "Audio is processed by ElevenLabs; we only issue a short-lived signed connection from our server.";

export function VoiceAgentControls() {
  const { startSession, endSession } = useConversationControls();
  const { status, message } = useConversationStatus();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [micReady, setMicReady] = useState(false);

  const isConnected = status === "connected";
  const isConnecting = status === "connecting" || busy;

  const ensureMicrophone = useCallback(async () => {
    if (micReady) return true;
    const accepted = window.confirm(MIC_CONSENT_MESSAGE);
    if (!accepted) {
      setLocalError("Microphone access was not approved.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicReady(true);
      setLocalError(null);
      return true;
    } catch {
      setLocalError("Could not access the microphone. Check browser permissions and try again.");
      return false;
    }
  }, [micReady]);

  const handleStart = useCallback(async () => {
    setLocalError(null);
    setBusy(true);
    try {
      const allowed = await ensureMicrophone();
      if (!allowed) return;
      const signedUrl = await fetchVoiceAgentSignedUrl();
      startSession({ signedUrl });
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to start voice session";
      setLocalError(text);
    } finally {
      setBusy(false);
    }
  }, [ensureMicrophone, startSession]);

  const handleEnd = useCallback(() => {
    endSession();
    setLocalError(null);
  }, [endSession]);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Voice session</p>
          <p className="text-xs text-muted-foreground capitalize">
            Status: {status}
            {message ? ` — ${message}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isConnected ? (
            <Button
              type="button"
              onClick={() => void handleStart()}
              disabled={isConnecting}
              className="cursor-pointer transition-colors duration-200"
              aria-label="Start voice assistant"
            >
              {isConnecting ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <Mic className="mr-2 size-4" aria-hidden />
              )}
              Start assistant
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={handleEnd}
              className="cursor-pointer transition-colors duration-200"
              aria-label="End voice assistant"
            >
              <PhoneOff className="mr-2 size-4" aria-hidden />
              End session
            </Button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm",
          isConnected
            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
            : "border-border bg-muted/40 text-muted-foreground",
        )}
        aria-live="polite"
      >
        {isConnected ? (
          <Mic className="size-5 shrink-0 text-emerald-600" aria-hidden />
        ) : (
          <MicOff className="size-5 shrink-0" aria-hidden />
        )}
        <p>
          {isConnected
            ? "Listening — ask about leads, orders, or say “open CRM”."
            : "Start a session after allowing microphone access. Signed URLs expire in about 15 minutes."}
        </p>
      </div>

      {localError ? (
        <p className="text-sm text-destructive" role="alert">
          {localError}
        </p>
      ) : null}
    </div>
  );
}
