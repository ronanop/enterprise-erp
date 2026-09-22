"""HSN / SAC classification.

The code printed on a line decides how the order is executed and invoiced:

* **HSN** (goods) - physical material that ships from the warehouse with the
  invoice, e-way bill, and PO copy attached.
* **SAC** (services & software, GST chapter 99) - nothing ships, so the invoice
  is submitted on the customer portal and the work is executed by Operations.
"""

from __future__ import annotations

GOODS = "hsn"
SERVICES = "sac"

# Indian SAC codes for services all sit in GST chapter 99.
_SERVICE_CHAPTER = "99"


def classify_hsn_sac(code: str | None) -> str | None:
    """``'sac'`` for services/software, ``'hsn'`` for goods, ``None`` when unknown."""
    digits = "".join(ch for ch in (code or "") if ch.isdigit())
    if len(digits) < 4:
        return None
    return SERVICES if digits.startswith(_SERVICE_CHAPTER) else GOODS


def is_service_code(code: str | None) -> bool:
    return classify_hsn_sac(code) == SERVICES
