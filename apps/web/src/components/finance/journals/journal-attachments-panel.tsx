"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, Paperclip, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type JournalAttachmentItem = {
  id: string;
  file_name: string;
  mime_type?: string;
  size_bytes?: number;
  uploaded_at?: string;
  status: "queued" | "uploading" | "ready" | "error";
  progress: number;
  error?: string;
  /** Set when Document attachment API returns an id */
  remote_id?: string;
  preview_url?: string;
};

type Props = {
  journalId: string;
  readOnly?: boolean;
  /**
   * Optional live uploader. When provided, called for each file.
   * Document module attachments require a document_id — wire when Finance↔DMS link exists.
   */
  onUpload?: (file: File, onProgress: (pct: number) => void) => Promise<{
    id: string;
    file_name: string;
    mime_type?: string;
    preview_url?: string;
  }>;
  onDelete?: (remoteId: string) => Promise<void>;
  onDownload?: (item: JournalAttachmentItem) => void;
};

/**
 * Attachments panel — production UI with drag/drop + progress.
 * Uses injectable upload/delete hooks (no mock storage).
 */
export function JournalAttachmentsPanel({
  journalId,
  readOnly,
  onUpload,
  onDelete,
  onDownload,
}: Props) {
  const [items, setItems] = useState<JournalAttachmentItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const enqueue = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      for (const file of list) {
        const localId = `local-${crypto.randomUUID()}`;
        setItems((prev) => [
          ...prev,
          {
            id: localId,
            file_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            status: onUpload ? "uploading" : "queued",
            progress: onUpload ? 5 : 0,
            uploaded_at: new Date().toISOString(),
          },
        ]);

        if (!onUpload) {
          setItems((prev) =>
            prev.map((it) =>
              it.id === localId
                ? {
                    ...it,
                    status: "error",
                    error:
                      "Attachment API not linked for journals yet. Upload hook ready (pass onUpload).",
                    progress: 0,
                  }
                : it,
            ),
          );
          continue;
        }

        try {
          const remote = await onUpload(file, (pct) => {
            setItems((prev) =>
              prev.map((it) =>
                it.id === localId ? { ...it, progress: pct, status: "uploading" } : it,
              ),
            );
          });
          setItems((prev) =>
            prev.map((it) =>
              it.id === localId
                ? {
                    ...it,
                    status: "ready",
                    progress: 100,
                    remote_id: remote.id,
                    file_name: remote.file_name,
                    mime_type: remote.mime_type,
                    preview_url: remote.preview_url,
                  }
                : it,
            ),
          );
        } catch (err) {
          setItems((prev) =>
            prev.map((it) =>
              it.id === localId
                ? {
                    ...it,
                    status: "error",
                    error: err instanceof Error ? err.message : "Upload failed",
                    progress: 0,
                  }
                : it,
            ),
          );
        }
      }
    },
    [onUpload],
  );

  return (
    <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium tracking-tight">Attachments</h2>
        <span className="text-[10px] text-muted-foreground">Journal {journalId.slice(0, 8)}</span>
      </div>

      {!readOnly ? (
        <div
          className={cn(
            "mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 py-6 text-center transition-colors duration-200",
            dragOver ? "border-primary bg-accent/40" : "border-border/80 bg-muted/20",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) void enqueue(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          <FileUp className="size-5 text-muted-foreground" />
          <p className="mt-2 text-xs font-medium">Drop files or click to upload</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            PDF, images, office docs · live upload when DMS link is configured
          </p>
          <Input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void enqueue(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}

      <ul className="mt-3 space-y-1.5">
        {items.length === 0 ? (
          <li className="text-xs text-muted-foreground">No attachments.</li>
        ) : (
          items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-xs"
            >
              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.file_name}</p>
                {item.status === "uploading" ? (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-sky-600 transition-[width] duration-200"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                ) : null}
                {item.error ? (
                  <p className="mt-0.5 text-[10px] text-destructive">{item.error}</p>
                ) : null}
              </div>
              {item.status === "ready" && onDownload ? (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => onDownload(item)}
                >
                  Download
                </Button>
              ) : null}
              {!readOnly && item.remote_id && onDelete ? (
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="cursor-pointer"
                  onClick={() =>
                    void onDelete(item.remote_id!).then(() =>
                      setItems((prev) => prev.filter((x) => x.id !== item.id)),
                    )
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
