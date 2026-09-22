"""Integration tests for master data routing."""

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_master_data_routes_registered() -> None:
    paths = app.openapi().get("paths", {})
    assert "/api/v1/employees" in paths
    assert "/api/v1/customers" in paths
    assert "/api/v1/vendors" in paths
    assert "/api/v1/products" in paths
    assert "/api/v1/product-categories" in paths
    assert "/api/v1/product-categories/tree" in paths
    assert "/api/v1/uoms" in paths
    assert "/api/v1/currencies" in paths
    assert "/api/v1/currencies/base" in paths
    assert "/api/v1/taxes" in paths
    assert "/api/v1/assets" in paths
    assert "/api/v1/warehouses" in paths
    assert "/api/v1/warehouses/default" in paths


def test_party_registration_routes_registered() -> None:
    paths = app.openapi().get("paths", {})
    assert "/api/v1/party-registrations" in paths
    for action in ("verify-kyc", "evaluate", "submit", "approve", "reject"):
        assert f"/api/v1/party-registrations/{{registration_id}}/{action}" in paths
