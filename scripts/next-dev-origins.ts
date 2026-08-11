import os from "node:os";

function parseEnvOrigins(): string[] | null {
  const raw = process.env.ALLOWED_DEV_ORIGINS?.trim();
  if (!raw) return null;

  return raw
    .split(",")
    .map((entry) => {
      const trimmed = entry.trim();
      if (!trimmed) return "";
      if (trimmed.includes("://")) return new URL(trimmed).host;
      return trimmed;
    })
    .filter(Boolean);
}

/** Origins for Next.js `allowedDevOrigins` (LAN HMR). Auto-detects local IPv4 when env unset. */
export function allowedDevOriginsForPort(port: number): string[] {
  const fromEnv = parseEnvOrigins();
  if (fromEnv?.length) return fromEnv;

  const origins = new Set<string>();
  for (const entries of Object.values(os.networkInterfaces())) {
    if (!entries) continue;
    for (const entry of entries) {
      const isIpv4 = entry.family === "IPv4" || entry.family === 4;
      if (isIpv4 && !entry.internal) {
        origins.add(entry.address);
        origins.add(`${entry.address}:${port}`);
      }
    }
  }

  return [...origins];
}
