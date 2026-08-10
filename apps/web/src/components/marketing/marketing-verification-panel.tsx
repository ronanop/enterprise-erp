"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarketingBannerUploadField } from "@/components/marketing/marketing-banner-upload-field";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import {
  BANNER_VERIFICATION_ITEM_KEY,
  isBannerContentType,
  uploadContentAssetForItem,
} from "@/lib/marketing-content-upload";
import {
  canReportPostingToHead,
  canResubmitSectionItem,
  getVerificationItemInputType,
  getVerificationTextField,
  HEAD_REVIEW_SECTIONS,
  inferSubmitterRole,
  isLinkedInVerificationRole,
  isMarketingHead,
  isPriorSectionApproved,
  isPublisherOnly,
  linkedInContentMediaReady,
  linkedInContentTextReady,
  linkedInFontsReady,
  linkedInSectionGateMessage,
  LINKEDIN_CONTENT_MEDIA_ROLES,
  resolveHeadReviewSectionState,
  verificationTextFieldLabel,
  VERIFIER_ROLE_LABELS,
  type HeadReviewSectionId,
  type VerificationTextField,
} from "@/lib/marketing-verification";
import {
  getLinkedInSectionDisplayStatus,
  hasLinkedInSectionApproval,
  isLinkedInPriorSectionApproved,
  LINKEDIN_HEAD_SECTIONS,
  linkedInSectionRemarks,
  linkedInSectionWaitingMessage,
  canLinkedInHandlerSendToPublisher,
  canLinkedInHandlerSubmitFinalDraftToHead,
  canMarkLinkedInAsPublished,
  linkedInFinalDraftAwaitingHead,
  linkedInHandlerAwaitingPublisher,
  linkedInPublishStatusLabel,
  usesLinkedInSectionWorkflow,
} from "@/lib/linkedin-section-approval";
import { MarketingLinkedInFinalDraftPanel } from "@/components/marketing/marketing-linkedin-final-draft-panel";
import { MarketingLinkedInHeadSectionApproval } from "@/components/marketing/marketing-linkedin-head-section-approval";
import {
  SectionApprovalStatusBadge,
  SectionHeadRemarks,
} from "@/components/marketing/marketing-section-status-badge";
import { cn } from "@/lib/utils";
import {
  ApiClientError,
  getContentWorkflow,
  headReviewVerificationItem,
  linkedInSendToPublisher,
  listContentAssets,
  marketingAssetUrl,
  publishContentItem,
  publisherUploadReport,
  reportContentPosting,
  sendToPublisher,
  setPostingTimeline,
  submitVerificationItem,
  updateContentItem,
  type MarketingContentItem,
  type MarketingContentWorkflow,
  type MarketingLinkedAsset,
  type MarketingVerification,
  canUserReportPosting,
} from "@/services/marketing-service";

const WORKFLOW_POLL_MS = 10_000;

type MarketingVerificationPanelProps = {
  item: MarketingContentItem;
  onUpdated: () => void;
  /** When true, head approval actions render in the dialog footer instead of inline. */
  headApprovalInFooter?: boolean;
};

function getHeadSubmittedItems(verifications: MarketingVerification[]) {
  const rows: Array<{ verification: MarketingVerification; checkItem: MarketingVerification["items"][number] }> = [];
  for (const verification of verifications) {
    for (const checkItem of verification.items) {
      if (checkItem.status !== "submitted") continue;
      rows.push({ verification, checkItem });
    }
  }
  return rows;
}

type MarketingHeadApprovalFooterProps = {
  item: MarketingContentItem;
  onUpdated: () => void;
};

export function MarketingHeadApprovalFooter({ item, onUpdated }: MarketingHeadApprovalFooterProps) {
  const perms = useMarketingPermissions();
  const head = isMarketingHead(perms);
  const [workflow, setWorkflow] = useState<MarketingContentWorkflow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headComments, setHeadComments] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try {
      setWorkflow(await getContentWorkflow(item.id));
    } catch {
      setWorkflow(null);
    }
  }, [item.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!head) return null;

  const linkedInMode =
    usesLinkedInSectionWorkflow(item) &&
    (hasLinkedInSectionApproval(item) ||
      item.status === "in_review" ||
      item.status === "changes_required");

  if (linkedInMode) {
    return <MarketingLinkedInHeadSectionApproval item={item} onUpdated={onUpdated} compact />;
  }

  if (!workflow) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
        <p className="text-sm text-muted-foreground">Loading approval options…</p>
      </div>
    );
  }

  const submittedRows = getHeadSubmittedItems(workflow.verifications);
  if (submittedRows.length === 0) return null;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="text-sm font-medium">Approval</p>
      {submittedRows.map(({ verification, checkItem }) => {
        const commentKey = `${verification.verifier_role}:${checkItem.item_key}`;
        return (
          <div key={commentKey} className="space-y-2 rounded-md border border-border/60 bg-background p-3 text-sm">
            <div>
              <p className="font-medium">{checkItem.item_label}</p>
              <p className="text-xs text-muted-foreground">
                {VERIFIER_ROLE_LABELS[verification.verifier_role] ?? verification.verifier_role}
                {checkItem.submitted_by_name ? ` · submitted by ${checkItem.submitted_by_name}` : ""}
              </p>
            </div>
            <textarea
              rows={2}
              placeholder="Feedback to sender (required for send back or reject)…"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={headComments[commentKey] ?? ""}
              onChange={(e) =>
                setHeadComments((prev) => ({
                  ...prev,
                  [commentKey]: e.target.value,
                }))
              }
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    headReviewVerificationItem(item.id, {
                      verifier_role: verification.verifier_role,
                      item_key: checkItem.item_key,
                      status: "approved",
                    }),
                  )
                }
              >
                Approve {checkItem.item_label}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    headReviewVerificationItem(item.id, {
                      verifier_role: verification.verifier_role,
                      item_key: checkItem.item_key,
                      status: "changes_requested",
                      comments: headComments[commentKey],
                    }),
                  )
                }
              >
                Send feedback
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    headReviewVerificationItem(item.id, {
                      verifier_role: verification.verifier_role,
                      item_key: checkItem.item_key,
                      status: "rejected",
                      comments: headComments[commentKey],
                    }),
                  )
                }
              >
                Reject
              </Button>
            </div>
          </div>
        );
      })}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function MarketingVerificationPanel({
  item,
  onUpdated,
  headApprovalInFooter = false,
}: MarketingVerificationPanelProps) {
  const perms = useMarketingPermissions();
  const [workflow, setWorkflow] = useState<MarketingContentWorkflow | null>(null);
  const [assets, setAssets] = useState<MarketingLinkedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plannedAt, setPlannedAt] = useState("");
  const [timelineNotes, setTimelineNotes] = useState("");
  const [headComments, setHeadComments] = useState<Record<string, string>>({});
  const [postingReportNotes, setPostingReportNotes] = useState("");
  const [postingReportUrl, setPostingReportUrl] = useState("");
  const [contentFields, setContentFields] = useState<Record<VerificationTextField, string>>({
    body: "",
    hashtags: "",
    theme: "",
    font_name: "",
    font_size: "",
    color_codes: "",
  });

  const myRole = inferSubmitterRole(perms);
  const head = isMarketingHead(perms);
  const publisher = isPublisherOnly(perms);
  const linkedInFlow = hasLinkedInSectionApproval(item);
  const handlerFinalDraftStage =
    isLinkedInVerificationRole(myRole ?? "") &&
    (canLinkedInHandlerSubmitFinalDraftToHead(item, perms.userId) ||
      canLinkedInHandlerSendToPublisher(item, perms.userId) ||
      linkedInFinalDraftAwaitingHead(item) ||
      linkedInHandlerAwaitingPublisher(item));
  const myVerification = workflow?.verifications.find((v) => v.verifier_role === myRole);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [wf, linked] = await Promise.all([getContentWorkflow(item.id), listContentAssets(item.id)]);
      setWorkflow(wf);
      setAssets(linked);
    } catch {
      setWorkflow(null);
    } finally {
      setLoading(false);
    }
  }, [item.id]);

  useEffect(() => {
    setPostingReportNotes("");
    setPostingReportUrl(item.target_url ?? "");
    setContentFields({
      body: item.body ?? "",
      hashtags: item.hashtags ?? "",
      theme: item.theme ?? "",
      font_name: item.font_name ?? "",
      font_size: item.font_size ?? "",
      color_codes: item.color_codes ?? "",
    });
  }, [item]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), WORKFLOW_POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (loading) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
        Loading verification workflow…
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-sm text-destructive">Could not load verification workflow.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
          Retry
        </Button>
      </div>
    );
  }

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (file: File, assetKind: "image" | "video", itemKey: string) => {
    setBusy(true);
    setError(null);
    try {
      await uploadContentAssetForItem(item.id, item.company_id, file, itemKey, assetKind);
      await refresh();
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const assetsForItem = (itemKey: string) => assets.filter((a) => a.asset_role === itemKey);

  const linkedInMediaAssets = () =>
    assets.filter((a) => a.asset_role && LINKEDIN_CONTENT_MEDIA_ROLES.includes(a.asset_role as (typeof LINKEDIN_CONTENT_MEDIA_ROLES)[number]));

  const saveContentFields = async (fields: Partial<Record<VerificationTextField, string>>) => {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, string | null> = {};
      for (const [key, value] of Object.entries(fields)) {
        payload[key] = value?.trim() || null;
      }
      await updateContentItem(item.id, payload);
      setContentFields((prev) => ({ ...prev, ...fields }));
      await refresh();
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const saveContentField = async (field: VerificationTextField) => {
    setBusy(true);
    setError(null);
    try {
      const value = contentFields[field].trim();
      await updateContentItem(item.id, { [field]: value || null });
      await refresh();
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const renderTextItemEditor = (checkItem: MarketingVerification["items"][number]) => {
    const field = getVerificationTextField(checkItem.item_key);
    if (!field) return null;
    const value = contentFields[field];
    const label = verificationTextFieldLabel(field);
    const isMultiline = field === "body";

    return (
      <div className="mt-2 space-y-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
        <label className="block text-xs font-medium text-foreground">{label}</label>
        {isMultiline ? (
          <textarea
            rows={4}
            value={value}
            disabled={busy}
            placeholder="Enter post text for marketing head to verify…"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            onChange={(e) => setContentFields((prev) => ({ ...prev, [field]: e.target.value }))}
          />
        ) : (
          <Input
            value={value}
            disabled={busy}
            placeholder={
              field === "hashtags"
                ? "#launch #product"
                : field === "theme"
                  ? "e.g. Product launch, festive, minimal"
                  : `Enter ${label.toLowerCase()}…`
            }
            onChange={(e) => setContentFields((prev) => ({ ...prev, [field]: e.target.value }))}
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void saveContentField(field)}>
            Save {label.toLowerCase()}
          </Button>
        </div>
        {!value.trim() ? (
          <p className="text-[11px] text-amber-700">Add {label.toLowerCase()} before submitting to marketing head.</p>
        ) : null}
      </div>
    );
  };

  const renderItemAssetPreview = (itemKey: string) => {
    const linked = assetsForItem(itemKey);
    if (linked.length === 0) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {linked.map((link) => {
          const url = marketingAssetUrl(link.asset.file_url);
          const isVideo =
            link.asset.asset_kind === "video" || link.asset.mime_type?.startsWith("video/");
          return (
            <div key={link.id} className="max-w-[140px] overflow-hidden rounded border border-border/70">
              {isVideo ? (
                <video src={url} controls className="max-h-24 w-full bg-black" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={link.asset.name} className="max-h-24 w-full object-contain" />
              )}
              <p className="truncate px-1 py-0.5 text-[10px] text-muted-foreground">{link.asset.name}</p>
            </div>
          );
        })}
      </div>
    );
  };

  const renderLinkedInSubmitterItems = () => {
    const contentReady = linkedInContentTextReady(contentFields.body, contentFields.hashtags);
    const themeReady = Boolean(contentFields.theme.trim());
    const fontsReady = linkedInFontsReady(contentFields);
    const sections = item.linkedin_head_sections;
    const submittedToHead = hasLinkedInSectionApproval(item);

    const sectionReady = (sectionId: HeadReviewSectionId) => {
      if (sectionId === "content") return contentReady;
      if (sectionId === "theme") return themeReady;
      return fontsReady;
    };

    return (
      <div className="space-y-4">
        {submittedToHead ? (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs text-emerald-800">
            Sent to marketing head. They will review Content, then Theme, then Fonts in order.
          </p>
        ) : (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-800">
            Complete all sections, then use <strong>Send to marketing head</strong> on the create page to submit for review.
          </p>
        )}

        <div className="flex flex-wrap gap-2 rounded-md border border-border/60 bg-muted/20 p-2">
          {LINKEDIN_HEAD_SECTIONS.map((section) => {
            const displayStatus = submittedToHead
              ? getLinkedInSectionDisplayStatus(sections, section.id, item)
              : sectionReady(section.id)
                ? "pending"
                : "missing";
            return (
              <div key={section.id} className="flex items-center gap-2 text-xs">
                <span className="font-medium">{section.label}</span>
                <SectionApprovalStatusBadge status={displayStatus} />
              </div>
            );
          })}
        </div>

        {LINKEDIN_HEAD_SECTIONS.map((section) => {
          const displayStatus = submittedToHead
            ? getLinkedInSectionDisplayStatus(sections, section.id, item)
            : sectionReady(section.id)
              ? "pending"
              : "missing";
          const remarks = submittedToHead ? linkedInSectionRemarks(sections, section.id) : null;
          const gateMessage = submittedToHead
            ? linkedInSectionWaitingMessage(sections, section.id, item)
            : null;
          const sectionUnlocked = submittedToHead
            ? isLinkedInPriorSectionApproved(sections, section.id)
            : true;

          return (
            <div
              key={section.id}
              className={cn("rounded border border-border/60 p-3 text-xs", !sectionUnlocked && "opacity-80")}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="font-medium">{section.label}</p>
                  <SectionApprovalStatusBadge status={displayStatus} />
                </div>
              </div>

              <SectionHeadRemarks remarks={remarks} status={displayStatus} />

              {gateMessage ? (
                <p className="mt-2 text-[11px] text-muted-foreground">{gateMessage}</p>
              ) : null}

              {displayStatus === "approved" ? (
                <p className="mt-2 text-[11px] font-medium text-emerald-700">Approved by marketing head</p>
              ) : null}

              {section.id === "content" ? (
                <div className="mt-2 space-y-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
                  <label className="block text-xs font-medium text-foreground">Post text / copy</label>
                  <textarea
                    rows={4}
                    value={contentFields.body}
                    disabled={busy}
                    placeholder="Write your LinkedIn post copy…"
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    onChange={(e) => setContentFields((prev) => ({ ...prev, body: e.target.value }))}
                  />
                  <label className="block text-xs font-medium text-foreground">Hashtags</label>
                  <Input
                    value={contentFields.hashtags}
                    disabled={busy}
                    placeholder="#launch #product"
                    onChange={(e) => setContentFields((prev) => ({ ...prev, hashtags: e.target.value }))}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void saveContentFields({
                        body: contentFields.body,
                        hashtags: contentFields.hashtags,
                      })
                    }
                  >
                    Save content fields
                  </Button>
                  <MarketingBannerUploadField
                    disabled={busy}
                    previewUrl={
                      linkedInMediaAssets()[0]
                        ? marketingAssetUrl(linkedInMediaAssets()[0].asset.file_url)
                        : null
                    }
                    previewIsVideo={
                      linkedInMediaAssets()[0]?.asset.asset_kind === "video"
                      || linkedInMediaAssets()[0]?.asset.mime_type?.startsWith("video/")
                    }
                    accept="image/*,video/*"
                    title="Post image or video"
                    chooseLabel="Choose image or video"
                    hint="Upload the visual that will accompany this LinkedIn post."
                    onFileSelected={(file) => {
                      const kind = file.type.startsWith("video/") ? "video" : "image";
                      void handleUpload(file, kind, "linkedin_content");
                    }}
                  />
              {!contentReady ? (
                <p className="text-[11px] text-amber-700">
                  Add post copy and hashtags before submitting Content to marketing head.
                </p>
              ) : null}
                  {linkedInMediaAssets().length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {linkedInMediaAssets().map((link) => {
                        const url = marketingAssetUrl(link.asset.file_url);
                        const isVideo =
                          link.asset.asset_kind === "video" || link.asset.mime_type?.startsWith("video/");
                        return (
                          <div key={link.id} className="max-w-[140px] overflow-hidden rounded border border-border/70">
                            {isVideo ? (
                              <video src={url} controls className="max-h-24 w-full bg-black" />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={url} alt={link.asset.name} className="max-h-24 w-full object-contain" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {section.id === "theme" ? (
                <div className="mt-2 space-y-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
                  <label className="block text-xs font-medium text-foreground">Visual theme</label>
                  <textarea
                    rows={4}
                    value={contentFields.theme}
                    disabled={busy}
                    placeholder="Describe the mood, layout, and visual direction for the post image or video."
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    onChange={(e) => setContentFields((prev) => ({ ...prev, theme: e.target.value }))}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void saveContentFields({ theme: contentFields.theme })}
                  >
                    Save theme
                  </Button>
                  {!themeReady ? (
                    <p className="text-[11px] text-amber-700">Add a theme before submitting to marketing head.</p>
                  ) : null}
                </div>
              ) : null}

              {section.id === "fonts" ? (
                <div className="mt-2 space-y-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
                  <label className="block text-xs font-medium text-foreground">Font family</label>
                  <Input
                    value={contentFields.font_name}
                    disabled={busy}
                    placeholder="e.g. Inter, Helvetica Neue"
                    onChange={(e) => setContentFields((prev) => ({ ...prev, font_name: e.target.value }))}
                  />
                  <label className="block text-xs font-medium text-foreground">Font size</label>
                  <Input
                    value={contentFields.font_size}
                    disabled={busy}
                    placeholder="e.g. 24px headline, 16px body"
                    onChange={(e) => setContentFields((prev) => ({ ...prev, font_size: e.target.value }))}
                  />
                  <label className="block text-xs font-medium text-foreground">Color codes</label>
                  <Input
                    value={contentFields.color_codes}
                    disabled={busy}
                    placeholder="#0A66C2, #FFFFFF"
                    onChange={(e) => setContentFields((prev) => ({ ...prev, color_codes: e.target.value }))}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void saveContentFields({
                        font_name: contentFields.font_name,
                        font_size: contentFields.font_size,
                        color_codes: contentFields.color_codes,
                      })
                    }
                  >
                    Save font styling
                  </Button>
                  {!fontsReady ? (
                    <p className="text-[11px] text-amber-700">
                      Complete font family, size, and color codes before submitting Fonts to marketing head.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSubmitterItems = (verification: MarketingVerification) => {
    if (isLinkedInVerificationRole(verification.verifier_role)) {
      return renderLinkedInSubmitterItems();
    }

    return (
    <div className="space-y-3">
      {verification.items.map((checkItem) => {
        if (
          checkItem.item_key === "text_copy" &&
          verification.items.some((i) => i.item_key === "content")
        ) {
          return null;
        }
        const inputType = getVerificationItemInputType(checkItem.item_key);
        const textField = getVerificationTextField(checkItem.item_key);
        const hasUpload = assetsForItem(checkItem.item_key).length > 0;
        const canSubmit = checkItem.status === "pending" || checkItem.status === "changes_requested";
        const needsUpload = inputType !== "text" && !hasUpload;
        const needsText = inputType === "text" && textField && !contentFields[textField].trim();

        return (
          <div key={checkItem.item_key} className="rounded border border-border/60 p-3 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{checkItem.item_label}</p>
                <p className="capitalize text-muted-foreground">{checkItem.status.replace(/_/g, " ")}</p>
                {checkItem.comments ? <p className="mt-1 text-amber-700">{checkItem.comments}</p> : null}
              </div>
              {canSubmit ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || needsUpload || Boolean(needsText)}
                  onClick={() => void run(() => submitVerificationItem(item.id, { item_key: checkItem.item_key }))}
                >
                  Submit to Head
                </Button>
              ) : null}
            </div>

            {inputType === "text" && canSubmit ? renderTextItemEditor(checkItem) : null}

            {inputType === "image" && canSubmit ? (
              <div className="mt-2 space-y-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
                <p className="font-medium text-foreground">Upload banner / ad / image</p>
                <label className="inline-flex cursor-pointer">
                  <Input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(f, "image", checkItem.item_key);
                      e.target.value = "";
                    }}
                  />
                  <span className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium">
                    Choose photo / banner
                  </span>
                </label>
                {needsUpload ? (
                  <p className="text-[11px] text-amber-700">Upload an image before submitting to marketing head.</p>
                ) : null}
              </div>
            ) : null}

            {inputType === "video" && canSubmit ? (
              <div className="mt-2 space-y-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
                <p className="font-medium text-foreground">Upload video file</p>
                <label className="inline-flex cursor-pointer">
                  <Input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(f, "video", checkItem.item_key);
                      e.target.value = "";
                    }}
                  />
                  <span className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium">
                    Choose video
                  </span>
                </label>
                {needsUpload ? (
                  <p className="text-[11px] text-amber-700">Upload a video before submitting to marketing head.</p>
                ) : null}
              </div>
            ) : null}

            {renderItemAssetPreview(checkItem.item_key)}
          </div>
        );
      })}
    </div>
    );
  };

  const renderLinkedInHeadPreview = (itemKey: string) => {
    if (itemKey === "linkedin_content") {
      return (
        <div className="mt-2 space-y-2">
          {item.title ? (
            <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-sm">
              <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">Post title</p>
              <p>{item.title}</p>
            </div>
          ) : null}
          {item.body ? (
            <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-sm">
              <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">Post text</p>
              <p className="whitespace-pre-wrap">{item.body}</p>
            </div>
          ) : null}
          {item.hashtags ? (
            <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-sm">
              <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">Hashtags</p>
              <p>{item.hashtags}</p>
            </div>
          ) : null}
          {linkedInMediaAssets().length > 0 ? (
            <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-sm">
              <p className="mb-2 text-[10px] font-medium uppercase text-muted-foreground">Post image / video</p>
              <div className="flex flex-wrap gap-2">
                {linkedInMediaAssets().map((link) => {
                  const url = marketingAssetUrl(link.asset.file_url);
                  const isVideo =
                    link.asset.asset_kind === "video" || link.asset.mime_type?.startsWith("video/");
                  return (
                    <div key={link.id} className="max-w-[180px] overflow-hidden rounded border border-border/70">
                      {isVideo ? (
                        <video src={url} controls className="max-h-32 w-full bg-black" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={link.asset.name} className="max-h-32 w-full object-contain" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      );
    }
    if (itemKey === "fonts") {
      return (
        <div className="mt-2 space-y-2 rounded-md border border-border/60 bg-muted/30 p-2 text-sm">
          <div>
            <p className="text-[10px] font-medium uppercase text-muted-foreground">Font family</p>
            <p>{item.font_name || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase text-muted-foreground">Font size</p>
            <p>{item.font_size || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase text-muted-foreground">Color codes</p>
            <p>{item.color_codes || "—"}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderHeadItemPreview = (itemKey: string) => {
    if (itemKey === "linkedin_content" || itemKey === "fonts") {
      return renderLinkedInHeadPreview(itemKey);
    }
    if (itemKey === "text_copy" || itemKey === "content") {
      return item.body ? (
        <div className="mt-2 rounded-md border border-border/60 bg-muted/30 p-2 text-sm">
          <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">Post text</p>
          <p className="whitespace-pre-wrap">{item.body}</p>
        </div>
      ) : null;
    }
    if (itemKey === "hashtags" && item.hashtags) {
      return (
        <div className="mt-2 rounded-md border border-border/60 bg-muted/30 p-2 text-sm">
          <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">Hashtags</p>
          <p>{item.hashtags}</p>
        </div>
      );
    }
    if (itemKey === "theme" && item.theme) {
      return (
        <div className="mt-2 rounded-md border border-border/60 bg-muted/30 p-2 text-sm">
          <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">Theme</p>
          <p>{item.theme}</p>
        </div>
      );
    }
    return renderItemAssetPreview(itemKey);
  };

  const renderHeadReview = (verification: MarketingVerification) => {
    const submitted = verification.items.filter((i) => i.status === "submitted");
    if (submitted.length === 0) return null;
    return (
      <div key={verification.id} className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
        <p className="text-sm font-medium">
          {VERIFIER_ROLE_LABELS[verification.verifier_role] ?? verification.verifier_role}
          {verification.requested_by_name ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              — requested by {verification.requested_by_name}
            </span>
          ) : null}
        </p>
        {submitted.map((checkItem) => (
          <div key={checkItem.item_key} className="space-y-1 rounded border border-border/60 bg-background p-2 text-xs">
            <p className="font-medium">{checkItem.item_label}</p>
            {checkItem.submitted_by_name ? (
              <p className="text-muted-foreground">Submitted by: {checkItem.submitted_by_name}</p>
            ) : null}
            {renderHeadItemPreview(checkItem.item_key)}
            {headApprovalInFooter ? null : (
              <>
                <textarea
                  rows={2}
                  placeholder="Feedback to sender…"
                  className="w-full rounded-md border border-input bg-background px-2 py-1"
                  value={headComments[`${verification.verifier_role}:${checkItem.item_key}`] ?? ""}
                  onChange={(e) =>
                    setHeadComments((prev) => ({
                      ...prev,
                      [`${verification.verifier_role}:${checkItem.item_key}`]: e.target.value,
                    }))
                  }
                />
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        headReviewVerificationItem(item.id, {
                          verifier_role: verification.verifier_role,
                          item_key: checkItem.item_key,
                          status: "approved",
                        }),
                      )
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        headReviewVerificationItem(item.id, {
                          verifier_role: verification.verifier_role,
                          item_key: checkItem.item_key,
                          status: "changes_requested",
                          comments: headComments[`${verification.verifier_role}:${checkItem.item_key}`],
                        }),
                      )
                    }
                  >
                    Send feedback
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        headReviewVerificationItem(item.id, {
                          verifier_role: verification.verifier_role,
                          item_key: checkItem.item_key,
                          status: "rejected",
                          comments: headComments[`${verification.verifier_role}:${checkItem.item_key}`],
                        }),
                      )
                    }
                  >
                    Reject
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderPostingTimeline = (verification: MarketingVerification) => {
    if (!canReportPostingToHead(perms, verification.overall_status)) return null;
    if (verification.sent_to_publisher_at) return null;
    return (
      <div className="space-y-2 rounded-md border border-violet-500/30 bg-violet-500/5 p-3 text-xs">
        <p className="font-medium">Posting timeline — tell marketing head when you will post</p>
        <Input
          type="datetime-local"
          value={plannedAt}
          onChange={(e) => setPlannedAt(e.target.value)}
        />
        <textarea
          rows={2}
          placeholder="Notes — e.g. posting tomorrow at 10am, or already posted at…"
          className="w-full rounded-md border border-input bg-background px-2 py-1"
          value={timelineNotes}
          onChange={(e) => setTimelineNotes(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() =>
              void run(() =>
                setPostingTimeline(item.id, {
                  verifier_role: verification.verifier_role,
                  planned_at: plannedAt ? new Date(plannedAt).toISOString() : undefined,
                  notes: timelineNotes || undefined,
                  posted: false,
                }),
              )
            }
          >
            Share posting date/time
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(() =>
                setPostingTimeline(item.id, {
                  verifier_role: verification.verifier_role,
                  notes: timelineNotes || undefined,
                  posted: true,
                }),
              )
            }
          >
            Yes — already posted
          </Button>
        </div>
      </div>
    );
  };

  const renderSendToPublisher = (verification: MarketingVerification) => {
    if (linkedInFlow) return null;
    if (
      verification.overall_status !== "awaiting_posting" &&
      verification.overall_status !== "approved"
    ) {
      return null;
    }
    if (!verification.posting_planned_at && verification.posting_confirmed !== true) return null;
    if (verification.sent_to_publisher_at) return null;
    if (verification.verifier_role !== myRole) return null;
    return (
      <Button
        type="button"
        size="sm"
        disabled={busy}
        onClick={() => void run(() => sendToPublisher(item.id, { verifier_role: verification.verifier_role }))}
      >
        Send final output to Publisher
      </Button>
    );
  };

  const renderPublisherActions = (verification: MarketingVerification) => {
    if (linkedInFlow) return null;
    if (!publisher) return null;
    if (!verification.sent_to_publisher_at) return null;
    if (verification.publisher_upload_status === "uploaded") {
      return (
        <p className="text-xs text-emerald-600">
          Posted — {verification.publisher_upload_notes || "confirmed by publisher"}
        </p>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() =>
            void run(() =>
              publisherUploadReport(item.id, {
                verifier_role: verification.verifier_role,
                uploaded: true,
                notes: postingReportNotes.trim() || "Posted successfully",
              }),
            )
          }
        >
          Yes — I posted it
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(() =>
              publisherUploadReport(item.id, {
                verifier_role: verification.verifier_role,
                uploaded: false,
                notes: postingReportNotes.trim() || "Not posted yet",
              }),
            )
          }
        >
          Not posted yet
        </Button>
      </div>
    );
  };

  const needsPostingReport = canUserReportPosting(item, perms.userId, {
    canSubmit: perms.canSubmit,
    canPublish: perms.canPublish,
    canApprove: perms.canApprove,
    canVerify: perms.canVerify,
  });

  const publisherQueue = workflow.verifications.filter((v) => v.sent_to_publisher_at);

  const renderPostingReportToHead = () => {
    if (linkedInFlow) return null;
    if (!needsPostingReport) return null;
    return (
      <div className="space-y-2 rounded-md border border-violet-500/30 bg-violet-500/5 p-3 text-xs">
        <p className="font-medium">Tell marketing head — did you post this?</p>
        <textarea
          rows={2}
          placeholder="Optional notes — e.g. posted on LinkedIn at 10am"
          className="w-full rounded-md border border-input bg-background px-2 py-1"
          value={postingReportNotes}
          onChange={(e) => setPostingReportNotes(e.target.value)}
        />
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Published URL (optional)</label>
          <Input
            value={postingReportUrl}
            onChange={(e) => setPostingReportUrl(e.target.value)}
            placeholder="https://linkedin.com/posts/…"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() =>
              void run(() =>
                reportContentPosting(item.id, {
                  posted: true,
                  notes: postingReportNotes.trim() || undefined,
                  published_url: postingReportUrl.trim() || undefined,
                }),
              )
            }
          >
            Yes — I posted it
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(() =>
                reportContentPosting(item.id, {
                  posted: false,
                  notes: postingReportNotes.trim() || undefined,
                }),
              )
            }
          >
            Not posted yet
          </Button>
        </div>
      </div>
    );
  };

  const renderLinkedInSendToPublisher = () => {
    if (handlerFinalDraftStage) return null;
    if (!canLinkedInHandlerSendToPublisher(item, perms.userId)) return null;
    return (
      <Button
        type="button"
        size="sm"
        disabled={busy}
        onClick={() => void run(() => linkedInSendToPublisher(item.id))}
      >
        Send final draft to publisher
      </Button>
    );
  };

  const renderLinkedInPublisherPublish = () => {
    if (!canMarkLinkedInAsPublished(perms, item)) return null;
    if (!workflow.can_publish) return null;
    return (
      <div className="space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
        <p className="font-medium">Mark this LinkedIn post as published when it is live.</p>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Published URL (optional)</label>
          <Input
            value={postingReportUrl}
            onChange={(e) => setPostingReportUrl(e.target.value)}
            placeholder="https://linkedin.com/posts/…"
          />
        </div>
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() =>
            void run(() =>
              publishContentItem(item.id, {
                content_item_id: item.id,
                published_url: postingReportUrl.trim() || undefined,
                notes: postingReportNotes.trim() || "Marked as published",
              }),
            )
          }
        >
          Mark as published
        </Button>
      </div>
    );
  };

  const linkedInPublishLabel = linkedInPublishStatusLabel(item);

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">Verification workflow</p>

      {linkedInFlow && linkedInPublishLabel ? (
        <div className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
          <span className="text-muted-foreground">Publish status: </span>
          <span className="font-medium">{linkedInPublishLabel}</span>
        </div>
      ) : null}

      {/* Head sees checklist-based reviews (not LinkedIn section workflow) */}
      {head && !linkedInFlow ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            {headApprovalInFooter
              ? "Review the submitted post below — approve at the bottom of this window"
              : "Review submitted content from your team"}
          </p>
          {workflow.verifications.map((v) => renderHeadReview(v))}
          {workflow.verifications.every((v) => !v.items.some((i) => i.status === "submitted")) ? (
            <p className="text-xs text-muted-foreground">
              Nothing ready for review yet. The creator may still be uploading media or completing their checklist.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Submitter: their own checklist with per-item submit buttons */}
      {myRole && (myVerification || isLinkedInVerificationRole(myRole)) ? (
        <div className="space-y-3 rounded-md border border-border bg-background p-3">
          {handlerFinalDraftStage ? (
            <MarketingLinkedInFinalDraftPanel
              item={item}
              userId={perms.userId}
              busy={busy}
              onUpdated={onUpdated}
            />
          ) : (
            <>
              <p className="text-sm font-medium">
                {isLinkedInVerificationRole(myRole)
                  ? "Your LinkedIn post — edit sections below; send to marketing head when ready"
                  : "Your verification items — submit each to marketing head separately"}
              </p>

              {isBannerContentType(item.content_type) ? (
                <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
                  <p className="text-sm font-medium">Banner / ad creative</p>
                  <MarketingBannerUploadField
                    disabled={busy}
                    previewUrl={
                      assetsForItem(BANNER_VERIFICATION_ITEM_KEY)[0]
                        ? marketingAssetUrl(assetsForItem(BANNER_VERIFICATION_ITEM_KEY)[0].asset.file_url)
                        : null
                    }
                    onFileSelected={(file) => void handleUpload(file, "image", BANNER_VERIFICATION_ITEM_KEY)}
                    hint="Upload or replace your banner image, then submit the Banner / Ad Creative item below."
                  />
                </div>
              ) : null}

              {isLinkedInVerificationRole(myRole)
                ? renderLinkedInSubmitterItems()
                : myVerification
                  ? renderSubmitterItems(myVerification)
                  : null}
              {linkedInFlow ? renderLinkedInSendToPublisher() : null}
              {!linkedInFlow && myVerification ? renderPostingTimeline(myVerification) : null}
              {!linkedInFlow && myVerification ? renderSendToPublisher(myVerification) : null}
            </>
          )}
        </div>
      ) : null}

      {/* Publisher: confirm posting per team submission */}
      {canMarkLinkedInAsPublished(perms, item) ? renderLinkedInPublisherPublish() : null}
      {publisher && !linkedInFlow && (needsPostingReport || publisherQueue.length > 0) ? (
        <div className="space-y-3">
          {renderPostingReportToHead()}
          {publisherQueue.length > 0 ? (
            <>
              <p className="text-sm font-medium">Confirm posting for each team submission</p>
              {publisherQueue.map((v) => (
                <div key={v.id} className="space-y-2 rounded border border-border/60 p-3 text-xs">
                  <p className="font-medium">
                    {VERIFIER_ROLE_LABELS[v.verifier_role] ?? v.verifier_role} — from{" "}
                    {v.requested_by_name ?? "team member"}
                  </p>
                  <textarea
                    rows={2}
                    placeholder="Optional notes for marketing head"
                    className="w-full rounded-md border border-input bg-background px-2 py-1"
                    value={postingReportNotes}
                    onChange={(e) => setPostingReportNotes(e.target.value)}
                  />
                  {renderPublisherActions(v)}
                </div>
              ))}
            </>
          ) : null}
        </div>
      ) : null}

      {/* Other roles: report posting after head approval */}
      {!publisher && !linkedInFlow && needsPostingReport ? renderPostingReportToHead() : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
