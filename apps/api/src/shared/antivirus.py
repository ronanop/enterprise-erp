"""ClamAV / clamd antivirus scan for uploaded bytes (VAPT 7.1.25)."""

from __future__ import annotations

import socket
from dataclasses import dataclass

from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)


class AntivirusUnavailableError(RuntimeError):
    """Raised when ClamAV is required but unreachable."""


class MalwareDetectedError(ValueError):
    """Raised when ClamAV reports an infected file."""


@dataclass(frozen=True)
class ScanResult:
    clean: bool
    signature: str | None = None
    skipped: bool = False
    reason: str | None = None


def _clamd_instream(raw: bytes, *, host: str, port: int, timeout: float) -> ScanResult:
    """Scan via clamd INSTREAM protocol (no temp files on the scanner host)."""
    # Protocol: zINSTREAM\\0 + length(4 BE) + chunk ... + length 0
    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.settimeout(timeout)
        sock.sendall(b"zINSTREAM\x00")
        # 64 KiB chunks — 2 KiB was far too chatty for multi-MB invoice PDFs.
        chunk_size = 64 * 1024
        view = memoryview(raw)
        for offset in range(0, len(view), chunk_size):
            piece = view[offset : offset + chunk_size]
            sock.sendall(len(piece).to_bytes(4, "big") + bytes(piece))
        sock.sendall((0).to_bytes(4, "big"))
        response = b""
        while True:
            part = sock.recv(4096)
            if not part:
                break
            response += part
            if b"\x00" in response or response.endswith(b"\n"):
                break
    text = response.decode("utf-8", errors="replace").strip().strip("\x00")
    # Typical: "stream: OK" or "stream: Eicar-Test-Signature FOUND"
    if text.endswith("OK") or " OK" in text:
        return ScanResult(clean=True)
    if "FOUND" in text:
        sig = text.split(":", 1)[-1].replace("FOUND", "").strip()
        return ScanResult(clean=False, signature=sig or "UNKNOWN")
    # Unexpected reply — treat as unavailable so fail-open/closed can decide.
    raise AntivirusUnavailableError(f"Unexpected clamd response: {text[:200]}")


def scan_bytes(raw: bytes | None) -> ScanResult:
    """Scan upload bytes. No-op when CLAMAV_ENABLED is false."""
    if not getattr(settings, "clamav_enabled", False):
        return ScanResult(clean=True, skipped=True, reason="disabled")
    if raw is None or len(raw) == 0:
        return ScanResult(clean=True, skipped=True, reason="empty")

    host = (settings.clamav_host or "clamav").strip()
    port = int(settings.clamav_port or 3310)
    timeout = float(settings.clamav_timeout_seconds or 30)
    fail_open = bool(getattr(settings, "clamav_fail_open", False))

    try:
        result = _clamd_instream(raw, host=host, port=port, timeout=timeout)
    except (OSError, TimeoutError, AntivirusUnavailableError) as exc:
        logger.warning("ClamAV scan unavailable: %s", exc)
        if fail_open:
            return ScanResult(clean=True, skipped=True, reason=str(exc))
        raise AntivirusUnavailableError(
            "Antivirus service is unavailable; upload rejected"
        ) from exc

    if not result.clean:
        raise MalwareDetectedError(
            f"Malware detected in upload ({result.signature or 'unknown signature'})"
        )
    return result
