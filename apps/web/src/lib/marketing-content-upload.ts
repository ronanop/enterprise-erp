import {
  linkContentAsset,
  uploadMarketingAsset,
} from "@/services/marketing-service";

/** Upload a file and link it to a content item for a specific verification item key. */
export async function uploadContentAssetForItem(
  contentId: string,
  companyId: string,
  file: File,
  itemKey: string,
  assetKind: "image" | "video" = "image",
) {
  const reader = new FileReader();
  const base64 = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  let width: number | undefined;
  let height: number | undefined;
  if (assetKind === "image") {
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = base64;
    });
    width = dims.w;
    height = dims.h;
  }

  const uploaded = await uploadMarketingAsset({
    name: file.name,
    content_base64: base64,
    company_id: companyId,
    mime_type: file.type,
    asset_kind: assetKind,
    width_px: width,
    height_px: height,
  });

  await linkContentAsset(contentId, {
    media_asset_id: uploaded.id,
    asset_role: itemKey,
  });

  return uploaded;
}

export const BANNER_VERIFICATION_ITEM_KEY = "other_design";

export function isBannerContentType(contentType: string | null | undefined): boolean {
  return contentType === "ad_creative";
}
