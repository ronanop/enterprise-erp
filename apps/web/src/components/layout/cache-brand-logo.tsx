import { cn } from "@/lib/utils";

export const CACHE_BRAND_LOGO_SRC = "/brand/cache-wordmark.png?v=4";

type CacheBrandLogoProps = {
  className?: string;
  alt?: string;
};

/** CACHE ion wordmark — red mark on black. Use on dark surfaces or as a compact badge. */
export function CacheBrandLogo({ className, alt = "CACHE ion" }: CacheBrandLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={CACHE_BRAND_LOGO_SRC}
      alt={alt}
      className={cn("block h-9 w-auto object-contain object-left", className)}
    />
  );
}
