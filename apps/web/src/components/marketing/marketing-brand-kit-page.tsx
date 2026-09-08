"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { formatApiError } from "@/services/api-client";
import { loadBrandKit, saveBrandKit, type BrandKitRecord } from "@/services/marketing-service";

type ColorRow = { name: string; role: string; hex: string };
type FontRow = { role: string; family: string; weight: string };
type LogoVariant = {
  name: string;
  usage: string;
  background: string;
  logo_url: string;
  logo_data_url: string;
  is_primary: boolean;
};

const LOGO_USAGES = [
  { value: "full-color", label: "Full color" },
  { value: "horizontal", label: "Horizontal" },
  { value: "stacked", label: "Stacked" },
  { value: "icon", label: "Icon / mark" },
  { value: "dark", label: "Dark" },
  { value: "reverse", label: "Reverse / light" },
  { value: "mono", label: "Mono" },
] as const;

type KitForm = {
  voice_name: string;
  description: string;
  guidelines: string;
  keywords: string;
  wordmark: string;
  usage_notes: string;
  logos: LogoVariant[];
  colors: ColorRow[];
  fonts: FontRow[];
};

const EMPTY: KitForm = {
  voice_name: "Company brand kit",
  description: "",
  guidelines: "",
  keywords: "",
  wordmark: "",
  usage_notes: "",
  logos: [
    {
      name: "Primary",
      usage: "full-color",
      background: "light",
      logo_url: "",
      logo_data_url: "",
      is_primary: true,
    },
  ],
  colors: [{ name: "Primary", role: "primary", hex: "#1e293b" }],
  fonts: [{ role: "heading", family: "IBM Plex Sans", weight: "600" }],
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

function logosFromKit(kit: NonNullable<BrandKitRecord["brand_kit"]>): LogoVariant[] {
  if (Array.isArray(kit.logos) && kit.logos.length) {
    return kit.logos.map((item, index) => ({
      name: item.name || `Variant ${index + 1}`,
      usage: item.usage || "full-color",
      background: item.background || "light",
      logo_url: item.logo_url || "",
      logo_data_url: item.logo_data_url || "",
      is_primary: Boolean(item.is_primary) || index === 0,
    }));
  }
  if (kit.logo_url || kit.logo_data_url) {
    return [
      {
        name: "Primary",
        usage: "full-color",
        background: "light",
        logo_url: kit.logo_url || "",
        logo_data_url: kit.logo_data_url || "",
        is_primary: true,
      },
    ];
  }
  return EMPTY.logos;
}

function fromRecord(row: BrandKitRecord): KitForm {
  const kit = row.brand_kit ?? {};
  const keywords = row.tone_keywords?.keywords;
  return {
    voice_name: row.voice_name || EMPTY.voice_name,
    description: row.description || "",
    guidelines: row.guidelines || "",
    keywords: Array.isArray(keywords) ? keywords.join(", ") : "",
    wordmark: String(kit.wordmark || ""),
    usage_notes: String(kit.usage_notes || ""),
    logos: logosFromKit(kit),
    colors: Array.isArray(kit.colors) && kit.colors.length ? kit.colors : EMPTY.colors,
    fonts: Array.isArray(kit.fonts) && kit.fonts.length ? kit.fonts : EMPTY.fonts,
  };
}

export function MarketingBrandKitPage() {
  const [form, setForm] = useState<KitForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setForm(fromRecord(await loadBrandKit()));
    } catch (err) {
      setError(formatApiError(err, "Could not load the brand kit"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateLogo(index: number, patch: Partial<LogoVariant>) {
    setSaved(false);
    setForm((prev) => ({
      ...prev,
      logos: prev.logos.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function markPrimary(index: number) {
    setSaved(false);
    setForm((prev) => ({
      ...prev,
      logos: prev.logos.map((item, i) => ({ ...item, is_primary: i === index })),
    }));
  }

  async function onLogoFile(index: number, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Logo must be an image.");
      return;
    }
    if (file.size > 350_000) {
      setError("Each logo variant must be under 350 KB.");
      return;
    }
    setError(null);
    const dataUrl = await readFileAsDataUrl(file);
    updateLogo(index, { logo_data_url: dataUrl });
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const row = await saveBrandKit({
        voice_name: form.voice_name.trim() || "Company brand kit",
        description: form.description.trim(),
        guidelines: form.guidelines.trim(),
        tone_keywords: {
          keywords: form.keywords
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        },
        brand_kit: {
          wordmark: form.wordmark.trim(),
          logos: form.logos,
          logo_url: (form.logos.find((item) => item.is_primary) ?? form.logos[0])?.logo_url || "",
          logo_data_url: (form.logos.find((item) => item.is_primary) ?? form.logos[0])?.logo_data_url || "",
          usage_notes: form.usage_notes.trim(),
          colors: form.colors.filter((row) => row.hex.trim()),
          fonts: form.fonts.filter((row) => row.family.trim()),
        },
      });
      setForm(fromRecord(row));
      setSaved(true);
    } catch (err) {
      setError(formatApiError(err, "Could not save the brand kit"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Brand kit"
        description="Logo, colors, fonts, and voice used when marketing content is written."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Refresh
            </Button>
            <Link
              href="/marketing"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}
            >
              Back to Marketing & Social
            </Link>
          </div>
        }
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Loading brand kit
        </p>
      ) : (
        <div className="space-y-4">
          <section className="rounded-md border border-border/70 bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Logo variants</h2>
                <p className="text-xs text-muted-foreground">
                  Keep the full-color, dark, reverse, icon, and stacked marks together. One variant is primary.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    logos: [
                      ...prev.logos,
                      {
                        name: "New variant",
                        usage: "horizontal",
                        background: "light",
                        logo_url: "",
                        logo_data_url: "",
                        is_primary: prev.logos.length === 0,
                      },
                    ],
                  }))
                }
              >
                <Plus className="size-3.5" aria-hidden />
                Add variant
              </Button>
            </div>
            <div className="mb-3 max-w-sm">
              <label className="text-xs text-muted-foreground" htmlFor="brand-wordmark">
                Wordmark
              </label>
              <Input
                id="brand-wordmark"
                value={form.wordmark}
                onChange={(e) => setForm((prev) => ({ ...prev, wordmark: e.target.value }))}
                className="mt-1"
              />
            </div>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {form.logos.map((logo, index) => {
                const src = logo.logo_data_url || logo.logo_url;
                const darkPreview = logo.background === "dark";
                return (
                  <li key={`${logo.name}-${index}`} className="rounded-md border border-border/70 p-3">
                    <div
                      className={cn(
                        "flex h-28 items-center justify-center rounded-md border border-dashed border-border",
                        darkPreview ? "bg-slate-900" : "bg-muted/30",
                      )}
                    >
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt={logo.name} className="max-h-24 max-w-full object-contain" />
                      ) : (
                        <p className={cn("px-3 text-center text-xs", darkPreview ? "text-slate-300" : "text-muted-foreground")}>
                          No file yet
                        </p>
                      )}
                    </div>
                    <div className="mt-3 grid gap-2">
                      <Input
                        value={logo.name}
                        aria-label="Variant name"
                        onChange={(e) => updateLogo(index, { name: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={logo.usage}
                          aria-label="Variant usage"
                          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                          onChange={(e) => updateLogo(index, { usage: e.target.value })}
                        >
                          {LOGO_USAGES.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={logo.background}
                          aria-label="Preview background"
                          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                          onChange={(e) => updateLogo(index, { background: e.target.value })}
                        >
                          <option value="light">Light ground</option>
                          <option value="dark">Dark ground</option>
                        </select>
                      </div>
                      <Input
                        type="file"
                        accept="image/*"
                        aria-label={`Upload ${logo.name}`}
                        className="cursor-pointer"
                        onChange={(e) => void onLogoFile(index, e.target.files?.[0])}
                      />
                      <Input
                        value={logo.logo_url}
                        aria-label="Logo URL"
                        placeholder="https://"
                        onChange={(e) => updateLogo(index, { logo_url: e.target.value, logo_data_url: "" })}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex cursor-pointer items-center gap-2 text-xs">
                          <input
                            type="radio"
                            name="primary-logo"
                            checked={logo.is_primary}
                            onChange={() => markPrimary(index)}
                          />
                          Primary
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="cursor-pointer"
                          disabled={form.logos.length === 1}
                          onClick={() =>
                            setForm((prev) => {
                              const logos = prev.logos.filter((_, i) => i !== index);
                              if (logos.length && !logos.some((item) => item.is_primary)) {
                                logos[0] = { ...logos[0], is_primary: true };
                              }
                              return { ...prev, logos };
                            })
                          }
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="space-y-4">
            <section className="rounded-md border border-border/70 bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Colors</h2>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      colors: [...prev.colors, { name: "New", role: "support", hex: "#64748b" }],
                    }))
                  }
                >
                  <Plus className="size-3.5" aria-hidden />
                  Color
                </Button>
              </div>
              <ul className="space-y-2">
                {form.colors.map((row, index) => (
                  <li key={`${row.name}-${index}`} className="grid gap-2 sm:grid-cols-[auto_1fr_120px_140px_auto]">
                    <span
                      className="size-9 rounded-md border border-border"
                      style={{ backgroundColor: row.hex }}
                      aria-hidden
                    />
                    <Input
                      value={row.name}
                      aria-label="Color name"
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          colors: prev.colors.map((item, i) => (i === index ? { ...item, name: e.target.value } : item)),
                        }))
                      }
                    />
                    <Input
                      value={row.role}
                      aria-label="Color role"
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          colors: prev.colors.map((item, i) => (i === index ? { ...item, role: e.target.value } : item)),
                        }))
                      }
                    />
                    <Input
                      value={row.hex}
                      aria-label="Hex"
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          colors: prev.colors.map((item, i) => (i === index ? { ...item, hex: e.target.value } : item)),
                        }))
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, colors: prev.colors.filter((_, i) => i !== index) }))
                      }
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-md border border-border/70 bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Fonts</h2>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      fonts: [...prev.fonts, { role: "accent", family: "", weight: "400" }],
                    }))
                  }
                >
                  <Plus className="size-3.5" aria-hidden />
                  Font
                </Button>
              </div>
              <ul className="space-y-2">
                {form.fonts.map((row, index) => (
                  <li key={`${row.role}-${index}`} className="grid gap-2 sm:grid-cols-[140px_1fr_100px_auto]">
                    <Input
                      value={row.role}
                      aria-label="Font role"
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          fonts: prev.fonts.map((item, i) => (i === index ? { ...item, role: e.target.value } : item)),
                        }))
                      }
                    />
                    <Input
                      value={row.family}
                      aria-label="Font family"
                      placeholder="Family"
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          fonts: prev.fonts.map((item, i) => (i === index ? { ...item, family: e.target.value } : item)),
                        }))
                      }
                    />
                    <Input
                      value={row.weight}
                      aria-label="Font weight"
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          fonts: prev.fonts.map((item, i) => (i === index ? { ...item, weight: e.target.value } : item)),
                        }))
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, fonts: prev.fonts.filter((_, i) => i !== index) }))
                      }
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="grid gap-3 rounded-md border border-border/70 bg-card p-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="kit-name">
                  Kit name
                </label>
                <Input
                  id="kit-name"
                  value={form.voice_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, voice_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="kit-keywords">
                  Voice keywords
                </label>
                <Input
                  id="kit-keywords"
                  value={form.keywords}
                  onChange={(e) => setForm((prev) => ({ ...prev, keywords: e.target.value }))}
                  placeholder="clear, precise"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-muted-foreground" htmlFor="kit-guidelines">
                  Voice and usage rules
                </label>
                <textarea
                  id="kit-guidelines"
                  value={form.guidelines}
                  onChange={(e) => setForm((prev) => ({ ...prev, guidelines: e.target.value }))}
                  className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-muted-foreground" htmlFor="kit-usage">
                  Logo and color rules
                </label>
                <textarea
                  id="kit-usage"
                  value={form.usage_notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, usage_notes: e.target.value }))}
                  className="min-h-16 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </section>

            <div className="flex items-center gap-3">
              <Button type="button" className="cursor-pointer" disabled={saving} onClick={() => void onSave()}>
                {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                Save brand kit
              </Button>
              {saved ? <p className="text-xs text-muted-foreground">Saved. Content Studio will use this kit.</p> : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
