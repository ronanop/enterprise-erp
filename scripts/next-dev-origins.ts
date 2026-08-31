import os from "node:os";

const SKIP_IFACE = /vethernet|virtualbox|vmware|hyper-v|wsl|docker|loopback|bluetooth|pseudo|isatap|teredo/i;
const PREFER_IFACE = /wi-?fi|wlan|ethernet|local area|lan|en0|eth0/i;

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

function lanAddresses(): { name: string; address: string }[] {
  const found: { name: string; address: string }[] = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    if (!entries || SKIP_IFACE.test(name)) continue;
    for (const entry of entries) {
      const isIpv4 = entry.family === "IPv4" || entry.family === 4;
      if (!isIpv4 || entry.internal) continue;
      if (entry.address.startsWith("169.254.")) continue;
      found.push({ name, address: entry.address });
    }
  }
  return found;
}

/** Best local IPv4 for sharing a URL with phones / other PCs on the LAN. */
export function primaryLanIPv4(): string | null {
  const override = process.env.NEXT_PUBLIC_LAN_HOST?.trim() || process.env.DEV_LAN_HOST?.trim();
  if (override) return override.replace(/^https?:\/\//, "").split(":")[0] ?? override;

  const candidates = lanAddresses();
  const preferred = candidates.find((c) => PREFER_IFACE.test(c.name));
  if (preferred) return preferred.address;

  const privateOrder = [
    (ip: string) => ip.startsWith("192.168."),
    (ip: string) => ip.startsWith("10."),
    (ip: string) => /^172\.(1[6-9]|2\d|3[01])\./.test(ip),
  ];
  for (const match of privateOrder) {
    const hit = candidates.find((c) => match(c.address));
    if (hit) return hit.address;
  }

  return candidates[0]?.address ?? null;
}

export function lanOriginForPort(port: number): string | null {
  const explicit = process.env.NEXT_PUBLIC_PORTAL_ORIGIN?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const ip = primaryLanIPv4();
  if (!ip) return null;
  return `http://${ip}:${port}`;
}

/** Origins for Next.js `allowedDevOrigins` (LAN HMR). Auto-detects local IPv4 when env unset. */
export function allowedDevOriginsForPort(port: number): string[] {
  const fromEnv = parseEnvOrigins();
  if (fromEnv?.length) return fromEnv;

  const origins = new Set<string>();
  for (const { address } of lanAddresses()) {
    origins.add(address);
    origins.add(`${address}:${port}`);
  }

  return [...origins];
}
