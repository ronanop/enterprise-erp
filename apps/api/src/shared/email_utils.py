"""SMTP send and email parsing helpers."""

from __future__ import annotations

import re
import smtplib
import threading
import time
from email.message import EmailMessage
from email.utils import parseaddr

from core.config import settings

_ADDR_RE = re.compile(r"<?([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>?")

# Shared with SmtpEmailAdapter pacing so Hostinger rate limits stay consistent.
_SEND_LOCK = threading.Lock()
_LAST_SEND_AT = 0.0


def parse_email_address(raw: str | None) -> tuple[str, str]:
    """Return (display_name, email_address) from a From header or bare address."""
    if not raw or not raw.strip():
        return "", ""
    name, addr = parseaddr(raw.strip())
    if addr:
        return name.strip(), addr.strip().lower()
    match = _ADDR_RE.search(raw)
    if match:
        return name.strip() or match.group(1).split("@")[0], match.group(1).lower()
    return raw.strip(), ""


def strip_html(html: str) -> str:
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.I | re.S)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</p>", "\n\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _pace_smtp_sends() -> None:
    global _LAST_SEND_AT
    delay = float(getattr(settings, "smtp_send_delay_seconds", 0) or 0)
    if delay <= 0:
        return
    with _SEND_LOCK:
        now = time.monotonic()
        wait = delay - (now - _LAST_SEND_AT)
        if wait > 0:
            time.sleep(wait)
        _LAST_SEND_AT = time.monotonic()


def _smtp_connect() -> smtplib.SMTP:
    """Hostinger (and similar) use implicit SSL on 465; 587 uses STARTTLS."""
    host = settings.smtp_host.strip()
    port = int(settings.smtp_port)
    if port == 465:
        client: smtplib.SMTP = smtplib.SMTP_SSL(host, port, timeout=30)
    else:
        client = smtplib.SMTP(host, port, timeout=30)
        if settings.smtp_use_tls:
            client.starttls()
    if settings.smtp_user:
        client.login(settings.smtp_user, settings.smtp_password)
    return client


def send_smtp_email(
    *,
    to_address: str,
    subject: str,
    body_text: str,
    reply_to: str | None = None,
) -> None:
    """Send plain-text mail. Supports SMTP_PORT 465 (SSL) and 587 (STARTTLS)."""
    if not settings.smtp_configured:
        return
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_address
    msg["To"] = to_address
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body_text or " ")
    _pace_smtp_sends()
    with _smtp_connect() as smtp:
        smtp.send_message(msg)
