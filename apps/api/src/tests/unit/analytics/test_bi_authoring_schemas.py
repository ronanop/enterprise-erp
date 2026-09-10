"""Unit tests for analytics create/update schemas."""

from uuid import uuid4

import pytest
from pydantic import ValidationError

from modules.analytics.schemas import DashboardCreate, DashboardWidgetCreate, KpiCreate


def test_kpi_create_requires_name():
    with pytest.raises(ValidationError):
        KpiCreate()


def test_kpi_create_accepts_source_key():
    body = KpiCreate(kpi_name="Headcount", source_kpi_key="org.headcount_by_department")
    assert body.kpi_name == "Headcount"
    assert body.source_kpi_key == "org.headcount_by_department"


def test_dashboard_create_requires_name():
    with pytest.raises(ValidationError):
        DashboardCreate()


def test_widget_create_requires_dashboard_and_title():
    with pytest.raises(ValidationError):
        DashboardWidgetCreate(widget_title="Tile")
    body = DashboardWidgetCreate(dashboard_id=uuid4(), widget_title="Headcount tile", kpi_id=uuid4())
    assert body.widget_title == "Headcount tile"
