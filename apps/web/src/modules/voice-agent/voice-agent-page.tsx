"use client";

import { PageHeader } from "@/components/layout/page-header";
import { VoiceAgentControls } from "@/modules/voice-agent/voice-agent-controls";
import { VoiceAgentLeadPreview } from "@/modules/voice-agent/voice-agent-lead-preview";
import { VoiceAgentProvider } from "@/modules/voice-agent/voice-agent-provider";

export function VoiceAgentPage() {
  return (
    <VoiceAgentProvider>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-6">
        <PageHeader
          title="Voice assistant"
          description="Siri-style voice and chat via ElevenLabs Conversational AI. Agent logic and server tools are configured in the ElevenLabs dashboard."
        />
        <VoiceAgentControls />
        <VoiceAgentLeadPreview />
      </div>
    </VoiceAgentProvider>
  );
}
