"""Unit tests for lead Service Sourcing Channel parsing."""

from modules.crm.domain.lead_sourcing_channels import (
    SERVICE_CHANNEL_CACHE,
    SERVICE_CHANNEL_OUTSOURCED,
    normalize_service_sourcing_channel,
    parse_service_sourcing_channel,
)


def test_parse_service_sourcing_outsourced():
    raw = '{"hardware":["B2B"],"service":"Outsourced"}'
    assert parse_service_sourcing_channel(raw) == SERVICE_CHANNEL_OUTSOURCED


def test_parse_service_sourcing_cache_service():
    raw = '{"service":"Cache Service"}'
    assert parse_service_sourcing_channel(raw) == SERVICE_CHANNEL_CACHE


def test_parse_service_sourcing_ignores_legacy_free_text():
    assert parse_service_sourcing_channel("Back to Back") is None
    assert parse_service_sourcing_channel("") is None
    assert parse_service_sourcing_channel(None) is None


def test_parse_service_sourcing_rejects_unknown():
    assert parse_service_sourcing_channel('{"service":"Other"}') is None


def test_normalize_service_sourcing_channel():
    assert normalize_service_sourcing_channel(" Outsourced ") == SERVICE_CHANNEL_OUTSOURCED
    assert normalize_service_sourcing_channel("Cache Service") == SERVICE_CHANNEL_CACHE
    assert normalize_service_sourcing_channel("nope") is None
