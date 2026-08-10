"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { MarketingBannerUploadField } from "@/components/marketing/marketing-banner-upload-field";
import { MarketingContentReviewDialog } from "@/components/marketing/marketing-content-review-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import {
  BANNER_VERIFICATION_ITEM_KEY,
  isBannerContentType,
  uploadContentAssetForItem,
} from "@/lib/marketing-content-upload";
import { isLinkedInHandler, isMarketingHead } from "@/lib/marketing-verification";
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
import { cn } from "@/lib/utils";
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

const LINKEDIN_DRAFT_TABS = [
  { id: "content", label: "Content" },
  { id: "theme", label: "Theme" },
  { id: "fonts", label: "Fonts" },
] as const;

type LinkedInDraftSection = (typeof LINKEDIN_DRAFT_TABS)[number]["id"];

export function MarketingContentPage() {
  const searchParams = useSearchParams();
  const perms = useMarketingPermissions();
  const linkedInMode = isLinkedInHandler(perms);
  const canCreatePost = perms.canCreate && !isMarketingHead(perms);
  const canSendToHead = perms.canSubmit || (linkedInMode && perms.canVerify);
  const contentKinds = linkedInMode
    ? CONTENT_KINDS.filter((k) => k.value === "social_post")
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
  const [linkedInSection, setLinkedInSection] = useState<LinkedInDraftSection>("content");
  const [theme, setTheme] = useState("");
  const [fontName, setFontName] = useState("");
  const [fontSize, setFontSize] = useState("");
  const [colorCodes, setColorCodes] = useState("");
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
          mine: linkedInMode || undefined,
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
  }, [q, status, linkedInMode]);

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
    setLinkedInSection("content");
    setTheme("");
    setFontName("");
    setFontSize("");
    setColorCodes("");
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

  const onCreate = async (submitAfterCreate: boolean) => {
    if (!title.trim() || !branchId) return;
    const isBanner = isBannerContentType(contentType);
    if (submitAfterCreate && isBanner && !bannerFile) {
      setError("Upload a banner image before submitting for verification.");
      return;
    }
    if (submitAfterCreate && !isBanner && !body.trim()) {
      setError("Add post text before submitting for verification.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        branch_id: branchId,
        content_type: contentType,
        body: body.trim() || null,
        hashtags: hashtags.trim() || null,
      };
      if (linkedInMode) {
        if (theme.trim()) payload.theme = theme.trim();
        if (fontName.trim()) payload.font_name = fontName.trim();
        if (fontSize.trim()) payload.font_size = fontSize.trim();
        if (colorCodes.trim()) payload.color_codes = colorCodes.trim();
      }
      const created = await createContentItem(payload);
      if (isBanner && bannerFile) {
        await uploadContentAssetForItem(
          created.id,
          created.company_id,
          bannerFile,
          BANNER_VERIFICATION_ITEM_KEY,
        );
      }
      if (linkedInMode && postMediaFile) {
        await uploadContentAssetForItem(
          created.id,
          created.company_id,
          postMediaFile,
          "linkedin_content",
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
    <div className="space-y-4">
      <PageHeader
        title={linkedInMode ? "LinkedIn posts" : "Content"}
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
                onClick={() => {
                  setLinkedInSection("content");
                  setShowForm((v) => !v);
                }}
              >
                <Plus className="size-3.5" />
                {linkedInMode ? "New LinkedIn draft" : "New post"}
              </Button>
            ) : null}
          </div>
        }
      />

      {showForm && canCreatePost ? (
        <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
          {linkedInMode ? (
            <div className="flex flex-wrap gap-2">
              {LINKEDIN_DRAFT_TABS.map((tab) => (
                <Button
                  key={tab.id}
                  type="button"
                  size="sm"
                  variant={linkedInSection === tab.id ? "default" : "outline"}
                  className={cn(linkedInSection !== tab.id && "bg-background")}
                  onClick={() => setLinkedInSection(tab.id)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          ) : null}
          <p className="text-sm font-medium">
            {linkedInMode ? "New LinkedIn post draft" : "New content for verification"}
          </p>
          {linkedInMode ? (
            <>
              {linkedInSection === "content" ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Post title</label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Q1 product launch — LinkedIn"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">LinkedIn post copy</label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={5}
                      placeholder="Write your LinkedIn post. Marketing head will review before publishing."
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Hashtags</label>
                    <Input
                      value={hashtags}
                      onChange={(e) => setHashtags(e.target.value)}
                      placeholder="#launch #product #B2B"
                    />
                  </div>
                  <MarketingBannerUploadField
                    disabled={creating}
                    previewUrl={postMediaPreview}
                    previewIsVideo={postMediaIsVideo}
                    accept="image/*,video/*"
                    title="Post image or video"
                    chooseLabel="Choose image or video"
                    hint="Upload the visual that will accompany this LinkedIn post (image or short video)."
                    onFileSelected={onPostMediaSelected}
                  />
                </div>
              ) : null}
              {linkedInSection === "theme" ? (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Visual theme</label>
                  <textarea
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    rows={5}
                    placeholder="Describe the mood, layout, and visual direction for the post image or video (e.g. minimal corporate, product launch, festive)."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              ) : null}
              {linkedInSection === "fonts" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs text-muted-foreground">Font family</label>
                    <Input
                      value={fontName}
                      onChange={(e) => setFontName(e.target.value)}
                      placeholder="e.g. Inter, Helvetica Neue"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Font size</label>
                    <Input
                      value={fontSize}
                      onChange={(e) => setFontSize(e.target.value)}
                      placeholder="e.g. 24px headline, 16px body"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Color codes</label>
                    <Input
                      value={colorCodes}
                      onChange={(e) => setColorCodes(e.target.value)}
                      placeholder="#0A66C2, #FFFFFF"
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
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
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void onCreate(false)}
              disabled={!branchId || creating}
            >
              Save as draft
            </Button>
            {canSendToHead ? (
              <Button type="button" size="sm" onClick={() => void onCreate(true)} disabled={!branchId || creating}>
                {linkedInMode ? "Send to marketing head" : "Submit for verification"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={linkedInMode ? "Search your LinkedIn posts…" : "Search content…"}
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

      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/30 text-xs uppercase text-muted-foreground">
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
                  {linkedInMode ? "No LinkedIn drafts yet. Create one and send it to marketing head for approval." : "No content items yet."}
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

  if (canLinkedInHandlerSubmitFinalDraftToHead(row, perms.userId)) {
    return { label: "Send final draft to head", variant: "default" };
  }
  if (canLinkedInHandlerSendToPublisher(row, perms.userId)) {
    return { label: "Send to publisher", variant: "default" };
  }
  if (canMarkLinkedInAsPublished(perms, row)) {
    return { label: "Mark as published", variant: "default" };
  }
  if (linkedInHandlerAwaitingPublisher(row) && linkedInMode) {
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
  if (perms.canApproveMedia && row.status === "in_review" && !usesLinkedInSectionWorkflow(row)) {
    return { label: "Review & feedback", variant: "default" };
  }
  if (perms.canApprove && row.status === "media_approved") {
    return { label: "Head approve", variant: "default" };
  }
  if (perms.canPublish && (row.status === "approved" || row.status === "scheduled")) {
    if (hasLinkedInSectionApproval(row)) {
      return null;
    }
    return { label: "Post & confirm", variant: "default" };
  }
  if (
    perms.canCreate &&
    (row.status === "draft" || row.status === "changes_required") &&
    perms.userId &&
    row.created_by_id === perms.userId
  ) {
    return {
      label: linkedInMode ? "Send for approval" : "Edit & submit",
      variant: "default",
    };
  }
  if (
    perms.canApproveMedia ||
    perms.canApprove ||
    perms.canPublish ||
    perms.canSubmit
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
      <tr className="border-b border-border/50">
        <td className="px-3 py-2 font-mono text-xs">{row.content_number}</td>
        <td className="px-3 py-2">
          <button type="button" className="font-medium text-left hover:underline" onClick={() => void loadTimeline()}>
            {row.title}
          </button>
        </td>
        <td className="px-3 py-2">{formatMarketingStatus(row.content_type)}</td>
        <td className="px-3 py-2">
          <FinanceStatusBadge status={row.status} />
          {linkedInPublishStatusLabel(row) ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{linkedInPublishStatusLabel(row)}</p>
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
        <tr className="border-b border-border/50 bg-muted/20">
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
