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
  getVerificationItemInputType,
  getVerificationTextField,
  inferSubmitterRole,
  isMarketingHead,
  isPublisherOnly,
  verificationTextFieldLabel,
  VERIFIER_ROLE_LABELS,
  type VerificationTextField,
} from "@/lib/marketing-verification";
import {
  ApiClientError,
  getContentWorkflow,
  headReviewVerificationItem,
  listContentAssets,
  marketingAssetUrl,
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

type MarketingVerificationPanelProps = {
  item: MarketingContentItem;
  onUpdated: () => void;
};

export function MarketingVerificationPanel({ item, onUpdated }: MarketingVerificationPanelProps) {
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

  const renderSubmitterItems = (verification: MarketingVerification) => (
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

  const renderHeadItemPreview = (itemKey: string) => {
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

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">Verification workflow</p>

      {/* Head sees all pending reviews with requester names */}
      {head ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">Review submitted content from your team</p>
          {workflow.verifications.map((v) => renderHeadReview(v))}
          {workflow.verifications.every((v) => !v.items.some((i) => i.status === "submitted")) ? (
            <p className="text-xs text-muted-foreground">
              Nothing ready for review yet. The creator may still be uploading media or completing their checklist.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Submitter: their own checklist with per-item submit buttons */}
      {myVerification && myRole ? (
        <div className="space-y-3 rounded-md border border-border bg-background p-3">
          <p className="text-sm font-medium">Your verification items — submit each to marketing head separately</p>

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

          {renderSubmitterItems(myVerification)}
          {renderPostingTimeline(myVerification)}
          {renderSendToPublisher(myVerification)}
        </div>
      ) : null}

      {/* Publisher: confirm posting per team submission */}
      {publisher && (needsPostingReport || publisherQueue.length > 0) ? (
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
      {!publisher && needsPostingReport ? renderPostingReportToHead() : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
