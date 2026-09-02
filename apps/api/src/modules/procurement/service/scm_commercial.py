"""Shared SCM commercial totals (OVF queue, PO lists, CRM handoff)."""


def scm_total_margin_amount(
    summary: dict,
    *,
    customer_total: float,
    vendor_total: float,
) -> float:
    """Net margin after freight, additional charges, and finance — matches SCM OVF view."""
    products = summary.get("products_margin_amount")
    if products is None:
        products = customer_total - vendor_total
    else:
        products = float(products)
    freight = float(summary.get("freight") or 0)
    additional = float(summary.get("additional_charges") or 0)
    finance_pct = float(summary.get("finance_cost_pct") or 0)
    finance_amount = vendor_total * finance_pct / 100.0
    return products - freight - additional - finance_amount
