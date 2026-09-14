import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Load monorepo root `.env` so NEXT_PUBLIC_* stays in one place with API settings.
const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "../..");
loadEnvConfig(repoRoot);
loadEnvConfig(configDir);

// Docker Compose service name; override for local `next dev` if needed.
const apiInternalUrl = (process.env.API_INTERNAL_URL || "http://api:8000").replace(/\/+$/, "");

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
