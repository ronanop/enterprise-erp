"""Hardware inventory parser (CR-003) — pure domain, no DB access."""

from __future__ import annotations

import re
from typing import Any

PARSER_VERSION = "1.0.0"
SUPPORTED_PLATFORMS = frozenset({"windows", "linux", "macos"})

_COMMANDS: dict[str, str] = {
    "windows": (
        "$ErrorActionPreference='SilentlyContinue'; "
        "$cs=Get-CimInstance Win32_ComputerSystem; "
        "$bios=Get-CimInstance Win32_BIOS; "
        "$os=Get-CimInstance Win32_OperatingSystem; "
        "$cpu=Get-CimInstance Win32_Processor | Select-Object -First 1; "
        "$disk=Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | Select-Object -First 1; "
        "$nic=Get-CimInstance Win32_NetworkAdapterConfiguration | "
        "Where-Object { $_.MACAddress -and $_.IPEnabled } | Select-Object -First 1; "
        "Write-Output (\"HOSTNAME=\"+$cs.Name); "
        "Write-Output (\"SERIAL=\"+$bios.SerialNumber); "
        "Write-Output (\"BIOS=\"+$bios.SMBIOSBIOSVersion); "
        "Write-Output (\"UUID=\"+(Get-CimInstance Win32_ComputerSystemProduct).UUID); "
        "Write-Output (\"OS_NAME=\"+$os.Caption); "
        "Write-Output (\"OS_VERSION=\"+$os.Version); "
        "Write-Output (\"OS_BUILD=\"+$os.BuildNumber); "
        "Write-Output (\"OS_ARCH=\"+$os.OSArchitecture); "
        "Write-Output (\"CPU=\"+$cpu.Name); "
        "Write-Output (\"RAM_GB=\"+[math]::Round($cs.TotalPhysicalMemory/1GB,2)); "
        "Write-Output (\"MANUFACTURER=\"+$cs.Manufacturer); "
        "Write-Output (\"MODEL=\"+$cs.Model); "
        "Write-Output (\"DISK=\"+$disk.DeviceID); "
        "Write-Output (\"DISK_CAPACITY_GB=\"+[math]::Round($disk.Size/1GB,2)); "
        "Write-Output (\"MAC=\"+$nic.MACAddress)"
    ),
    "linux": (
        "echo HOSTNAME=$(hostname 2>/dev/null); "
        "echo SERIAL=$( (cat /sys/class/dmi/id/product_serial 2>/dev/null) || echo unknown ); "
        "echo BIOS=$( (cat /sys/class/dmi/id/bios_version 2>/dev/null) || echo unknown ); "
        "echo UUID=$( (cat /sys/class/dmi/id/product_uuid 2>/dev/null) || echo unknown ); "
        "echo OS_NAME=$( (grep PRETTY_NAME /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '\"') "
        "|| uname -s ); "
        "echo OS_VERSION=$( (grep VERSION_ID /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '\"') "
        "|| uname -r ); "
        "echo OS_BUILD=$(uname -r 2>/dev/null); "
        "echo OS_ARCH=$(uname -m 2>/dev/null); "
        "echo CPU=$( (grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs) "
        "|| lscpu 2>/dev/null | grep 'Model name' | cut -d: -f2 | xargs ); "
        "echo RAM_GB=$(awk '/MemTotal/ {printf \"%.2f\", $2/1024/1024}' /proc/meminfo 2>/dev/null); "
        "echo MANUFACTURER=$( (cat /sys/class/dmi/id/sys_vendor 2>/dev/null) || echo unknown ); "
        "echo MODEL=$( (cat /sys/class/dmi/id/product_name 2>/dev/null) || echo unknown ); "
        "echo DISK=$(lsblk -ndo NAME,TYPE 2>/dev/null | awk '$2==\"disk\"{print $1; exit}'); "
        "echo DISK_CAPACITY_GB=$(lsblk -bno SIZE,TYPE 2>/dev/null | "
        "awk '$2==\"disk\"{printf \"%.2f\", $1/1024/1024/1024; exit}'); "
        "echo MAC=$(ip -o link show 2>/dev/null | awk -F'link/ether ' 'NF>1{print $2; exit}' | "
        "awk '{print $1}')"
    ),
    "macos": (
        "echo HOSTNAME=$(scutil --get ComputerName 2>/dev/null || hostname); "
        "echo SERIAL=$(system_profiler SPHardwareDataType 2>/dev/null | "
        "awk -F': ' '/Serial Number/{print $2; exit}'); "
        "echo BIOS=$(system_profiler SPHardwareDataType 2>/dev/null | "
        "awk -F': ' '/Boot ROM/{print $2; exit}'); "
        "echo UUID=$(system_profiler SPHardwareDataType 2>/dev/null | "
        "awk -F': ' '/Hardware UUID/{print $2; exit}'); "
        "echo OS_NAME=$(sw_vers -productName 2>/dev/null); "
        "echo OS_VERSION=$(sw_vers -productVersion 2>/dev/null); "
        "echo OS_BUILD=$(sw_vers -buildVersion 2>/dev/null); "
        "echo OS_ARCH=$(uname -m 2>/dev/null); "
        "echo CPU=$(sysctl -n machdep.cpu.brand_string 2>/dev/null); "
        "echo RAM_GB=$(echo \"scale=2; $(sysctl -n hw.memsize 2>/dev/null)/1024/1024/1024\" | bc); "
        "echo MANUFACTURER=Apple; "
        "echo MODEL=$(sysctl -n hw.model 2>/dev/null); "
        "echo DISK=$(diskutil info disk0 2>/dev/null | awk -F': ' '/Device Node/{print $2; exit}'); "
        "echo DISK_CAPACITY_GB=$(diskutil info disk0 2>/dev/null | "
        "awk -F'[()]' '/Disk Size/{gsub(/[^0-9.]/,\"\",$2); print $2; exit}'); "
        "echo MAC=$(ifconfig en0 2>/dev/null | awk '/ether/{print $2; exit}')"
    ),
}


class HardwareInventoryParser:
    """Parse pasted discovery command output into a normalized profile."""

    def command_for(self, platform: str) -> str:
        key = platform.strip().lower()
        if key not in _COMMANDS:
            raise ValueError(f"Unsupported platform '{platform}'")
        return _COMMANDS[key]

    def parse(self, platform: str, raw_output: str) -> dict[str, Any]:
        key = platform.strip().lower()
        if key not in SUPPORTED_PLATFORMS:
            raise ValueError(f"Unsupported platform '{platform}'")
        kv = self._extract_kv(raw_output or "")
        profile: dict[str, Any] = {
            "parser_version": PARSER_VERSION,
            "platform": key,
            "device": {
                "hostname": self._clean(kv.get("HOSTNAME")),
                "serial_number": self._clean(kv.get("SERIAL")),
                "bios": self._clean(kv.get("BIOS")),
                "uuid": self._clean(kv.get("UUID")),
            },
            "os": {
                "name": self._clean(kv.get("OS_NAME")),
                "version": self._clean(kv.get("OS_VERSION")),
                "build": self._clean(kv.get("OS_BUILD")),
                "architecture": self._clean(kv.get("OS_ARCH")),
            },
            "hardware": {
                "cpu": self._clean(kv.get("CPU")),
                "ram_gb": self._as_float(kv.get("RAM_GB")),
                "manufacturer": self._clean(kv.get("MANUFACTURER")),
                "model": self._clean(kv.get("MODEL")),
            },
            "storage": {
                "disk": self._clean(kv.get("DISK")),
                "capacity_gb": self._as_float(kv.get("DISK_CAPACITY_GB")),
            },
            "network": {
                "mac_address": self._normalize_mac(kv.get("MAC")),
            },
        }
        return profile

    @staticmethod
    def _extract_kv(raw: str) -> dict[str, str]:
        out: dict[str, str] = {}
        for line in raw.splitlines():
            text = line.strip()
            if not text or text.startswith("#"):
                continue
            if "=" in text:
                name, value = text.split("=", 1)
                key = name.strip().upper().replace(" ", "_")
                out[key] = value.strip()
                continue
            # Fallback: "Key: Value" patterns (systeminfo / profiler)
            if ":" in text:
                name, value = text.split(":", 1)
                key = name.strip().upper().replace(" ", "_")
                mapped = {
                    "HOST_NAME": "HOSTNAME",
                    "HOSTNAME": "HOSTNAME",
                    "OS_NAME": "OS_NAME",
                    "SYSTEM_MANUFACTURER": "MANUFACTURER",
                    "SYSTEM_MODEL": "MODEL",
                    "SERIAL_NUMBER": "SERIAL",
                    "BIOS_VERSION": "BIOS",
                    "PROCESSOR": "CPU",
                    "TOTAL_PHYSICAL_MEMORY": "RAM_GB",
                    "PHYSICAL_ADDRESS": "MAC",
                }.get(key)
                if mapped:
                    out[mapped] = value.strip()
        return out

    @staticmethod
    def _clean(value: str | None) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        if not text or text.lower() in {"unknown", "none", "n/a", "null"}:
            return None
        return text[:255]

    @staticmethod
    def _as_float(value: str | None) -> float | None:
        if value is None:
            return None
        text = str(value).strip().replace(",", "")
        match = re.search(r"[\d.]+", text)
        if not match:
            return None
        try:
            return float(match.group(0))
        except ValueError:
            return None

    @staticmethod
    def _normalize_mac(value: str | None) -> str | None:
        cleaned = HardwareInventoryParser._clean(value)
        if not cleaned:
            return None
        hex_only = re.sub(r"[^0-9A-Fa-f]", "", cleaned)
        if len(hex_only) != 12:
            return cleaned[:32]
        parts = [hex_only[i : i + 2] for i in range(0, 12, 2)]
        return ":".join(parts).upper()
