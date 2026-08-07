import { DEV_EXTENSION_NOISE_SCRIPT } from "@/lib/dev-extension-noise";

export function DevExtensionNoiseInit() {
  if (process.env.NODE_ENV !== "development") return null;
  return (
    <script
      id="erp-dev-extension-noise-filter"
      dangerouslySetInnerHTML={{ __html: DEV_EXTENSION_NOISE_SCRIPT }}
    />
  );
}
