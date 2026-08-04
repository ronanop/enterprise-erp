"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";

import { isAuthenticated, getAccessToken } from "@/lib/auth";
import { useConvaiClientTools } from "@/modules/agent-assistant/use-convai-client-tools";
import { env } from "@/utils/env";

const CONVAI_SCRIPT = "https://unpkg.com/@elevenlabs/convai-widget-embed";

/**
 * ElevenLabs Convai embed — shown on authenticated app routes only.
 * Fixed bottom-right with safe-area padding so it clears ERP chrome.
 */
export function ElevenLabsConvaiWidget() {
  const agentId = env.elevenlabsAgentId;
  const mountRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setAuthenticated(isAuthenticated());
    setAccessToken(getAccessToken());

    const syncToken = () => setAccessToken(getAccessToken());
    window.addEventListener("focus", syncToken);
    window.addEventListener("storage", syncToken);
    return () => {
      window.removeEventListener("focus", syncToken);
      window.removeEventListener("storage", syncToken);
    };
  }, []);

  const widgetReady = mounted && authenticated && Boolean(agentId);
  useConvaiClientTools(mountRef, widgetReady);

  const dynamicVariables = useMemo(() => {
    if (!accessToken) return undefined;
    return JSON.stringify({
      secret__erp_access_token: accessToken,
    });
  }, [accessToken]);

  if (!mounted || !authenticated || !agentId) {
    return null;
  }

  return (
    <>
      <Script src={CONVAI_SCRIPT} strategy="lazyOnload" />
      <div
        className="pointer-events-none fixed bottom-0 right-0 z-[60] flex max-h-[min(100dvh,100vh)] max-w-[100dvw] items-end justify-end pb-[max(1.25rem,env(safe-area-inset-bottom))] pr-[max(1.25rem,env(safe-area-inset-right))] pl-4 pt-4 sm:pb-6 sm:pr-6"
        aria-hidden={false}
      >
        <div ref={mountRef} className="pointer-events-auto origin-bottom-right">
          <elevenlabs-convai
            agent-id={agentId}
            {...(dynamicVariables ? { "dynamic-variables": dynamicVariables } : {})}
          />
        </div>
      </div>
    </>
  );
}
