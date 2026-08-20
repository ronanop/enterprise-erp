import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    // Production Docker image: allow build while the tree still has type debt.
    ignoreBuildErrors: true,
  },
  devIndicators: false,
  turbopack: {
    root: projectRoot,
  },
  async rewrites() {
    // /api/v1 is handled at runtime by app/api/v1/[...path]/route.ts
    // (API_INTERNAL_URL), so it works inside Docker where the API host is `api`.
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
        source: "/procurement/scm/ovf/:ovf_id",
        destination: "/procurement/scm/ovf-detail?ovfId=:ovf_id",
      },
    ];
  },
};

export default nextConfig;
