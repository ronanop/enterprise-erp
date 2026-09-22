"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import { AlertBox } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssSupportTicketComment, EssSupportTicketDetail } from "@/types/api";
import * as ui from "@/theme/classes";

export default function SupportTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<EssSupportTicketDetail | null>(null);
  const [comments, setComments] = useState<EssSupportTicketComment[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    const id = params.id;
    return Promise.all([
      essService.supportTicket(id),
      essService.supportTicketComments(id),
    ])
      .then(([tRes, cRes]) => {
        setTicket(tRes.data ?? null);
        setComments(cRes.data ?? []);
      })
      .catch((err) => {
        setError(err instanceof ApiClientError ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  async function onReply(e: FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setError(null);
    try {
      await essService.addSupportTicketComment(params.id, { body: reply.trim() });
      setReply("");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not send comment");
    }
  }

  return (
    <div className="space-y-5 pb-28">
      <SubHeader title="Ticket" backHref="/support" />

      {error ? <AlertBox tone="danger">{error}</AlertBox> : null}

      {loading ? (
        <p className="text-sm text-[#434655]">Loading…</p>
      ) : !ticket ? (
        <p className="text-sm text-[#434655]">Ticket not found.</p>
      ) : (
        <>
          <div className={`${ui.card} space-y-2 p-4`}>
            <p className="text-xs font-bold uppercase text-[#004ac6]">{ticket.document_number}</p>
            <h2 className="text-lg font-bold text-[#0b1c30]">{ticket.subject}</h2>
            <p className="text-sm text-[#434655]">{ticket.description}</p>
            <p className="text-xs text-[#434655]">
              Status: <span className="font-semibold">{ticket.status}</span>
            </p>
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[#0b1c30]">Updates</h3>
            {comments.length === 0 ? (
              <p className="text-xs text-[#434655]">No comments yet.</p>
            ) : (
              <ul className="space-y-2">
                {comments.map((c) => (
                  <li key={c.id} className={`${ui.card} p-3 text-sm text-[#434655]`}>
                    <p>{c.body}</p>
                    <p className="mt-1 text-[10px] text-[#434655]/80">
                      {new Date(c.commented_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form onSubmit={onReply} className="space-y-2">
            <textarea
              className={`${ui.input} min-h-[80px] resize-none`}
              placeholder="Add a comment…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <button type="submit" className={`${ui.btn} w-full`} disabled={!reply.trim()}>
              Send comment
            </button>
          </form>
        </>
      )}
    </div>
  );
}
