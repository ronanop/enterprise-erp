"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import { AlertBox } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import * as ui from "@/theme/classes";

export default function NewSupportTicketPage() {
  const router = useRouter();
  const search = useSearchParams();
  const kind = search.get("kind") === "grievance" ? "grievance" : "it";
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("medium");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await essService.createSupportTicket({
        kind,
        subject: subject.trim(),
        description: description.trim(),
        urgency,
      });
      const id = res.data?.id;
      router.push(id ? `/support/${id}` : "/support");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create ticket");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <SubHeader
        title={kind === "grievance" ? "New grievance" : "New IT ticket"}
        backHref="/support"
      />

      {error ? <AlertBox tone="danger">{error}</AlertBox> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
          Subject
          <input
            className={ui.input}
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={kind === "grievance" ? "Brief summary" : "e.g. Laptop not starting"}
          />
        </label>

        <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
          Urgency
          <select className={ui.input} value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
          Description
          <textarea
            className={`${ui.input} min-h-[120px] resize-none`}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue or concern…"
          />
        </label>

        <button type="submit" className={`${ui.btn} w-full`} disabled={loading}>
          {loading ? "Submitting…" : "Submit ticket"}
        </button>
      </form>
    </div>
  );
}
