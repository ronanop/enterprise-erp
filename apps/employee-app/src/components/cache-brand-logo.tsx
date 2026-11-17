"use client";

import Image from "next/image";
import Link from "next/link";

type CacheBrandLogoProps = {
  href?: string;
  className?: string;
  /** Overall mark height in px (includes tagline) */
  height?: number;
  priority?: boolean;
};

/**
 * Official CACHE mark: red wordmark + black "Endeavouring Perfection"
 * under ACHE (same composition as brand artwork).
 */
export function CacheBrandLogo({
  href = "/home",
  className = "",
  height = 36,
  priority = false,
}: CacheBrandLogoProps) {
  // Transparent wordmark+tagline artwork ~992x394
  const width = Math.round(height * (992 / 394));

  return (
    <Link
      href={href}
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width, height }}
      aria-label="CACHE — Endeavouring Perfection"
    >
      <Image
        src="/brand/cache-logo-full.png"
        alt="CACHE — Endeavouring Perfection"
        fill
        priority={priority}
        unoptimized
        className="object-contain object-left"
        sizes={`${width}px`}
      />
    </Link>
  );
}
