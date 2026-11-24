"""Lead / opportunity product-type helpers."""

from __future__ import annotations

from typing import Any


def product_type_tokens(product_type: str | None) -> set[str]:
    """Normalize stored product_type (comma / & separated) to lowercase tokens."""
    return {
        part.strip().lower()
        for part in (product_type or "").replace("&", ",").split(",")
        if part.strip()
    }


def product_type_includes_services(product_type: str | None) -> bool:
    return "services" in product_type_tokens(product_type)


def entity_has_services(entity: Any) -> bool:
    """True when a lead or opportunity includes Services in its product mix."""
    if entity is None:
        return False
    if bool(getattr(entity, "has_services", False)):
        return True
    return product_type_includes_services(getattr(entity, "product_type", None))
