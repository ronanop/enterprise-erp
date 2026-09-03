/** Shared Cache letterhead assets for PO / OVF / quote PDF exports. */

export const CACHE_LOGO_PATH = "/quote-export/cache-logo.png";
export const WOMEN_OWNED_LOGO_PATH = "/quote-export/women-owned.jpeg";

export const CACHE_LOGO_MM = { w: 47, h: 18 };
export const WOMEN_OWNED_LOGO_MM = { w: 38, h: 16 };

export async function loadPdfImageDataUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(`Failed to read ${path}`));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function loadLetterheadLogos(): Promise<{
  cache: string | null;
  womenOwned: string | null;
}> {
  const [cache, womenOwned] = await Promise.all([
    loadPdfImageDataUrl(CACHE_LOGO_PATH),
    loadPdfImageDataUrl(WOMEN_OWNED_LOGO_PATH),
  ]);
  return { cache, womenOwned };
}

export function pdfImageFormat(dataUrl: string): "PNG" | "JPEG" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  return "JPEG";
}
