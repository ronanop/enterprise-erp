"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleDollarSign,
  Download,
  Expand,
  ExternalLink,
  ImageIcon,
  Loader2,
  MessageSquare,
  RefreshCw,
  Wand2,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAccessToken } from "@/lib/auth";
import { formatApiError } from "@/services/api-client";
import {
  CREATIVE_CATEGORIES,
  getCategory,
  getFormat,
  openaiSizeLabel,
  pixelsLabel,
  type CreativeCategoryId,
} from "@/config/marketing-creative-formats";
import {
  loadImagePostProviders,
  loadImagePostUsage,
  listImagePosts,
  generateImagePost,
  repurposeImagePost,
  getCanvaAuthorizeUrl,
  exchangeCanvaCode,
  editImagePostInCanva,
  imagePostFilePath,
  openImagePostInMarketingChat,
  type ImagePostProviders,
  type ImageSpendSummary,
  type MarketingGeneratedContent,
} from "@/services/marketing-service";
import { loadChatSettings } from "@/components/marketing/marketing-chat-settings";

/** Fallback if usage API has not returned Frankfurter FX yet. */
const FALLBACK_USD_TO_INR = 95;

function formatUsd(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatInrFromUsd(
  value: number | null | undefined,
  usdToInr: number = FALLBACK_USD_TO_INR,
): string {
  const usd = Number(value ?? 0);
  const rate = Number.isFinite(usdToInr) && usdToInr > 0 ? usdToInr : FALLBACK_USD_TO_INR;
  const n = Number.isFinite(usd) ? usd * rate : 0;
  if (!Number.isFinite(n) || n <= 0) return "₹0.00";
  if (n < 1) return `₹${n.toFixed(2)}`;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatUsdAndInr(
  value: number | null | undefined,
  usdToInr: number = FALLBACK_USD_TO_INR,
): string {
  return `${formatUsd(value)} · ${formatInrFromUsd(value, usdToInr)}`;
}

/** Dedupe Canva OAuth exchange across React Strict Mode double-mounts. */
const canvaExchangeInFlight = new Map<
  string,
  Promise<{ connected: boolean; return_to: string }>
>();

function exchangeCanvaCodeOnce(code: string, state: string) {
  const existing = canvaExchangeInFlight.get(state);
  if (existing) return existing;
  const promise = exchangeCanvaCode({ code, state }).catch((err) => {
    canvaExchangeInFlight.delete(state);
    throw err;
  });
  canvaExchangeInFlight.set(state, promise);
  return promise;
}

function clearCanvaOAuthParams() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("code") && !params.has("state")) return;
  params.delete("code");
  params.delete("state");
  const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
  window.history.replaceState({}, "", next);
}

async function fetchImagePostBlob(contentId: string): Promise<Blob> {
  const token = getAccessToken();
  const res = await fetch(imagePostFilePath(contentId), {
    method: "GET",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!res.ok) {
    const detail =
      res.status === 404
        ? "File missing on server"
        : res.status === 401 || res.status === 403
          ? "Sign in again to load image"
          : `HTTP ${res.status}`;
    throw new Error(detail);
  }
  const blob = await res.blob();
  if (blob.type && !blob.type.startsWith("image/") && blob.type !== "application/octet-stream") {
    throw new Error("Unexpected response type");
  }
  return blob;
}

function imageDownloadName(post: MarketingGeneratedContent): string {
  const format = post.pipeline_result?.creative?.format_label
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const base = format || (post.pipeline_result?.variant === "repurpose" ? "repurpose" : "creative");
  return `marketing-${base}-${post.id.slice(0, 8)}.png`;
}

function AuthImagePreview({
  contentId,
  alt,
  refreshKey = 0,
  onOpen,
}: {
  contentId: string;
  alt: string;
  refreshKey?: number;
  onOpen?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [failReason, setFailReason] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    setFailReason(null);
    (async () => {
      try {
        const blob = await fetchImagePostBlob(contentId);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setFailed(false);
      } catch (err) {
        if (!cancelled) {
          setFailed(true);
          setFailReason(err instanceof Error ? err.message : "Preview unavailable");
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [contentId, refreshKey]);

  if (failed) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-1 bg-muted/40 px-3 text-center text-xs text-muted-foreground">
        <span>Preview unavailable</span>
        {failReason ? <span className="text-[10px] opacity-80">{failReason}</span> : null}
      </div>
    );
  }
  if (!src) {
    return (
      <div className="flex size-full items-center justify-center bg-muted/40">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <button
      type="button"
      className="group relative size-full cursor-pointer border-0 bg-transparent p-0 text-left transition-opacity duration-200 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onOpen?.()}
      aria-label={`Open ${alt}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- blob preview from authenticated fetch */}
      <img src={src} alt={alt} className="size-full object-cover" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-foreground/55 py-1.5 text-[11px] font-medium text-background opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <Expand className="size-3.5" aria-hidden />
        Open
      </span>
    </button>
  );
}

/** Approx OpenAI gpt-image-2.5 output cost @ 1024² (token rates). */
const QUALITIES = [
  { value: "low", label: "Low · ~₹0.5 (draft)" },
  { value: "medium", label: "Medium · ~₹1.1" },
  { value: "high", label: "High · ~₹4.5" },
  { value: "xhigh", label: "XHigh · ~₹8" },
  { value: "max", label: "Max · ~₹18" },
  { value: "auto", label: "Auto · ~medium" },
] as const;

const DEFAULT_CATEGORY = CREATIVE_CATEGORIES[0].id;
const DEFAULT_FORMAT = CREATIVE_CATEGORIES[0].formats[0].id;

export function MarketingContentStudio() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [creativeCategory, setCreativeCategory] =
    useState<CreativeCategoryId>(DEFAULT_CATEGORY);
  const [creativeFormatId, setCreativeFormatId] = useState(DEFAULT_FORMAT);
  const [imageQuality, setImageQuality] = useState<string>(
    CREATIVE_CATEGORIES[0].formats[0].suggestedQuality,
  );
  const [imageBusy, setImageBusy] = useState(false);
  const [chatBusyId, setChatBusyId] = useState<string | null>(null);

  const selectedCategory = getCategory(creativeCategory);
  const selectedFormat = getFormat(creativeCategory, creativeFormatId);
  const imageSize = selectedFormat.openaiSize;
  const imagePlatform = selectedFormat.platformTag;
  const [canvaBusyId, setCanvaBusyId] = useState<string | null>(null);
  const [imagePosts, setImagePosts] = useState<MarketingGeneratedContent[]>([]);
  const [providers, setProviders] = useState<ImagePostProviders | null>(null);
  const [spend, setSpend] = useState<ImageSpendSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewRefresh, setPreviewRefresh] = useState(0);
  const [repurposeOpenId, setRepurposeOpenId] = useState<string | null>(null);
  const [repurposePrompt, setRepurposePrompt] = useState("");
  const [repurposeBusyId, setRepurposeBusyId] = useState<string | null>(null);
  const [fileBusyId, setFileBusyId] = useState<string | null>(null);

  const reload = useCallback(async (opts?: { refreshFx?: boolean }) => {
    try {
      const [images, status, usage] = await Promise.all([
        listImagePosts(),
        loadImagePostProviders(),
        // Fresh Frankfurter USD→INR once when opening this module.
        loadImagePostUsage({ refreshFx: opts?.refreshFx ?? false }),
      ]);
      setImagePosts(images);
      setProviders(status);
      setSpend(usage);
    } catch (err) {
      setError(formatApiError(err, "Failed to load content"));
    }
  }, []);

  // Module visit: load studio data + force one FX refresh for today's rate.
  useEffect(() => {
    void reload({ refreshFx: true });
  }, [reload]);

  // Canva OAuth return: /marketing/content?code=...&state=...
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return;

    // Survives Strict Mode remount; blocks a second network exchange for same state.
    const doneKey = `canva_oauth_done:${state}`;
    if (sessionStorage.getItem(doneKey) === "1") {
      clearCanvaOAuthParams();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setNotice("Connecting Canva…");
        await exchangeCanvaCodeOnce(code, state);
        sessionStorage.setItem(doneKey, "1");
        clearCanvaOAuthParams();
        if (cancelled) return;
        setNotice("Canva connected. You can use Edit in Canva on any image post.");
        setError(null);
        await reload();
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err, "Canva connect failed"));
          setNotice(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reload]);

  function onCategoryChange(next: CreativeCategoryId) {
    const cat = getCategory(next);
    const first = cat.formats[0];
    setCreativeCategory(next);
    setCreativeFormatId(first.id);
    setImageQuality(first.suggestedQuality);
  }

  function onFormatChange(formatId: string) {
    const format = getFormat(creativeCategory, formatId);
    setCreativeFormatId(format.id);
    setImageQuality(format.suggestedQuality);
  }

  async function onGenerateImage() {
    if (!imagePrompt.trim()) return;
    setImageBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await generateImagePost({
        prompt: imagePrompt.trim(),
        size: imageSize,
        quality: imageQuality,
        platform: imagePlatform,
        creative: {
          category_id: selectedCategory.id,
          category_label: selectedCategory.label,
          format_id: selectedFormat.id,
          format_label: selectedFormat.label,
          width_px: selectedFormat.widthPx,
          height_px: selectedFormat.heightPx,
          inches: selectedFormat.inches,
          cms: selectedFormat.cms,
        },
      });
      setImagePrompt("");
      // Show immediately in history even if a later list refresh races.
      setImagePosts((prev) => [created, ...prev.filter((row) => row.id !== created.id)]);
      setNotice(
        `${selectedFormat.label} saved (${pixelsLabel(selectedFormat)}). Preview below — Edit in Canva to refine.`,
      );
      await reload();
    } catch (err) {
      setError(formatApiError(err, "Image generation failed"));
    } finally {
      setImageBusy(false);
    }
  }

  async function onOpenImage(post: MarketingGeneratedContent) {
    setFileBusyId(post.id);
    setError(null);
    try {
      const blob = await fetchImagePostBlob(post.id);
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) {
        // Popup blocked — still allow viewing via temporary navigation fallback.
        setNotice("Popup blocked — use Download, or allow popups for this site.");
        URL.revokeObjectURL(url);
        return;
      }
      // Revoke after the new tab has a chance to load the blob.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(formatApiError(err, "Could not open image"));
    } finally {
      setFileBusyId(null);
    }
  }

  async function onDownloadImage(post: MarketingGeneratedContent) {
    setFileBusyId(post.id);
    setError(null);
    try {
      const blob = await fetchImagePostBlob(post.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = imageDownloadName(post);
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setNotice(`Downloaded ${imageDownloadName(post)}`);
    } catch (err) {
      setError(formatApiError(err, "Could not download image"));
    } finally {
      setFileBusyId(null);
    }
  }

  function toggleRepurpose(postId: string) {
    setError(null);
    setNotice(null);
    if (repurposeOpenId === postId) {
      setRepurposeOpenId(null);
      setRepurposePrompt("");
      return;
    }
    setRepurposeOpenId(postId);
    setRepurposePrompt("");
  }

  async function onOpenInChat(post: MarketingGeneratedContent) {
    setChatBusyId(post.id);
    setError(null);
    try {
      const result = await openImagePostInMarketingChat(post.id, loadChatSettings());
      try {
        window.sessionStorage.setItem(
          "erp.marketing.chat.import.v1",
          JSON.stringify(result),
        );
      } catch {
        // ignore quota
      }
      router.push(`/marketing/chat?session=${encodeURIComponent(result.session.id)}`);
    } catch (err) {
      setError(formatApiError(err, "Could not open image in Chat"));
    } finally {
      setChatBusyId(null);
    }
  }

  async function onRepurpose(post: MarketingGeneratedContent) {
    if (!repurposePrompt.trim()) return;
    setRepurposeBusyId(post.id);
    setError(null);
    setNotice(null);
    try {
      const created = await repurposeImagePost(post.id, {
        prompt: repurposePrompt.trim(),
        size: post.pipeline_result?.size || undefined,
        quality: imageQuality,
      });
      setImagePosts((prev) => [created, ...prev.filter((row) => row.id !== created.id)]);
      setRepurposeOpenId(null);
      setRepurposePrompt("");
      setPreviewRefresh((n) => n + 1);
      setNotice("New version saved. Original kept in history.");
      await reload();
      setPreviewRefresh((n) => n + 1);
    } catch (err) {
      setError(formatApiError(err, "Repurpose failed"));
    } finally {
      setRepurposeBusyId(null);
    }
  }

  async function onConnectCanva() {
    setError(null);
    try {
      const { authorize_url } = await getCanvaAuthorizeUrl("/marketing/content");
      window.location.href = authorize_url;
    } catch (err) {
      setError(formatApiError(err, "Could not start Canva connect"));
    }
  }

  async function onEditInCanva(contentId: string) {
    setCanvaBusyId(contentId);
    setError(null);
    setNotice(null);
    try {
      if (providers && !providers.canva_connected) {
        await onConnectCanva();
        return;
      }
      const result = await editImagePostInCanva(contentId);
      await reload();
      if (result.fallback_reason) {
        setNotice(
          `Opened as a flat Canva design (Magic Layers unavailable: ${result.fallback_reason}).`,
        );
      } else if (result.mode === "magic_layers") {
        setNotice("Opened in Canva with editable Magic Layers.");
      }
      window.open(result.canva_edit_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message = formatApiError(err, "Edit in Canva failed");
      // Dead/revoked Canva OAuth — clear UX path is reconnect immediately.
      if (/not connected|Connect Canva|session expired|revoked|invalid.?token/i.test(message)) {
        setNotice("Canva login expired — reconnecting…");
        await onConnectCanva();
        return;
      }
      setError(message);
    } finally {
      setCanvaBusyId(null);
    }
  }

  const usdInr =
    typeof spend?.fx?.usd_inr === "number" && spend.fx.usd_inr > 0
      ? spend.fx.usd_inr
      : FALLBACK_USD_TO_INR;
  const fxLabel =
    spend?.fx?.source === "frankfurter" && spend.fx.as_of
      ? `Frankfurter · ${spend.fx.as_of}`
      : spend?.fx?.source === "fallback"
        ? "fallback rate"
        : "Frankfurter";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Content Studio"
        description="Available to every Marketing member. Your generations stay private — other teammates cannot see your images or spend. Pick a format, generate, then refine in Canva."
      />

      <nav
        aria-label="OpenAI image spend"
        className="flex flex-wrap items-stretch gap-2 rounded-md border border-border/70 bg-card px-3 py-2"
      >
        <div className="flex min-w-[8.5rem] flex-col justify-center gap-0.5 pr-2 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CircleDollarSign className="size-3.5 text-primary" aria-hidden />
            Image spend
          </span>
          <span className="pl-5 font-mono text-sm font-semibold tabular-nums text-foreground">
            ₹{usdInr.toFixed(2)} / $1
          </span>
          <span className="pl-5 text-[10px] font-normal text-muted-foreground/80">
            Today · {fxLabel}
          </span>
        </div>
        <div className="flex min-w-[8.5rem] flex-1 flex-col justify-center rounded border border-border/60 bg-muted/30 px-2.5 py-1.5 transition-colors duration-200 hover:bg-muted/50">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Today</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {formatUsd(spend?.today.usd)}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatInrFromUsd(spend?.today.usd, usdInr)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {spend?.today.image_count ?? 0} img · {(spend?.today.tokens ?? 0).toLocaleString()} tok
          </span>
        </div>
        <div className="flex min-w-[8.5rem] flex-1 flex-col justify-center rounded border border-border/60 bg-muted/30 px-2.5 py-1.5 transition-colors duration-200 hover:bg-muted/50">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">7 days</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {formatUsd(spend?.last_7_days.usd)}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatInrFromUsd(spend?.last_7_days.usd, usdInr)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {spend?.last_7_days.image_count ?? 0} img ·{" "}
            {(spend?.last_7_days.tokens ?? 0).toLocaleString()} tok
          </span>
        </div>
        <div className="flex min-w-[9.5rem] flex-1 flex-col justify-center rounded border border-border/60 bg-accent/40 px-2.5 py-1.5 transition-colors duration-200 hover:bg-accent/60">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Last image
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {formatUsd(spend?.last_image.usd)}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatInrFromUsd(spend?.last_image.usd, usdInr)}
          </span>
          <span className="truncate text-[10px] text-muted-foreground">
            {(spend?.last_image.tokens ?? 0).toLocaleString()} tok
            {spend?.last_image.source ? ` · ${spend.last_image.source}` : ""}
            {spend?.last_image.size ? ` · ${spend.last_image.size}` : ""}
          </span>
        </div>
      </nav>

      {/* Image posts — ChatGPT-like generate + Edit in Canva */}
      <section
        aria-labelledby="mkt-image-posts-heading"
        className="space-y-3 rounded-md border border-border/70 bg-card p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2
              id="mkt-image-posts-heading"
              className="flex items-center gap-2 text-sm font-semibold tracking-tight"
            >
              <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
              Creative generator
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose event/use-case format → prompt → OpenAI (nearest aspect) → Edit in Canva.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={providers?.openai_configured ? "secondary" : "outline"} className="text-[10px]">
              OpenAI {providers?.openai_configured ? "ready" : "not configured"}
            </Badge>
            <Badge variant={providers?.canva_configured ? "secondary" : "outline"} className="text-[10px]">
              Canva app {providers?.canva_configured ? "ready" : "not configured"}
            </Badge>
            <Badge variant={providers?.canva_connected ? "secondary" : "outline"} className="text-[10px]">
              {providers?.canva_connected ? "Canva connected" : "Canva not connected"}
            </Badge>
            {providers?.canva_configured ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => void onConnectCanva()}
              >
                {providers.canva_connected ? "Reconnect Canva" : "Connect Canva"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-12 lg:items-end">
          <div className="space-y-1.5 lg:col-span-3">
            <label htmlFor="mkt-creative-category" className="text-xs font-medium text-muted-foreground">
              Use case
            </label>
            <select
              id="mkt-creative-category"
              value={creativeCategory}
              onChange={(e) => onCategoryChange(e.target.value as CreativeCategoryId)}
              className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CREATIVE_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 lg:col-span-4">
            <label htmlFor="mkt-creative-format" className="text-xs font-medium text-muted-foreground">
              Creative type
            </label>
            <select
              id="mkt-creative-format"
              value={selectedFormat.id}
              onChange={(e) => onFormatChange(e.target.value)}
              className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {selectedCategory.formats.map((format) => (
                <option key={format.id} value={format.id}>
                  {format.label} · {format.widthPx}×{format.heightPx}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 lg:col-span-3">
            <label htmlFor="mkt-image-quality" className="text-xs font-medium text-muted-foreground">
              Quality (cost)
            </label>
            <select
              id="mkt-image-quality"
              value={imageQuality}
              onChange={(e) => setImageQuality(e.target.value)}
              className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {QUALITIES.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <Button
              type="button"
              disabled={imageBusy || !imagePrompt.trim() || providers?.openai_configured === false}
              onClick={() => void onGenerateImage()}
              className="h-9 w-full cursor-pointer transition-colors duration-200"
            >
              {imageBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Wand2 className="size-3.5" />
              )}
              Generate
            </Button>
          </div>
        </div>

        <div
          className="grid gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4"
          aria-live="polite"
        >
          <div>
            <span className="block text-[10px] uppercase tracking-wide">Target pixels</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {pixelsLabel(selectedFormat)}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wide">Inches</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {selectedFormat.inches}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wide">Centimetres</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {selectedFormat.cms}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wide">AI generate size</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {openaiSizeLabel(selectedFormat.openaiSize)}
            </span>
            <span className="mt-0.5 block text-[10px]">
              Nearest OpenAI aspect · channel{" "}
              <span className="font-medium text-foreground">{selectedFormat.platformTag}</span>
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="mkt-image-prompt" className="text-xs font-medium text-muted-foreground">
            Image prompt
          </label>
          <Input
            id="mkt-image-prompt"
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            placeholder={`e.g. Brand creative for ${selectedFormat.label} — slate/gold, clear logo space, bold headline`}
            className="transition-colors duration-200"
          />
          <p className="text-[11px] text-muted-foreground">{selectedCategory.description}</p>
        </div>

        {providers && !providers.openai_configured ? (
          <p className="text-xs text-muted-foreground">
            Set <code className="rounded bg-muted px-1">OPENAI_API_KEY</code> on the API to enable
            generation.
          </p>
        ) : null}
        {providers && !providers.canva_configured ? (
          <p className="text-xs text-muted-foreground">
            Set <code className="rounded bg-muted px-1">CANVA_CLIENT_ID</code> /{" "}
            <code className="rounded bg-muted px-1">CANVA_CLIENT_SECRET</code> and redirect URI to
            enable Edit in Canva.
          </p>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Image history
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {imagePosts.length} saved
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {imagePosts.length === 0 ? (
              <p className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
                No image posts yet. Generate one from a prompt above — each save stays here.
              </p>
            ) : (
              imagePosts.map((post) => {
                const canvaUrl = post.pipeline_result?.canva?.canva_edit_url;
                const mode = post.pipeline_result?.canva?.mode;
                const costUsd = post.pipeline_result?.cost?.usd;
                const isRepurpose = post.pipeline_result?.variant === "repurpose";
                const repurposeOpen = repurposeOpenId === post.id;
                const repurposeBusy = repurposeBusyId === post.id;
                return (
                  <article
                    key={post.id}
                    className="flex flex-col overflow-hidden rounded-md border border-border/70 bg-background transition-colors duration-200"
                  >
                    <div className="relative aspect-square bg-muted/40">
                      <AuthImagePreview
                        contentId={post.id}
                        alt={post.headline || "Generated marketing image"}
                        refreshKey={previewRefresh}
                        onOpen={() => void onOpenImage(post)}
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] uppercase">
                          image
                        </Badge>
                        {isRepurpose ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Repurpose
                          </Badge>
                        ) : null}
                        {post.pipeline_result?.creative?.format_label ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {post.pipeline_result.creative.format_label}
                          </Badge>
                        ) : null}
                        {post.pipeline_result?.creative?.width_px &&
                        post.pipeline_result?.creative?.height_px ? (
                          <Badge variant="outline" className="font-mono text-[10px] tabular-nums">
                            {post.pipeline_result.creative.width_px}×
                            {post.pipeline_result.creative.height_px}
                          </Badge>
                        ) : post.pipeline_result?.size ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {post.pipeline_result.size}
                          </Badge>
                        ) : null}
                        {typeof costUsd === "number" ? (
                          <Badge variant="secondary" className="font-mono text-[10px] tabular-nums">
                            {formatUsdAndInr(costUsd, usdInr)}
                          </Badge>
                        ) : null}
                        {post.pipeline_result?.platform ? (
                          <Badge variant="outline" className="text-[10px]">
                            {post.pipeline_result.platform}
                          </Badge>
                        ) : null}
                        {mode ? (
                          <Badge variant="outline" className="text-[10px]">
                            {mode === "magic_layers" ? "Magic Layers" : "Flat design"}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {post.pipeline_result?.prompt || post.body}
                      </p>
                      <div className="mt-auto flex flex-wrap gap-2 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="cursor-pointer transition-colors duration-200"
                          disabled={fileBusyId === post.id}
                          onClick={() => void onOpenImage(post)}
                        >
                          {fileBusyId === post.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Expand className="size-3.5" />
                          )}
                          Open
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="cursor-pointer transition-colors duration-200"
                          disabled={fileBusyId === post.id}
                          onClick={() => void onDownloadImage(post)}
                        >
                          {fileBusyId === post.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Download className="size-3.5" />
                          )}
                          Download
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="cursor-pointer transition-colors duration-200"
                          disabled={!!canvaBusyId || providers?.canva_configured === false}
                          onClick={() => void onEditInCanva(post.id)}
                        >
                          {canvaBusyId === post.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <ExternalLink className="size-3.5" />
                          )}
                          Edit in Canva
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="cursor-pointer transition-colors duration-200"
                          disabled={!!chatBusyId || providers?.openai_configured === false}
                          onClick={() => void onOpenInChat(post)}
                          title="Open this image in Marketing Chat (ChatGPT)"
                        >
                          {chatBusyId === post.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <MessageSquare className="size-3.5" />
                          )}
                          Open in Chat
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={repurposeOpen ? "secondary" : "outline"}
                          className="cursor-pointer transition-colors duration-200"
                          disabled={
                            !!repurposeBusyId || providers?.openai_configured === false
                          }
                          onClick={() => toggleRepurpose(post.id)}
                        >
                          <RefreshCw className="size-3.5" />
                          Repurpose
                        </Button>
                        {canvaUrl ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="cursor-pointer transition-colors duration-200"
                            onClick={() => window.open(canvaUrl, "_blank", "noopener,noreferrer")}
                          >
                            Open last design
                          </Button>
                        ) : null}
                      </div>
                      {repurposeOpen ? (
                        <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
                          <label
                            htmlFor={`mkt-repurpose-${post.id}`}
                            className="text-[11px] font-medium text-muted-foreground"
                          >
                            Customize prompt — keeps this image and adds a new version
                          </label>
                          <textarea
                            id={`mkt-repurpose-${post.id}`}
                            value={repurposePrompt}
                            onChange={(e) => setRepurposePrompt(e.target.value)}
                            rows={3}
                            placeholder="e.g. Same layout, switch to Diwali festive colors, add Hindi headline space"
                            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="cursor-pointer transition-colors duration-200"
                              disabled={
                                repurposeBusy ||
                                repurposePrompt.trim().length < 8 ||
                                providers?.openai_configured === false
                              }
                              onClick={() => void onRepurpose(post)}
                            >
                              {repurposeBusy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Wand2 className="size-3.5" />
                              )}
                              Generate new version
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="cursor-pointer transition-colors duration-200"
                              disabled={repurposeBusy}
                              onClick={() => toggleRepurpose(post.id)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>

      {notice ? (
        <p className="text-sm text-foreground" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
