import Image from "next/image";

import { cn } from "@/lib/utils";

const LOGO_SRC = "/brand/iconnect-plus-logo.png";

type AppLogoProps = {
  className?: string;
  /** Outer mark size (default 36). */
  size?: number;
  priority?: boolean;
  alt?: string;
};

/** Official iConnect Plus mark — black geometric C+ on white. */
export function AppLogo({
  className,
  size = 36,
  priority = false,
  alt = "iConnect Plus",
}: AppLogoProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={LOGO_SRC}
        alt={alt}
        width={size}
        height={size}
        priority={priority}
        className="object-contain p-[12%]"
      />
    </span>
  );
}
