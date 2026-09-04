import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { allowedDevOriginsForPort, lanOriginForPort } from "../../scripts/next-dev-origins";

/** App package root — stable when cwd differs from apps/web (avoids Turbopack 404 / ChunkLoadError). */
const projectRoot = path.resolve(__dirname);

const DEV_PORT = Number(process.env.PORT ?? 3000);
const lanOrigin = lanOriginForPort(DEV_PORT) ?? "";

// Load monorepo root `.env` so NEXT_PUBLIC_* stays in one place with API settings.
const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "../..");
loadEnvConfig(repoRoot);
loadEnvConfig(configDir);

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedDevOriginsForPort(DEV_PORT),
  env: {
    NEXT_PUBLIC_LAN_ORIGIN: lanOrigin,
  },
  devIndicators: false,
  logging: {
    browserToTerminal: process.env.NEXT_BROWSER_LOGS === "1",
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  output: "standalone",
  turbopack: {
    root: projectRoot,
  },
  async rewrites() {
    const target = (process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000").replace(
      /\/$/,
      "",
    );
    return [
      {
        source: "/api/v1/:path*",
        destination: `${target}/api/v1/:path*`,
      },
    ];
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "@base-ui/react"],
  },
};

export default nextConfig;
