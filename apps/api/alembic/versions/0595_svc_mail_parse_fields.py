"""Add circuit / site fields parsed from NOC-style service emails."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0595_svc_mail_parse_fields"
down_revision: str | None = "0594_svc_field_engineers"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("svc_service_request", sa.Column("ckt_id", sa.String(100), nullable=True), schema="service")
    op.add_column("svc_service_request", sa.Column("site_availability", sa.String(255), nullable=True), schema="service")
    op.add_column("svc_service_request", sa.Column("site_instructions", sa.Text(), nullable=True), schema="service")
    op.add_column("svc_service_request", sa.Column("link_type", sa.String(100), nullable=True), schema="service")
    op.add_column("svc_service_request", sa.Column("bandwidth", sa.String(100), nullable=True), schema="service")
    op.add_column("svc_service_request", sa.Column("ports_in_use", sa.String(255), nullable=True), schema="service")
    op.add_column("svc_service_request", sa.Column("previous_fe_notes", sa.Text(), nullable=True), schema="service")
    op.add_column("svc_service_request", sa.Column("ip_details", sa.Text(), nullable=True), schema="service")
    op.add_column("svc_service_request", sa.Column("mail_extra_info", sa.Text(), nullable=True), schema="service")
    op.add_column("svc_service_request", sa.Column("company_name_from_mail", sa.String(255), nullable=True), schema="service")


def downgrade() -> None:
    op.drop_column("svc_service_request", "company_name_from_mail", schema="service")
    op.drop_column("svc_service_request", "mail_extra_info", schema="service")
    op.drop_column("svc_service_request", "ip_details", schema="service")
    op.drop_column("svc_service_request", "previous_fe_notes", schema="service")
    op.drop_column("svc_service_request", "ports_in_use", schema="service")
    op.drop_column("svc_service_request", "bandwidth", schema="service")
    op.drop_column("svc_service_request", "link_type", schema="service")
    op.drop_column("svc_service_request", "site_instructions", schema="service")
    op.drop_column("svc_service_request", "site_availability", schema="service")
    op.drop_column("svc_service_request", "ckt_id", schema="service")
