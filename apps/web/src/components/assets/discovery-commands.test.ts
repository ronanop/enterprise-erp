import { describe, expect, it } from "vitest";

import {
  DISCOVERY_OS_OPTIONS,
  DISCOVERY_PARSER_KEYS,
  DISCOVERY_WINDOWS_SHELL_OPTIONS,
  formatDiscoveryCommandsForClipboard,
  getDiscoveryCommandPack,
} from "@/components/assets/discovery-commands";

describe("discovery-commands", () => {
  it("exposes Windows, Linux, and macOS", () => {
    expect(DISCOVERY_OS_OPTIONS.map((o) => o.label)).toEqual(["Windows", "Linux", "macOS"]);
  });

  it("exposes PowerShell and CMD shell options", () => {
    expect(DISCOVERY_WINDOWS_SHELL_OPTIONS.map((o) => o.id)).toEqual(["powershell", "cmd"]);
  });

  it("returns distinct basic scripts per OS", () => {
    const win = getDiscoveryCommandPack("windows", "powershell");
    const linux = getDiscoveryCommandPack("linux");
    const mac = getDiscoveryCommandPack("macos");
    expect(win.basicSystemInformation).toContain("Get-CimInstance");
    expect(win.basicSystemInformation).not.toContain("hostnamectl");
    expect(linux.basicSystemInformation).toContain("hostname");
    expect(linux.basicSystemInformation).toContain("/etc/os-release");
    expect(linux.basicSystemInformation).not.toContain("Get-CimInstance");
    expect(mac.basicSystemInformation).toContain("sw_vers");
    expect(mac.basicSystemInformation).toContain("system_profiler");
    expect(mac.basicSystemInformation).not.toContain("Get-CimInstance");
  });

  it("Windows PowerShell pack is PowerShell-only (not a CMD wrapper)", () => {
    const pack = getDiscoveryCommandPack("windows", "powershell");
    expect(pack.shellLabel).toContain("PowerShell");
    expect(pack.basicSystemInformation).toContain("Get-CimInstance");
    expect(pack.basicSystemInformation).not.toMatch(/^powershell /i);
    expect(pack.referenceCommands.some((c) => c.command.includes("Get-NetAdapter"))).toBe(true);
  });

  it("Windows CMD pack is pasteable into Command Prompt", () => {
    const pack = getDiscoveryCommandPack("windows", "cmd");
    expect(pack.shellLabel).toContain("CMD");
    expect(pack.basicSystemInformation.startsWith("powershell -NoProfile")).toBe(true);
    expect(pack.basicSystemInformation).toContain("Get-CimInstance");
    // Must not ship raw Get-Net* as top-level CMD tokens
    expect(pack.basicSystemInformation).not.toMatch(/(^|\n)Get-Net/);
    expect(pack.basicSystemInformation).not.toContain("# Network");
    expect(pack.basicSystemInformation).not.toContain("# MAC");
    // Native CMD reference commands
    expect(pack.referenceCommands.map((c) => c.command)).toEqual(
      expect.arrayContaining(["hostname", "systeminfo", "ipconfig /all", "getmac /v"]),
    );
    expect(pack.referenceCommands.every((c) => !c.command.startsWith("Get-"))).toBe(true);
  });

  it("includes KEY=VALUE fields the parser expects", () => {
    for (const id of ["windows", "linux", "macos"] as const) {
      const packs =
        id === "windows"
          ? [getDiscoveryCommandPack("windows", "powershell"), getDiscoveryCommandPack("windows", "cmd")]
          : [getDiscoveryCommandPack(id)];
      for (const pack of packs) {
        for (const key of DISCOVERY_PARSER_KEYS) {
          expect(pack.basicSystemInformation).toContain(key);
        }
      }
    }
  });

  it("clipboard text is executable only — no hash comments", () => {
    const ps = formatDiscoveryCommandsForClipboard(getDiscoveryCommandPack("windows", "powershell"));
    const cmd = formatDiscoveryCommandsForClipboard(getDiscoveryCommandPack("windows", "cmd"));
    const linux = formatDiscoveryCommandsForClipboard(getDiscoveryCommandPack("linux"));
    for (const text of [ps, cmd, linux]) {
      expect(text).not.toMatch(/^#/m);
      expect(text).not.toContain("# Network");
      expect(text.trim().length).toBeGreaterThan(20);
    }
    expect(cmd.trim().startsWith("powershell -NoProfile")).toBe(true);
  });

  it("does not include destructive or credential commands", () => {
    const packs = [
      getDiscoveryCommandPack("windows", "powershell"),
      getDiscoveryCommandPack("windows", "cmd"),
      getDiscoveryCommandPack("linux"),
      getDiscoveryCommandPack("macos"),
    ];
    for (const pack of packs) {
      const blob = formatDiscoveryCommandsForClipboard(pack).toLowerCase();
      expect(blob).not.toContain("invoke-expression");
      expect(blob).not.toContain("iex ");
      expect(blob).not.toContain("rm -rf");
      expect(blob).not.toContain("format-volume");
      expect(blob).not.toContain("password");
      expect(blob).not.toContain("credential");
      expect(blob).not.toContain("wget http");
      expect(blob).not.toContain("curl http");
    }
  });
});
