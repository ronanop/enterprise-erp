"""Classify inbox messages as ticket candidates based on subject/from rules."""

from __future__ import annotations

from core.config import settings

NOISE_FROM_TOKENS = (
    "noreply@",
    "no-reply@",
    "mailer-daemon@",
    "notifications@",
    "donotreply@",
)


def resolved_subject_patterns() -> list[str]:
    """Comma-separated substrings from EMAIL_TICKET_SUBJECT_PATTERNS (empty = not configured yet)."""
    raw = (getattr(settings, "email_ticket_subject_patterns", None) or "").strip()
    if not raw:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


def is_noise_sender(from_address: str) -> bool:
    lower_from = (from_address or "").lower()
    return any(token in lower_from for token in NOISE_FROM_TOKENS)


def subject_matches_ticket_patterns(subject: str) -> bool:
    patterns = resolved_subject_patterns()
    if not patterns:
        return False
    subject_lower = (subject or "").lower()
    return any(pat.lower() in subject_lower for pat in patterns)


def accept_all_inbound_mail() -> bool:
    """Production mode: every real (non-noise) mail becomes a ticket."""
    return bool(getattr(settings, "email_ticket_accept_all", False))


def should_auto_create_ticket(*, subject: str, from_address: str) -> bool:
    return skip_ticket_reason(subject=subject, from_address=from_address) is None


def skip_ticket_reason(*, subject: str, from_address: str) -> str | None:
    """Why an email was not turned into a ticket (None = should create)."""
    if is_noise_sender(from_address):
        return "noise_sender"
    # Production mailbox: take all real mail.
    if accept_all_inbound_mail():
        return None
    # Demo / filtered mode: subject must match patterns (e.g. contain "ticket").
    if subject_matches_ticket_patterns(subject):
        return None
    if resolved_subject_patterns():
        return "subject_pattern_mismatch"
    # No patterns configured and accept-all off — do not create from arbitrary mail.
    return "subject_filter_required"


def classify_mailbox_message(*, subject: str, from_address: str) -> str:
    """
    Returns one of:
      - not_ticket — automated/noise sender or filtered out
      - likely_ticket — will auto-create
      - review — real mail awaiting rules / manual review
    """
    if is_noise_sender(from_address):
        return "not_ticket"

    if accept_all_inbound_mail():
        return "likely_ticket"

    if subject_matches_ticket_patterns(subject):
        return "likely_ticket"

    if resolved_subject_patterns():
        return "not_ticket"

    return "review"
