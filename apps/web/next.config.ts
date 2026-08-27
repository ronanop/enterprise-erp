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
  async rewrites() {
    return [
      {
        source: "/procurement/scm/ovf/:ovf_id/po",
        destination: "/procurement/scm/create-po?ovfId=:ovf_id",
      },
      {
        source: "/procurement/scm/ovf/:ovf_id/from-stock",
        destination: "/procurement/scm/from-stock?ovfId=:ovf_id",
      },
      {
        source: "/procurement/scm/ovf/:ovf_id/item-plan",
        destination: "/procurement/scm/item-plan?ovfId=:ovf_id",
      },
      {
        source: "/procurement/scm/ovf/:ovf_id",
        destination: "/procurement/scm/ovf-detail?ovfId=:ovf_id",
      },
    ];
  },
};

export default nextConfig;
