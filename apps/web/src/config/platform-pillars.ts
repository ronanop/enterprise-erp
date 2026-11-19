/**
 * Platform pillar helpers kept for ModuleHub compatibility in standalone HRMS.
 */

export type PlatformPillarKey = "foundation" | "organization" | "master-data";

export type PlatformPillar = {
  key: PlatformPillarKey;
  title: string;
  rule: string;
  href: string;
};

export const PLATFORM_PILLARS: readonly PlatformPillar[] = [] as const;

export function platformPillarForModuleKey(_moduleKey: string): PlatformPillarKey | null {
  return null;
}
