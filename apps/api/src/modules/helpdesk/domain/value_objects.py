"""Helpdesk value objects."""

from dataclasses import dataclass


@dataclass(frozen=True)
class HelpdeskCodes:
    document_number: str
