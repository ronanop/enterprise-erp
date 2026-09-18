/**
 * Read-only discovery command catalog (client-side only).
 * Commands are displayed for the user to copy and run manually —
 * the ERP never executes them in the browser or on the server.
 *
 * Basic System Information scripts emit KEY=VALUE lines compatible with
 * the existing Discovery parser (HOSTNAME, SERIAL, OS_NAME, …).
 */

import type { DiscoveryPlatform } from "@/services/assets-service";

export type DiscoveryOsOption = {
  id: DiscoveryPlatform;
  label: string;
};

export const DISCOVERY_OS_OPTIONS: DiscoveryOsOption[] = [
  { id: "windows", label: "Windows" },
  { id: "linux", label: "Linux" },
  { id: "macos", label: "macOS" },
];

/** Windows shell for command generation. Hidden for Linux/macOS. */
export type DiscoveryWindowsShell = "powershell" | "cmd";

export type DiscoveryShellOption = {
  id: DiscoveryWindowsShell;
  label: string;
};

export const DISCOVERY_WINDOWS_SHELL_OPTIONS: DiscoveryShellOption[] = [
  { id: "powershell", label: "PowerShell" },
  { id: "cmd", label: "Command Prompt (CMD)" },
];

export type DiscoveryCommandPack = {
  platform: DiscoveryPlatform;
  shell: DiscoveryWindowsShell | "bash" | "zsh";
  shellLabel: string;
  /** Combined KEY=VALUE inventory script — preferred for Paste + Parse. */
  basicSystemInformation: string;
  /** Optional individual read-only reference commands (UI labels only). */
  referenceCommands: Array<{ title: string; command: string }>;
};

/** PowerShell multi-line script — paste into Windows PowerShell only. */
const WINDOWS_POWERSHELL_BASIC = [
  "$ErrorActionPreference='SilentlyContinue'",
  "$cs = Get-CimInstance Win32_ComputerSystem",
  "$bios = Get-CimInstance Win32_BIOS",
  "$os = Get-CimInstance Win32_OperatingSystem",
  "$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1",
  '$disk = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object -First 1',
  "$nic = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.MACAddress -and $_.IPEnabled } | Select-Object -First 1",
  "$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' } | Select-Object -First 1",
  'Write-Output ("HOSTNAME="+$cs.Name)',
  'Write-Output ("SERIAL="+$bios.SerialNumber)',
  'Write-Output ("BIOS="+$bios.SMBIOSBIOSVersion)',
  'Write-Output ("UUID="+(Get-CimInstance Win32_ComputerSystemProduct).UUID)',
  'Write-Output ("OS_NAME="+$os.Caption)',
  'Write-Output ("OS_VERSION="+$os.Version)',
  'Write-Output ("OS_BUILD="+$os.BuildNumber)',
  'Write-Output ("OS_ARCH="+$os.OSArchitecture)',
  'Write-Output ("CPU="+$cpu.Name)',
  'Write-Output ("RAM_GB="+[math]::Round($cs.TotalPhysicalMemory/1GB,2))',
  'Write-Output ("MANUFACTURER="+$cs.Manufacturer)',
  'Write-Output ("MODEL="+$cs.Model)',
  'Write-Output ("DISK="+$disk.DeviceID)',
  'Write-Output ("DISK_CAPACITY_GB="+[math]::Round($disk.Size/1GB,2))',
  'Write-Output ("MAC="+$nic.MACAddress)',
  'if ($ip) { Write-Output ("IP="+$ip.IPAddress) }',
  'Write-Output ("UPTIME_SEC="+$os.LastBootUpTime)',
].join("\n");

/**
 * Single CMD-pasteable line: invokes PowerShell with KEY=VALUE inventory.
 * Uses only CIM (no Get-Net*) so it works on more Windows editions from CMD.
 */
const WINDOWS_CMD_BASIC =
  'powershell -NoProfile -ExecutionPolicy Bypass -Command "' +
  "$ErrorActionPreference='SilentlyContinue'; " +
  "$cs=Get-CimInstance Win32_ComputerSystem; " +
  "$bios=Get-CimInstance Win32_BIOS; " +
  "$os=Get-CimInstance Win32_OperatingSystem; " +
  "$cpu=@(Get-CimInstance Win32_Processor)[0]; " +
  "$disk=@(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3')[0]; " +
  "$nic=@(Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.MACAddress -and $_.IPEnabled })[0]; " +
  "Write-Output ('HOSTNAME='+$cs.Name); " +
  "Write-Output ('SERIAL='+$bios.SerialNumber); " +
  "Write-Output ('BIOS='+$bios.SMBIOSBIOSVersion); " +
  "Write-Output ('UUID='+(Get-CimInstance Win32_ComputerSystemProduct).UUID); " +
  "Write-Output ('OS_NAME='+$os.Caption); " +
  "Write-Output ('OS_VERSION='+$os.Version); " +
  "Write-Output ('OS_BUILD='+$os.BuildNumber); " +
  "Write-Output ('OS_ARCH='+$os.OSArchitecture); " +
  "Write-Output ('CPU='+$cpu.Name); " +
  "Write-Output ('RAM_GB='+[math]::Round($cs.TotalPhysicalMemory/1GB,2)); " +
  "Write-Output ('MANUFACTURER='+$cs.Manufacturer); " +
  "Write-Output ('MODEL='+$cs.Model); " +
  "Write-Output ('DISK='+$disk.DeviceID); " +
  "Write-Output ('DISK_CAPACITY_GB='+[math]::Round($disk.Size/1GB,2)); " +
  "Write-Output ('MAC='+$nic.MACAddress)" +
  '"';

const LINUX_BASIC = [
  "echo HOSTNAME=$(hostname 2>/dev/null)",
  'echo SERIAL=$( (cat /sys/class/dmi/id/product_serial 2>/dev/null) || echo unknown )',
  'echo BIOS=$( (cat /sys/class/dmi/id/bios_version 2>/dev/null) || echo unknown )',
  'echo UUID=$( (cat /sys/class/dmi/id/product_uuid 2>/dev/null) || echo unknown )',
  'echo OS_NAME=$( (grep PRETTY_NAME /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d \'"\') || uname -s )',
  'echo OS_VERSION=$( (grep VERSION_ID /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d \'"\') || uname -r )',
  "echo OS_BUILD=$(uname -r 2>/dev/null)",
  "echo OS_ARCH=$(uname -m 2>/dev/null)",
  "echo CPU=$( (grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs) || lscpu 2>/dev/null | grep 'Model name' | cut -d: -f2 | xargs )",
  'echo RAM_GB=$(awk \'/MemTotal/ {printf "%.2f", $2/1024/1024}\' /proc/meminfo 2>/dev/null)',
  'echo MANUFACTURER=$( (cat /sys/class/dmi/id/sys_vendor 2>/dev/null) || echo unknown )',
  'echo MODEL=$( (cat /sys/class/dmi/id/product_name 2>/dev/null) || echo unknown )',
  'echo DISK=$(lsblk -ndo NAME,TYPE 2>/dev/null | awk \'$2=="disk"{print $1; exit}\')',
  'echo DISK_CAPACITY_GB=$(lsblk -bno SIZE,TYPE 2>/dev/null | awk \'$2=="disk"{printf "%.2f", $1/1024/1024/1024; exit}\')',
  "echo MAC=$(ip -o link show 2>/dev/null | awk -F'link/ether ' 'NF>1{print $2; exit}' | awk '{print $1}')",
  "echo IP=$(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4; exit}' | cut -d/ -f1)",
  "echo UPTIME=$(uptime -p 2>/dev/null || uptime)",
].join("\n");

const MACOS_BASIC = [
  "echo HOSTNAME=$(scutil --get ComputerName 2>/dev/null || hostname)",
  "echo SERIAL=$(system_profiler SPHardwareDataType 2>/dev/null | awk -F': ' '/Serial Number/{print $2; exit}')",
  "echo BIOS=$(system_profiler SPHardwareDataType 2>/dev/null | awk -F': ' '/Boot ROM/{print $2; exit}')",
  "echo UUID=$(system_profiler SPHardwareDataType 2>/dev/null | awk -F': ' '/Hardware UUID/{print $2; exit}')",
  "echo OS_NAME=$(sw_vers -productName 2>/dev/null)",
  "echo OS_VERSION=$(sw_vers -productVersion 2>/dev/null)",
  "echo OS_BUILD=$(sw_vers -buildVersion 2>/dev/null)",
  "echo OS_ARCH=$(uname -m 2>/dev/null)",
  "echo CPU=$(sysctl -n machdep.cpu.brand_string 2>/dev/null)",
  'echo RAM_GB=$(echo "scale=2; $(sysctl -n hw.memsize 2>/dev/null)/1024/1024/1024" | bc)',
  "echo MANUFACTURER=Apple",
  "echo MODEL=$(sysctl -n hw.model 2>/dev/null)",
  "echo DISK=$(diskutil info disk0 2>/dev/null | awk -F': ' '/Device Node/{print $2; exit}')",
  "echo DISK_CAPACITY_GB=$(diskutil info disk0 2>/dev/null | awk -F'[()]' '/Disk Size/{gsub(/[^0-9.]/,\"\",$2); print $2; exit}')",
  "echo MAC=$(ifconfig en0 2>/dev/null | awk '/ether/{print $2; exit}')",
  "echo IP=$(ipconfig getifaddr en0 2>/dev/null)",
  "echo UPTIME=$(uptime)",
].join("\n");

const WINDOWS_POWERSHELL_REFS: Array<{ title: string; command: string }> = [
  { title: "Hostname", command: "hostname" },
  {
    title: "OS",
    command:
      "Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,OSArchitecture",
  },
  {
    title: "Computer / model",
    command: "Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer,Model",
  },
  { title: "Serial number", command: "(Get-CimInstance Win32_BIOS).SerialNumber" },
  {
    title: "CPU",
    command:
      "Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors",
  },
  {
    title: "RAM",
    command: "Get-CimInstance Win32_ComputerSystem | Select-Object TotalPhysicalMemory",
  },
  {
    title: "Disk",
    command:
      'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,Size,FreeSpace',
  },
  { title: "Network", command: "Get-NetIPConfiguration" },
  { title: "MAC", command: "Get-NetAdapter | Select-Object Name,MacAddress,Status" },
  {
    title: "IP",
    command: "Get-NetIPAddress -AddressFamily IPv4 | Select-Object InterfaceAlias,IPAddress",
  },
];

const WINDOWS_CMD_REFS: Array<{ title: string; command: string }> = [
  { title: "Hostname", command: "hostname" },
  { title: "System summary", command: "systeminfo" },
  { title: "Network / IP / MAC", command: "ipconfig /all" },
  { title: "MAC addresses", command: "getmac /v" },
];

const LINUX_REFS: Array<{ title: string; command: string }> = [
  { title: "Hostname / OS", command: "hostnamectl" },
  { title: "Kernel", command: "uname -a" },
  { title: "OS release", command: "cat /etc/os-release" },
  { title: "CPU", command: "lscpu" },
  { title: "Memory", command: "free -h" },
  { title: "Block devices", command: "lsblk" },
  { title: "Disk free", command: "df -h" },
  { title: "IP addresses", command: "ip addr" },
  { title: "Network links", command: "ip link" },
  { title: "Uptime", command: "uptime" },
];

const MACOS_REFS: Array<{ title: string; command: string }> = [
  { title: "Computer name", command: "scutil --get ComputerName" },
  { title: "OS version", command: "sw_vers" },
  { title: "Architecture", command: "uname -m" },
  { title: "Hardware", command: "system_profiler SPHardwareDataType" },
  { title: "Software", command: "system_profiler SPSoftwareDataType" },
  { title: "Storage", command: "system_profiler SPStorageDataType" },
  { title: "Network ports", command: "networksetup -listallhardwareports" },
  { title: "Interfaces", command: "ifconfig" },
  { title: "Uptime", command: "uptime" },
];

export function getDiscoveryCommandPack(
  platform: DiscoveryPlatform,
  windowsShell: DiscoveryWindowsShell = "powershell",
): DiscoveryCommandPack {
  if (platform === "windows" && windowsShell === "cmd") {
    return {
      platform: "windows",
      shell: "cmd",
      shellLabel: "Windows Command Prompt (CMD)",
      basicSystemInformation: WINDOWS_CMD_BASIC,
      referenceCommands: WINDOWS_CMD_REFS,
    };
  }
  if (platform === "windows") {
    return {
      platform: "windows",
      shell: "powershell",
      shellLabel: "Windows PowerShell",
      basicSystemInformation: WINDOWS_POWERSHELL_BASIC,
      referenceCommands: WINDOWS_POWERSHELL_REFS,
    };
  }
  if (platform === "linux") {
    return {
      platform: "linux",
      shell: "bash",
      shellLabel: "Linux shell",
      basicSystemInformation: LINUX_BASIC,
      referenceCommands: LINUX_REFS,
    };
  }
  return {
    platform: "macos",
    shell: "zsh",
    shellLabel: "macOS Terminal",
    basicSystemInformation: MACOS_BASIC,
    referenceCommands: MACOS_REFS,
  };
}

/**
 * Clipboard payload = executable Basic System Information only.
 * No `#` / REM comment lines (those break CMD paste).
 */
export function formatDiscoveryCommandsForClipboard(pack: DiscoveryCommandPack): string {
  return `${pack.basicSystemInformation.trim()}\n`;
}

/** Keys the ERP Discovery parser expects from Basic System Information output. */
export const DISCOVERY_PARSER_KEYS = [
  "HOSTNAME",
  "SERIAL",
  "BIOS",
  "UUID",
  "OS_NAME",
  "OS_VERSION",
  "OS_BUILD",
  "OS_ARCH",
  "CPU",
  "RAM_GB",
  "MANUFACTURER",
  "MODEL",
  "DISK",
  "DISK_CAPACITY_GB",
  "MAC",
] as const;
