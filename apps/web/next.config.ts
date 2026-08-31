import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Load monorepo root `.env` so NEXT_PUBLIC_* stays in one place with API settings.
const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "../..");
loadEnvConfig(repoRoot);
loadEnvConfig(configDir);

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
};

export default nextConfig;
