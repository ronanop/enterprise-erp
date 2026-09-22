import { CACHE_LOGO_PATH as LETTERHEAD_CACHE_LOGO_PATH } from "@/utils/pdf-letterhead";

/** Public CACHE logo used on PO / GRN PDFs. */
export const CACHE_LOGO_PATH = LETTERHEAD_CACHE_LOGO_PATH;

export type CacheLogoImage = {
  dataUrl: string;
  width: number;
  height: number;
};

export async function loadCacheLogo(path = CACHE_LOGO_PATH): Promise<CacheLogoImage | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read logo"));
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Failed to decode logo"));
      img.src = dataUrl;
    });
    if (dims.width <= 0 || dims.height <= 0) return null;
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}
