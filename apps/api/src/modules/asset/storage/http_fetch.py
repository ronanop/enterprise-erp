"""Server-side download of SCM document URLs. Stores our own copy; never hot-link."""

from __future__ import annotations

import ipaddress
import logging
import socket
from urllib.parse import urljoin, urlparse

import httpx

from core.config import get_settings
from modules.asset.domain.exceptions import DcChallanValidationError

logger = logging.getLogger(__name__)

_DOWNLOAD_TIMEOUT = httpx.Timeout(15.0, connect=5.0)
_CHUNK = 64 * 1024
_MAX_REDIRECTS = 3
_REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})


class SsrfBlockedError(DcChallanValidationError):
    """URL intake rejected because the host is not a safe public target."""

    def __init__(self, message: str, *, blocked_host: str) -> None:
        super().__init__(message)
        self.blocked_host = blocked_host


def parse_allowed_hosts(raw: str | None) -> tuple[str, ...]:
    if not raw:
        return ()
    return tuple(part.strip().lower().rstrip(".") for part in raw.split(",") if part.strip())


def host_allowed(hostname: str, allowed: tuple[str, ...]) -> bool:
    host = (hostname or "").strip().lower().rstrip(".")
    if not host or not allowed:
        return False
    for entry in allowed:
        if host == entry or host.endswith("." + entry):
            return True
    return False


def _ip_is_blocked(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if ip.version == 6 and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return bool(
        ip.is_loopback
        or ip.is_private
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def resolve_host_ips(hostname: str) -> list[str]:
    host = hostname.strip().strip("[]")
    try:
        parsed = ipaddress.ip_address(host)
        return [str(parsed)]
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise DcChallanValidationError(
            f"Could not download SCM document: hostname {host!r} did not resolve"
        ) from exc
    ips: list[str] = []
    for info in infos:
        sockaddr = info[4]
        if sockaddr:
            ips.append(str(sockaddr[0]))
    if not ips:
        raise DcChallanValidationError(
            f"Could not download SCM document: hostname {host!r} did not resolve"
        )
    return ips


def guard_document_url(url: str) -> str:
    """Validate scheme, optional allowlist, and resolved IPs. Returns the hostname."""
    parsed = urlparse(url)
    scheme = (parsed.scheme or "").lower()
    if scheme not in {"http", "https"}:
        raise SsrfBlockedError(
            "Document URL must use http or https (file, ftp, and other schemes are not allowed)",
            blocked_host=parsed.netloc or scheme or "unknown",
        )
    hostname = (parsed.hostname or "").strip()
    if not hostname:
        raise SsrfBlockedError(
            "Document URL must be an http(s) URL with a host",
            blocked_host="unknown",
        )

    settings = get_settings()
    allowed = parse_allowed_hosts(settings.asset_dc_challan_scm_allowed_hosts or "")
    is_production = (settings.environment or "").strip().lower() in {"production", "prod"}
    if not allowed:
        if is_production:
            raise SsrfBlockedError(
                "URL-based SCM document intake is disabled: set ASSET_DC_CHALLAN_SCM_ALLOWED_HOSTS",
                blocked_host=hostname,
            )
    elif not host_allowed(hostname, allowed):
        logger.error("Blocked SCM document URL: host %s is not in the allowlist", hostname)
        raise SsrfBlockedError(
            f"SCM document host {hostname!r} is not in ASSET_DC_CHALLAN_SCM_ALLOWED_HOSTS",
            blocked_host=hostname,
        )

    for raw_ip in resolve_host_ips(hostname):
        try:
            ip = ipaddress.ip_address(raw_ip)
        except ValueError:
            continue
        if _ip_is_blocked(ip):
            logger.error(
                "Blocked SCM document URL: host %s resolved to non-public IP %s",
                hostname,
                raw_ip,
            )
            raise SsrfBlockedError(
                f"SCM document URL target is not a public address ({hostname} → {raw_ip})",
                blocked_host=hostname,
            )
    return hostname


def download_document_bytes(url: str, *, max_bytes: int) -> bytes:
    """Fetch ``url`` and return the body. Raises DcChallanValidationError on failure."""
    current = url
    data = b""
    try:
        for _hop in range(_MAX_REDIRECTS + 1):
            guard_document_url(current)
            with httpx.Client(timeout=_DOWNLOAD_TIMEOUT, follow_redirects=False) as client:
                with client.stream("GET", current) as response:
                    if response.status_code in _REDIRECT_STATUSES:
                        location = (response.headers.get("location") or "").strip()
                        if not location:
                            raise DcChallanValidationError(
                                "Could not download SCM document: redirect was missing a Location header"
                            )
                        current = urljoin(current, location)
                        continue
                    if response.status_code == 404:
                        raise DcChallanValidationError(
                            "Could not download SCM document: the URL returned 404"
                        )
                    if response.status_code >= 400:
                        raise DcChallanValidationError(
                            f"Could not download SCM document: HTTP {response.status_code}"
                        )
                    chunks: list[bytes] = []
                    total = 0
                    for chunk in response.iter_bytes(_CHUNK):
                        if not chunk:
                            continue
                        total += len(chunk)
                        if total > max_bytes:
                            raise DcChallanValidationError(
                                f"Downloaded document exceeds the {max_bytes // (1024 * 1024)} MB size limit"
                            )
                        chunks.append(chunk)
                    data = b"".join(chunks)
                    break
        else:
            raise SsrfBlockedError(
                "Could not download SCM document: too many redirects",
                blocked_host=urlparse(current).hostname or "unknown",
            )
    except SsrfBlockedError:
        raise
    except DcChallanValidationError:
        raise
    except httpx.TimeoutException as exc:
        raise DcChallanValidationError(
            "Could not download SCM document: the request timed out"
        ) from exc
    except httpx.HTTPError as exc:
        raise DcChallanValidationError(
            "Could not download SCM document: the URL was not reachable"
        ) from exc
    if not data:
        raise DcChallanValidationError("Could not download SCM document: empty response")
    return data
