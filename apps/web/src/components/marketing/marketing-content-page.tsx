"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Building2, ImageIcon, Palette, PenLine, Plus, RefreshCw, Sparkles, type LucideIcon } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { MarketingBannerUploadField } from "@/components/marketing/marketing-banner-upload-field";
import { MarketingContentReviewDialog } from "@/components/marketing/marketing-content-review-dialog";
import { MarketingReviewSectionHeader } from "@/components/marketing/marketing-review-section-header";
import { MarketingPageHeader } from "@/components/marketing/marketing-page-header";
import { marketingCard, marketingPage, marketingTableHead, marketingTableRow, marketingTableShell } from "@/lib/marketing-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import { cn } from "@/lib/utils";
import {
  BANNER_VERIFICATION_ITEM_KEY,
  isBannerContentType,
  uploadContentAssetForItem,
} from "@/lib/marketing-content-upload";
import { isLinkedInHandler, isMarketingHead } from "@/lib/marketing-verification";
import { isVideoEditor } from "@/lib/marketing-role-ui";
import {
  canLinkedInHandlerSendToPublisher,
  canLinkedInHandlerSubmitFinalDraftToHead,
  canMarkLinkedInAsPublished,
  hasLinkedInSectionApproval,
  isMarketingContentLocked,
  linkedInFinalDraftAwaitingHead,
  linkedInHandlerAwaitingPublisher,
  linkedInPublishStatusLabel,
  usesLinkedInSectionWorkflow,
} from "@/lib/linkedin-section-approval";
import {
  canMarkVideoAsPublished,
  canVideoEditorSendToPublisher,
  canVideoEditorSubmitFinalDraftToHead,
  hasVideoSectionApproval,
  usesVideoSectionWorkflow,
  videoEditorAwaitingPublisher,
  videoPublishStatusLabel,
} from "@/lib/video-section-approval";
import { apiClient } from "@/services/api-client";
import {
  ApiClientError,
  canUserReportPosting,
  createContentItem,
  formatMarketingStatus,
  getContentTimeline,
  listContentItems,
  submitContentItem,
  submitVerificationItem,
  type MarketingActivityLog,
  type MarketingContentItem,
} from "@/services/marketing-service";

const POLL_MS = 10_000;

const CONTENT_KINDS = [
  { value: "social_post", label: "Social post (text verification)" },
  { value: "blog_article", label: "Blog / article" },
  { value: "ad_creative", label: "Banner / ad creative" },
] as const;

function titleFromTopic(topic: string): string {
  const trimmed = topic.trim();
  const firstLine = trimmed.split(/\r?\n/)[0] ?? trimmed;
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

const linkedInFieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

function LinkedInDraftFormField({
  icon: Icon,
  label,
  required = false,
  highlight = false,
  children,
}: {
  icon: LucideIcon;
  label: string;
  required?: boolean;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/60 p-3.5 shadow-sm">
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md border",
            highlight ? "border-primary/20 bg-primary/5" : "border-border/60 bg-muted/40",
          )}
        >
          <Icon className={cn("size-3.5", highlight ? "text-primary" : "text-muted-foreground")} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/80">
          {label}
          {required ? <span className="ml-1 text-destructive">*</span> : null}
        </span>
      </div>
      {children}
    </div>
  );
}

export function MarketingContentPage() {
  const searchParams = useSearchParams();
  const perms = useMarketingPermissions();
  const linkedInMode = isLinkedInHandler(perms);
  const videoEditorMode = isVideoEditor(perms);
  const sectionWorkflowMode = linkedInMode || videoEditorMode;
  const canCreatePost = (perms.canCreate || sectionWorkflowMode) && !isMarketingHead(perms);
  const canSendToHead = perms.canSubmit || (sectionWorkflowMode && perms.canVerify);
  const contentKinds = linkedInMode
    ? CONTENT_KINDS.filter((k) => k.value === "social_post")
    : videoEditorMode
      ? CONTENT_KINDS.filter((k) => k.value === "video")
      : CONTENT_KINDS;
  const [rows, setRows] = useState<MarketingContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<string>("social_post");
  const [body, setBody] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [branchId, setBranchId] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [theme, setTheme] = useState("");
  const [postMediaFile, setPostMediaFile] = useState<File | null>(null);
  const [postMediaPreview, setPostMediaPreview] = useState<string | null>(null);
  const [postMediaIsVideo, setPostMediaIsVideo] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reviewItem, setReviewItem] = useState<MarketingContentItem | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(
        (await listContentItems({
          q: q || undefined,
          status: status || undefined,
          page_size: 200,
          mine: sectionWorkflowMode || undefined,
        })).filter(
          (row) =>
            status === "archived" ||
            status === "published" ||
            (row.status !== "archived" && row.status !== "published"),
        ),
      );
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load content");
    } finally {
      setLoading(false);
    }
  }, [q, status, sectionWorkflowMode]);

  useEffect(() => {
    void load();
    void apiClient<{ branch_id: string | null }>("/auth/context")
      .then((res) => {
        if (res.data?.branch_id) setBranchId(res.data.branch_id);
      })
      .catch(() => undefined);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    return () => {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
      if (postMediaPreview) URL.revokeObjectURL(postMediaPreview);
    };
  }, [bannerPreview, postMediaPreview]);

  const resetForm = () => {
    setTitle("");
    setBody("");
    setHashtags("");
    setContentType("social_post");
    setBannerFile(null);
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(null);
    setCompanyName("");
    setTheme("");
    setPostMediaFile(null);
    if (postMediaPreview) URL.revokeObjectURL(postMediaPreview);
    setPostMediaPreview(null);
    setPostMediaIsVideo(false);
    setShowForm(false);
  };

  const onBannerSelected = (file: File) => {
    setBannerFile(file);
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(URL.createObjectURL(file));
  };

  const onPostMediaSelected = (file: File) => {
    setPostMediaFile(file);
    setPostMediaIsVideo(file.type.startsWith("video/"));
    if (postMediaPreview) URL.revokeObjectURL(postMediaPreview);
    setPostMediaPreview(URL.createObjectURL(file));
  };

  const linkedInFormReady = Boolean(body.trim() && companyName.trim() && branchId);
  const genericFormReady = Boolean(title.trim() && branchId);

  const onCreate = async (submitAfterCreate: boolean) => {
    if (linkedInMode || videoEditorMode) {
      if (!body.trim() || !companyName.trim() || !branchId) return;
    } else if (!title.trim() || !branchId) {
      return;
    }
    const isBanner = isBannerContentType(contentType);
    if (submitAfterCreate && isBanner && !bannerFile) {
      setError("Upload a banner image before submitting for verification.");
      return;
    }
    if (submitAfterCreate && !linkedInMode && !isBanner && !body.trim()) {
      setError("Add post text before submitting for verification.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const payload: Record<string, unknown> =
        linkedInMode || videoEditorMode
          ? {
              branch_id: branchId,
              content_type: linkedInMode ? "social_post" : "video",
              title: titleFromTopic(body),
              body: body.trim(),
              summary: companyName.trim(),
              theme: theme.trim() || null,
            }
          : {
            title: title.trim(),
            branch_id: branchId,
            content_type: contentType,
            body: body.trim() || null,
            hashtags: hashtags.trim() || null,
          };
      const created = await createContentItem(payload);
      if (isBanner && bannerFile) {
        await uploadContentAssetForItem(
          created.id,
          created.company_id,
          bannerFile,
          BANNER_VERIFICATION_ITEM_KEY,
        );
      }
      if ((linkedInMode || videoEditorMode) && postMediaFile) {
        await uploadContentAssetForItem(
          created.id,
          created.company_id,
          postMediaFile,
          linkedInMode ? "linkedin_content" : "video_content",
          postMediaIsVideo ? "video" : "image",
        );
      }
      if (submitAfterCreate && canSendToHead) {
        await submitContentItem(created.id);
        resetForm();
        await load();
        return;
      }
      resetForm();
      await load();
      if (isBanner) {
        setReviewItem(created);
        setReviewOpen(true);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create content");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={marketingPage}>
      <MarketingPageHeader
        title={linkedInMode ? "LinkedIn posts" : videoEditorMode ? "Video content" : "Content"}
        description={
          sectionWorkflowMode
            ? "Create drafts, respond to head feedback, and move work through the pipeline."
            : "Create and submit content for team verification."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/marketing/pipeline"
              className="inline-flex h-7 items-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              {linkedInMode ? "My queue" : "My pipeline"}
            </Link>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {canCreatePost ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setShowForm((v) => !v)}
              >
                <Plus className="size-3.5" />
                {linkedInMode ? "New LinkedIn draft" : videoEditorMode ? "New video draft" : "New post"}
              </Button>
            ) : null}
          </div>
        }
      />

      {showForm && canCreatePost ? (
        linkedInMode || videoEditorMode ? (
          <section className={marketingCard}>
            <MarketingReviewSectionHeader
              tone="preview"
              icon={Sparkles}
              title={linkedInMode ? "New LinkedIn post draft" : "New video draft"}
              description="Add topic, company, theme, and optional media before sending to marketing head"
            />

            <div className="space-y-3 p-4">
              <LinkedInDraftFormField icon={PenLine} label="Topic" required highlight>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  placeholder="What is this post about?"
                  className={linkedInFieldClass}
                />
              </LinkedInDraftFormField>

              <LinkedInDraftFormField icon={Building2} label="Company" required highlight>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Which company is this post for?"
                  className="h-10 rounded-lg shadow-sm"
                />
              </LinkedInDraftFormField>

              <LinkedInDraftFormField icon={Palette} label="Theme">
                <textarea
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  rows={4}
                  placeholder="Describe the mood, layout, and visual direction for the post image or video (e.g. minimal corporate, product launch, festive)."
                  className={linkedInFieldClass}
                />
              </LinkedInDraftFormField>

              <LinkedInDraftFormField icon={ImageIcon} label="Photo or video">
                <MarketingBannerUploadField
                  disabled={creating}
                  previewUrl={postMediaPreview}
                  previewIsVideo={postMediaIsVideo}
                  accept="image/*,video/*"
                  title="Upload media"
                  chooseLabel="Choose image or video"
                  hint="Upload the visual that will accompany this LinkedIn post (image or short video)."
                  onFileSelected={onPostMediaSelected}
                />
              </LinkedInDraftFormField>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-4 py-3.5">
              <p className="text-xs text-muted-foreground">
                <span className="text-destructive">*</span> Topic and company are required
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="bg-background"
                  onClick={() => void onCreate(false)}
                  disabled={!linkedInFormReady || creating}
                >
                  Save as draft
                </Button>
                {canSendToHead ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void onCreate(true)}
                    disabled={!linkedInFormReady || creating}
                  >
                    Send to marketing head
                  </Button>
                ) : null}
              </div>
            </div>
          </section>
        ) : (
        <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
          <p className="text-sm font-medium">New content for verification</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Content type</label>
                  <select
                    value={contentType}
                    onChange={(e) => {
                      setContentType(e.target.value);
                      if (!isBannerContentType(e.target.value)) {
                        setBannerFile(null);
                        if (bannerPreview) URL.revokeObjectURL(bannerPreview);
                        setBannerPreview(null);
                      }
                    }}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {contentKinds.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="LinkedIn post — product launch"
                  />
                </div>
              </div>
              {isBannerContentType(contentType) ? (
                <MarketingBannerUploadField
                  disabled={creating}
                  previewUrl={bannerPreview}
                  onFileSelected={onBannerSelected}
                  hint="Required for banner posts. You can also add caption text below (optional)."
                />
              ) : null}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  {isBannerContentType(contentType) ? "Caption / copy (optional)" : "Post text (for verification)"}
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  placeholder={
                    isBannerContentType(contentType)
                      ? "Optional caption or notes for the banner…"
                      : "Write the full post copy here. Media and marketing head will verify this text in the pipeline."
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Hashtags</label>
                <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#launch #product #B2B" />
              </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void onCreate(false)}
              disabled={!genericFormReady || creating}
            >
              Save as draft
            </Button>
            {canSendToHead ? (
              <Button
                type="button"
                size="sm"
                onClick={() => void onCreate(true)}
                disabled={!genericFormReady || creating}
              >
                Submit for verification
              </Button>
            ) : null}
          </div>
        </div>
        )
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={sectionWorkflowMode ? (linkedInMode ? "Search your LinkedIn posts…" : "Search your videos…") : "Search content…"}
          className="max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">All statuses</option>
          {["draft", "in_review", "changes_required", "media_approved", "approved", "scheduled", "published", "archived", "rejected"].map((s) => (
            <option key={s} value={s}>
              {formatMarketingStatus(s)}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className={`${marketingTableShell} overflow-x-auto`}>
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className={marketingTableHead}>
            <tr>
              <th className="px-3 py-2">Number</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Post preview</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
              .map((row) => (
                <ContentRow
                  key={row.id}
                  row={row}
                  perms={perms}
                  onVerify={() => {
                    setReviewItem(row);
                    setReviewOpen(true);
                  }}
                />
              ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  {linkedInMode
                    ? "No LinkedIn drafts yet. Create one and send it to marketing head for approval."
                    : videoEditorMode
                      ? "No video drafts yet. Create one and send it to marketing head for approval."
                      : "No content items yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <MarketingContentReviewDialog
        item={reviewItem}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onDone={(updated) => {
          void load();
          if (updated) setReviewItem(updated);
        }}
      />
    </div>
  );
}

function contentActionLabel(
  row: MarketingContentItem,
  perms: ReturnType<typeof useMarketingPermissions>,
): { label: string; variant: "default" | "outline"; href?: string } | null {
  if (isMarketingContentLocked(row)) {
    return { label: "View in archive", variant: "outline" };
  }

  const linkedInMode = isLinkedInHandler(perms);
  const videoEditorMode = isVideoEditor(perms);

  if (canLinkedInHandlerSubmitFinalDraftToHead(row, perms.userId)) {
    return { label: "Send final draft to head", variant: "default" };
  }
  if (canVideoEditorSubmitFinalDraftToHead(row, perms.userId)) {
    return { label: "Send final draft to head", variant: "default" };
  }
  if (canLinkedInHandlerSendToPublisher(row, perms.userId)) {
    return { label: "Send to publisher", variant: "default" };
  }
  if (canVideoEditorSendToPublisher(row, perms.userId)) {
    return { label: "Send to publisher", variant: "default" };
  }
  if (canMarkLinkedInAsPublished(perms, row)) {
    return { label: "Mark as published", variant: "default" };
  }
  if (canMarkVideoAsPublished(perms, row)) {
    return { label: "Mark as published", variant: "default" };
  }
  if (linkedInHandlerAwaitingPublisher(row) && linkedInMode) {
    return { label: "View status", variant: "outline" };
  }
  if (videoEditorAwaitingPublisher(row) && videoEditorMode) {
    return { label: "View status", variant: "outline" };
  }

  const needsPostingReport = canUserReportPosting(row, perms.userId, {
    canSubmit: perms.canSubmit,
    canPublish: perms.canPublish,
    canApprove: perms.canApprove,
    canVerify: perms.canVerify,
  });
  if (needsPostingReport) {
    return { label: "Tell head: Posted?", variant: "default" };
  }
  if (
    perms.canApprove &&
    usesLinkedInSectionWorkflow(row) &&
    (row.status === "in_review" || row.status === "changes_required")
  ) {
    return { label: "Approve sections", variant: "default", href: `/marketing/approvals/${row.id}` };
  }
  if (
    perms.canApprove &&
    usesVideoSectionWorkflow(row) &&
    (row.status === "in_review" || row.status === "changes_required")
  ) {
    return { label: "Approve sections", variant: "default", href: `/marketing/approvals/${row.id}` };
  }
  if (perms.canApproveMedia && row.status === "in_review" && !usesLinkedInSectionWorkflow(row) && !usesVideoSectionWorkflow(row)) {
    return { label: "Review & feedback", variant: "default" };
  }
  if (perms.canApprove && row.status === "media_approved") {
    return { label: "Head approve", variant: "default" };
  }
  if (perms.canPublish && (row.status === "approved" || row.status === "scheduled")) {
    if (hasLinkedInSectionApproval(row) || hasVideoSectionApproval(row)) {
      return null;
    }
    return { label: "Post & confirm", variant: "default" };
  }
  if (
    (perms.canCreate || videoEditorMode || linkedInMode) &&
    (row.status === "draft" || row.status === "changes_required") &&
    perms.userId &&
    row.created_by_id === perms.userId
  ) {
    return {
      label: linkedInMode || videoEditorMode ? "Send for approval" : "Edit & submit",
      variant: "default",
    };
  }
  if (
    perms.canApproveMedia ||
    perms.canApprove ||
    perms.canPublish ||
    perms.canSubmit ||
    perms.canVerify
  ) {
    return { label: "Open", variant: "outline" };
  }
  return null;
}

function ContentRow({
  row,
  perms,
  onVerify,
}: {
  row: MarketingContentItem;
  perms: ReturnType<typeof useMarketingPermissions>;
  onVerify: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [timeline, setTimeline] = useState<MarketingActivityLog[]>([]);

  const action = contentActionLabel(row, perms);

  const loadTimeline = async () => {
    if (timeline.length > 0) {
      setExpanded((v) => !v);
      return;
    }
    const items = await getContentTimeline(row.id);
    setTimeline(items);
    setExpanded(true);
  };

  const preview = row.body ? (row.body.length > 80 ? `${row.body.slice(0, 80)}…` : row.body) : "—";

  return (
    <>
      <tr className={marketingTableRow}>
        <td className="px-3 py-2 font-mono text-xs">{row.content_number}</td>
        <td className="px-3 py-2">
          <button type="button" className="font-medium text-left hover:underline" onClick={() => void loadTimeline()}>
            {row.title}
          </button>
        </td>
        <td className="px-3 py-2">{formatMarketingStatus(row.content_type)}</td>
        <td className="px-3 py-2">
          <FinanceStatusBadge status={row.status} />
          {linkedInPublishStatusLabel(row) || videoPublishStatusLabel(row) ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {linkedInPublishStatusLabel(row) || videoPublishStatusLabel(row)}
            </p>
          ) : null}
        </td>
        <td className="max-w-[200px] truncate px-3 py-2 text-xs text-muted-foreground">{preview}</td>
        <td className="px-3 py-2">
          {action ? (
            action.href ? (
              <Link href={action.href}>
                <Button type="button" size="sm" variant={action.variant}>
                  {action.label}
                </Button>
              </Link>
            ) : (
              <Button type="button" size="sm" variant={action.variant} onClick={onVerify}>
                {action.label}
              </Button>
            )
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      </tr>
      {expanded ? (
        <tr className={cn(marketingTableRow, "bg-muted/20")}>
          <td colSpan={6} className="px-4 py-3">
            {row.body ? (
              <p className="mb-3 whitespace-pre-wrap text-sm">{row.body}</p>
            ) : null}
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Activity timeline</p>
            <ul className="space-y-1 text-xs">
              {timeline.map((item) => (
                <li key={item.id}>
                  <span className="font-medium">{formatMarketingStatus(item.action)}</span>
                  {item.details ? <span className="text-muted-foreground"> — {item.details}</span> : null}
                  <span className="ml-2 text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span>
                </li>
              ))}
              {timeline.length === 0 ? <li className="text-muted-foreground">No activity yet.</li> : null}
            </ul>
          </td>
        </tr>
      ) : null}
    </>
  );
}
