import { apiClient } from "@/services/api-client";

export type AgentLeadDetail = {
  id: string;
  lead_code: string;
  status: string;
  email: string | null;
  mobile: string;
  company_name?: string | null;
  entity_name?: string | null;
  first_name: string;
  last_name: string | null;
};

export async function fetchVoiceAgentSignedUrl(): Promise<string> {
  const response = await apiClient<{ signed_url: string }>("/voice-agent/signed-url");
  const url = response.data?.signed_url;
  if (!url) {
    throw new Error("Signed URL missing from API response");
  }
  return url;
}

export async function fetchAgentLead(leadId: string): Promise<AgentLeadDetail> {
  const response = await apiClient<AgentLeadDetail>(`/leads/${leadId}`);
  if (!response.data) {
    throw new Error("Lead not found");
  }
  return response.data;
}

export function leadDisplayName(lead: AgentLeadDetail): string {
  const parts = [lead.first_name, lead.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : lead.lead_code;
}
