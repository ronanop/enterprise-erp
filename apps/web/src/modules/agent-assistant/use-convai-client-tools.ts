"use client";

import { type RefObject, useEffect, useLayoutEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { getAccessToken } from "@/lib/auth";
import { createAgentClientTools } from "@/modules/agent-assistant/agent-client-tools";

type ConvaiCallEvent = CustomEvent<{
  config: {
    clientTools?: Record<string, (parameters: Record<string, unknown>) => unknown>;
    dynamicVariables?: Record<string, string>;
  };
}>;

type AgentClientToolsMap = ReturnType<typeof createAgentClientTools>;

function attachConvaiSession(
  event: Event,
  clientTools: AgentClientToolsMap,
  mount: HTMLDivElement | null,
) {
  const detail = (event as ConvaiCallEvent).detail;
  if (!detail?.config) return;
  if (mount) {
    const path = event.composedPath();
    if (!path.includes(mount)) return;
  }
  detail.config.clientTools = { ...clientTools };
  const token = getAccessToken();
  if (token) {
    detail.config.dynamicVariables = {
      ...detail.config.dynamicVariables,
      secret__erp_access_token: token,
    };
  }
}

/**
 * Registers ERP navigation and API client tools on the Convai embed widget.
 * @see https://elevenlabs.io/docs/eleven-agents/customization/widget#client-tools
 */
export function useConvaiClientTools(
  mountRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const router = useRouter();
  const clientTools = useMemo(() => createAgentClientTools({ router }), [router]);

  useEffect(() => {
    if (!enabled) return;

    const onCall = (event: Event) => {
      attachConvaiSession(event, clientTools, mountRef.current);
    };

    document.addEventListener("elevenlabs-convai:call", onCall, true);
    return () => document.removeEventListener("elevenlabs-convai:call", onCall, true);
  }, [clientTools, enabled, mountRef]);

  useLayoutEffect(() => {
    if (!enabled) return;
    const mount = mountRef.current;
    if (!mount) return;

    const onCall = (event: Event) => {
      attachConvaiSession(event, clientTools, mount);
    };

    let cleanup: (() => void) | undefined;

    const bind = (el: Element) => {
      cleanup?.();
      el.addEventListener("elevenlabs-convai:call", onCall);
      cleanup = () => el.removeEventListener("elevenlabs-convai:call", onCall);
    };

    const existing = mount.querySelector("elevenlabs-convai");
    if (existing) bind(existing);

    const observer = new MutationObserver(() => {
      const el = mount.querySelector("elevenlabs-convai");
      if (el) bind(el);
    });
    observer.observe(mount, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cleanup?.();
    };
  }, [clientTools, enabled, mountRef]);
}
