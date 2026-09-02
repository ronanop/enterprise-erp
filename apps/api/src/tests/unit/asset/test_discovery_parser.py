"""Unit tests for HardwareInventoryParser (CR-003)."""

import pytest

from modules.asset.service.discovery_parser import HardwareInventoryParser, PARSER_VERSION


SAMPLE = """
HOSTNAME=LAPTOP-01
SERIAL=SN-ABC-123
BIOS=1.2.3
UUID=11111111-2222-3333-4444-555555555555
OS_NAME=Windows 11 Pro
OS_VERSION=10.0.26200
OS_BUILD=26200
OS_ARCH=64-bit
CPU=Intel(R) Core(TM) i7
RAM_GB=16.00
MANUFACTURER=Dell Inc.
MODEL=Latitude 5440
DISK=C:
DISK_CAPACITY_GB=512.00
MAC=AA-BB-CC-DD-EE-FF
"""


def test_command_for_supported_platforms() -> None:
    parser = HardwareInventoryParser()
    for platform in ("windows", "linux", "macos"):
        cmd = parser.command_for(platform)
        assert "HOSTNAME" in cmd or "hostname" in cmd.lower()


def test_parse_normalizes_profile() -> None:
    profile = HardwareInventoryParser().parse("windows", SAMPLE)
    assert profile["parser_version"] == PARSER_VERSION
    assert profile["platform"] == "windows"
    assert profile["device"]["hostname"] == "LAPTOP-01"
    assert profile["device"]["serial_number"] == "SN-ABC-123"
    assert profile["hardware"]["ram_gb"] == 16.0
    assert profile["network"]["mac_address"] == "AA:BB:CC:DD:EE:FF"


def test_parse_rejects_unknown_platform() -> None:
    with pytest.raises(ValueError, match="Unsupported"):
        HardwareInventoryParser().parse("android", SAMPLE)
