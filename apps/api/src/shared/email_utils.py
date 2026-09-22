"""SMTP send and email parsing helpers."""

from __future__ import annotations

import re
import smtplib
from email.message import EmailMessage
from email.utils import parseaddr

from core.config import settings

_ADDR_RE = re.compile(r"<?([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>?")


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


def send_smtp_email(
    *,
    to_address: str,
    subject: str,
    body_text: str,
    reply_to: str | None = None,
) -> None:
    if not settings.smtp_configured:
        return
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_address
    msg["To"] = to_address
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body_text)
    if settings.smtp_user:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            smtp.send_message(msg)
