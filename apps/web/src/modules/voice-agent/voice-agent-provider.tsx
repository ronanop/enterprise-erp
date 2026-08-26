"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ConversationProvider } from "@elevenlabs/react";

import { createAgentClientTools } from "@/modules/agent-assistant/agent-client-tools";
import type { AgentLeadDetail } from "@/services/voice-agent-service";

export type VoiceAgentClientTools = ReturnType<typeof createAgentClientTools>;

type VoiceAgentLeadContextValue = {
  leadPreview: AgentLeadDetail | null;
  clearLeadPreview: () => void;
};

const VoiceAgentLeadContext = createContext<VoiceAgentLeadContextValue | null>(null);

export function useVoiceAgentLeadPreview(): VoiceAgentLeadContextValue {
  const ctx = useContext(VoiceAgentLeadContext);
  if (!ctx) {
    throw new Error("useVoiceAgentLeadPreview must be used within VoiceAgentProvider");
  }
  return ctx;
}

type VoiceAgentProviderProps = {
  children: ReactNode;
};

export function VoiceAgentProvider({ children }: VoiceAgentProviderProps) {
  const router = useRouter();
  const [leadPreview, setLeadPreview] = useState<AgentLeadDetail | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const clearLeadPreview = useCallback(() => setLeadPreview(null), []);

  const clientTools = useMemo(
    () =>
      createAgentClientTools({
        router,
        onLeadPreview: setLeadPreview,
      }),
    [router],
  );

  return (
    <VoiceAgentLeadContext.Provider value={{ leadPreview, clearLeadPreview }}>
      <ConversationProvider
        // ElevenLabs SDK expects a narrower return type than our shared tool map.
        clientTools={clientTools as never}
        onError={(message) => setSessionError(message)}
        onDisconnect={() => setSessionError(null)}
      >
        {sessionError ? (
          <p className="sr-only" role="status">
            Voice session error: {sessionError}
          </p>
        ) : null}
        {children}
      </ConversationProvider>
    </VoiceAgentLeadContext.Provider>
  );
}
