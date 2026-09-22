import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Load monorepo root `.env` so NEXT_PUBLIC_* stays in one place with API settings.
const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "../..");
loadEnvConfig(repoRoot);
loadEnvConfig(configDir);

/** Upstream for same-origin `/api/v1` rewrites (browser → Next → API). */
function resolveApiProxyTarget(): string {
  const explicit = process.env.API_INTERNAL_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  // Local `next dev`: derive from NEXT_PUBLIC_API_URL (e.g. http://localhost:8000/api/v1).
  const publicApi = process.env.NEXT_PUBLIC_API_URL?.trim() || "";
  if (publicApi && !publicApi.startsWith("/")) {
    const origin = publicApi.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
    if (origin) return origin;
  }

  // Docker Compose sets API_INTERNAL_URL=http://api:8000; this is a last-resort local default.
  return "http://127.0.0.1:8000";
}

const apiInternalUrl = resolveApiProxyTarget();

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "@base-ui/react"],
  },
  // Same-origin /api/v1 when the UI is opened on :3000 (not only via nginx).
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiInternalUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
