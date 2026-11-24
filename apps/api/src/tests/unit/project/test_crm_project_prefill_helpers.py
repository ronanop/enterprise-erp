"""Unit tests for CRM → Projects intake helpers (circle city, site address)."""

from types import SimpleNamespace

from modules.project.adapters.crm_port import _circle_city, _site_address_from_lead


def test_circle_city_prefers_lead_city_over_account():
    lead = SimpleNamespace(city="Pune")
    account = SimpleNamespace(shipping_city="Mumbai", billing_city="Delhi")
    assert _circle_city(lead, account) == "Pune"


def test_circle_city_falls_back_to_shipping_then_billing():
    assert (
        _circle_city(None, SimpleNamespace(shipping_city="Jaipur", billing_city="Delhi"))
        == "Jaipur"
    )
    assert (
        _circle_city(None, SimpleNamespace(shipping_city=None, billing_city="Delhi"))
        == "Delhi"
    )
    assert _circle_city(SimpleNamespace(city="  "), None) is None
    assert _circle_city(None, None) is None


def test_site_address_from_lead():
    lead = SimpleNamespace(
        street="12 MG Road",
        city="Bengaluru",
        state="Karnataka",
        zip="560001",
        country="India",
    )
    assert "Bengaluru" in (_site_address_from_lead(lead) or "")
    assert "12 MG Road" in (_site_address_from_lead(lead) or "")
