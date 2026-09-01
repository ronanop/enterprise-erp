"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Inbox, Mail, RefreshCw, Search, Ticket, User } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ApiClientError,
  getMailboxMessage,
  getServiceRequestTicket,
  listMailboxMessages,
  type MailboxMessageDetail,
  type MailboxMessageItem,
} from "@/services/service-request-ticket-service";
import { cn } from "@/lib/utils";

function formatWhen(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatListWhen(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function senderInitials(name: string | null | undefined, email: string): string {
  const label = (name || email).trim();
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

function mailboxTicketDisplayStatus(item: {
  ticket_id?: string | null;
  ticket_status?: string | null;
  opened_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
}): { badgeStatus: string; label: string } | null {
  if (!item.ticket_id) return null;

  if (item.resolved_at || item.closed_at) {
    return { badgeStatus: "resolved", label: "Resolved" };
  }

  const status = (item.ticket_status ?? "").toLowerCase();
  if (status === "resolved" || status === "closed") {
    return { badgeStatus: "resolved", label: "Resolved" };
  }

  const isOpened = Boolean(
    item.opened_at ||
      ["engineer_working", "pending_customer", "pending_oem", "assigned", "in_progress"].includes(status),
  );
  return isOpened
    ? { badgeStatus: "open", label: "Opened" }
    : { badgeStatus: "pending", label: "Pending" };
}

function mergeTicketFields(
  message: MailboxMessageItem | MailboxMessageDetail,
  ticket?: {
    id: string;
    document_number: string;
    status: string;
    opened_at?: string | null;
    resolved_at?: string | null;
    closed_at?: string | null;
  },
): MailboxMessageDetail {
  if (!ticket) return message as MailboxMessageDetail;
  return {
    ...(message as MailboxMessageDetail),
    ticket_id: ticket.id,
    document_number: ticket.document_number,
    ticket_status: ticket.status,
    opened_at: ticket.opened_at ?? null,
    resolved_at: ticket.resolved_at ?? null,
    closed_at: ticket.closed_at ?? null,
  };
}

async function enrichMailboxMessage(message: MailboxMessageDetail): Promise<MailboxMessageDetail> {
  if (!message.ticket_id) return message;
  try {
    const ticket = await getServiceRequestTicket(message.ticket_id);
    return mergeTicketFields(message, ticket);
  } catch {
    return message;
  }
}

function ListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-lg px-3 py-3">
          <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-full animate-pulse rounded bg-muted/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MailListItem({
  row,
  selected,
  onSelect,
}: {
  row: MailboxMessageItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const sender = row.from_name || row.from_address.split("@")[0] || row.from_address;
  const initials = senderInitials(row.from_name, row.from_address);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group mx-2 mb-1 w-[calc(100%-1rem)] rounded-lg px-3 py-2.5 text-left transition-all duration-150",
        selected
          ? "bg-primary/10 shadow-sm ring-1 ring-primary/20"
          : "hover:bg-muted/60",
        !row.is_read && !selected && "bg-background",
      )}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-muted/80",
          )}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className={cn("truncate text-sm leading-tight", !row.is_read && "font-semibold")}>
              {sender}
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
              {formatListWhen(row.received_at)}
            </span>
          </div>
          <div
            className={cn(
              "mt-0.5 truncate text-[13px] leading-snug",
              !row.is_read ? "font-medium text-foreground" : "text-foreground/85",
            )}
          >
            {row.subject}
          </div>
          <div className="mt-1 line-clamp-1 text-xs leading-snug text-muted-foreground">{row.body_preview}</div>
          {(row.document_number || !row.is_read || row.classification === "likely_ticket") && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {!row.is_read ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                  <span className="size-1.5 rounded-full bg-primary" />
                  Unread
                </span>
              ) : null}
              {row.document_number ? (
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  {row.document_number}
                </span>
              ) : null}
              {row.classification === "likely_ticket" ? (
                <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  Ticket
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function MailReadingPane({
  row,
  detail,
  loading,
}: {
  row: MailboxMessageItem | null;
  detail: MailboxMessageDetail | null;
  loading: boolean;
}) {
  if (!row) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted/60">
          <Inbox className="size-8 text-muted-foreground/60" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">No message selected</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Select a message from the list on the left to read it here.
          </p>
        </div>
      </div>
    );
  }

  const body = detail?.body_text || detail?.body_preview || row.body_preview;
  const display = { ...row, ...(detail ?? {}) };
  const initials = senderInitials(display.from_name, display.from_address);
  const ticketStatus = mailboxTicketDisplayStatus(display);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/60 bg-muted/20 px-6 py-5">
        <h2 className="text-xl font-semibold leading-snug tracking-tight">{display.subject}</h2>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="size-3.5 text-muted-foreground" />
                {display.from_name || display.from_address}
              </div>
              {display.from_name ? (
                <div className="mt-0.5 text-xs text-muted-foreground">{display.from_address}</div>
              ) : null}
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {formatWhen(display.received_at)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {ticketStatus && display.ticket_id ? (
              <Link
                href={`/service/service-request-tickets/${display.ticket_id}`}
                className="transition-opacity hover:opacity-90"
                title={`Open ticket ${display.document_number ?? ""}`.trim()}
              >
                <FinanceStatusBadge status={ticketStatus.badgeStatus} />
              </Link>
            ) : null}
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {display.is_read ? "Read" : "Unread"}
            </span>
            {display.document_number && display.ticket_id ? (
              <Link
                href={`/service/service-request-tickets/${display.ticket_id}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Ticket className="size-3" />
                {display.document_number}
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <article className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <pre className="font-sans text-sm leading-7 whitespace-pre-wrap text-foreground/90">
              {body || "(No body)"}
            </pre>
          </article>
        )}
      </div>
    </div>
  );
}

export function ServiceMailboxPage() {
  const [mailbox, setMailbox] = useState("");
  const [rows, setRows] = useState<MailboxMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MailboxMessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const unreadCount = useMemo(() => rows.filter((r) => !r.is_read).length, [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMailboxMessages(50);
      setMailbox(data.mailbox);
      setRows(data.messages ?? []);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load mailbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => {
      const hay = [
        row.subject,
        row.from_address,
        row.from_name ?? "",
        row.body_preview,
        row.document_number ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [q, rows]);

  const selectedRow = useMemo(
    () => filtered.find((row) => row.graph_id === selectedId) ?? null,
    [filtered, selectedId],
  );

  const selectMessage = useCallback(async (graphId: string) => {
    setSelectedId(graphId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const full = await enrichMailboxMessage(await getMailboxMessage(graphId));
      setDetail(full);
      setRows((prev) =>
        prev.map((row) =>
          row.graph_id === graphId
            ? {
                ...row,
                ticket_id: full.ticket_id,
                document_number: full.document_number,
                ticket_status: full.ticket_status,
                opened_at: full.opened_at,
                resolved_at: full.resolved_at,
                closed_at: full.closed_at,
              }
            : row,
        ),
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load message");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading || filtered.length === 0) return;
    const stillVisible = filtered.some((row) => row.graph_id === selectedId);
    if (!stillVisible) {
      void selectMessage(filtered[0].graph_id);
    }
  }, [filtered, loading, selectMessage, selectedId]);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <PageHeader
        title="Support Mailbox"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              void (async () => {
                await load();
                if (selectedId) await selectMessage(selectedId);
              })();
            }}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        {/* Toolbar — inbox meta */}
        <div className="shrink-0 border-b border-border/60 bg-muted/25 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Inbox className="size-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">Inbox</span>
                  <span className="truncate text-sm text-muted-foreground">{mailbox || "—"}</span>
                </div>
              </div>
            </div>
            {unreadCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium tabular-nums text-primary">
                  {unreadCount} unread
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Split pane — fixed height, internal scroll */}
        <div className="flex min-h-0 flex-1 flex-col lg:h-[calc(100dvh-15.5rem)] lg:max-h-[720px] lg:flex-row">
          {/* Message list — left */}
          <aside className="flex min-h-0 w-full shrink-0 flex-col border-border/60 lg:w-[min(100%,340px)] lg:border-r xl:w-[360px]">
            <div className="shrink-0 border-b border-border/60 bg-background/80 px-3 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 rounded-lg border-border/60 bg-muted/30 pl-9 text-sm shadow-none focus-visible:bg-background"
                  placeholder="Search mail…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-2 lg:max-h-none">
              {loading ? (
                <ListSkeleton />
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                  <Mail className="size-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No messages found.</p>
                </div>
              ) : (
                filtered.map((row) => (
                  <MailListItem
                    key={row.graph_id}
                    row={row}
                    selected={selectedId === row.graph_id}
                    onSelect={() => void selectMessage(row.graph_id)}
                  />
                ))
              )}
            </div>
          </aside>

          {/* Reading pane — right */}
          <section className="min-h-[320px] min-w-0 flex-1 border-t border-border/60 bg-background lg:min-h-0 lg:border-t-0">
            <MailReadingPane row={selectedRow} detail={detail} loading={detailLoading} />
          </section>
        </div>
      </div>
    </div>
  );
}
