"""Site installation workflow extension for Project Management."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.project.models.mixins import PrjDetailMixin


class PrjSiteInstallation(Base, *PrjDetailMixin):
    """One-to-one site delivery workflow attached to a project."""

    __tablename__ = "prj_site_installation"
    __table_args__ = (
        UniqueConstraint("project_id", name="uk_prj_site_installation_project"),
        UniqueConstraint("company_id", "document_number", name="uk_prj_site_company_doc"),
        CheckConstraint(
            "delivery_type IN ("
            "'server_os_rack','server_os','server_bios_rack','rack_only','server_bios'"
            ")",
            name="ck_prj_site_delivery_type",
        ),
        CheckConstraint(
            "workflow_stage IN ("
            "'intake','assignment','survey','scm','onsite',"
            "'onsite_delivery','material_handover',"
            "'installation','acceptance','completed'"
            ")",
            name="ck_prj_site_workflow_stage",
        ),
        CheckConstraint(
            "status IN ('active','completed','cancelled')",
            name="ck_prj_site_status",
        ),
        {"schema": "project"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("project.prj_project.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)

    # Delivery scope (Type 1 / 2 / 3)
    delivery_type: Mapped[str] = mapped_column(
        String(40), nullable=False, default="server_os_rack"
    )
    workflow_stage: Mapped[str] = mapped_column(
        String(30), nullable=False, default="intake", index=True
    )

    # Header / intake verticals
    requestor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    circle: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cloud_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    site_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    power_requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
    rfai_request_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    rfai_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fabric_partner: Mapped[str | None] = mapped_column(String(255), nullable=True)
    application: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Survey
    cable_length: Mapped[str | None] = mapped_column(String(100), nullable=True)
    industrial_socket: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    lugs: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cable_lines: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    lug_lines: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    industrial_socket_lines: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    power_on_material: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    tile_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    survey_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    space_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    power_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    power_on_material_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    survey_completed_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    space_available_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    power_available_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Quantities
    server_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rack_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # SCM / logistics dates
    server_wh_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    server_on_site_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    rack_wh_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    rack_on_site_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    pdu_wh_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    pdu_on_site_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    mo_request: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    im_material: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    material_handover_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mo_request_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    im_material_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    material_handover_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    material_handover_to_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Installation
    rack_server_stacking_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    rack_server_power_on_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    dac_ilo_cabling_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    rack_server_stacking_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    rack_server_power_on_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    dac_ilo_cabling_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Configuration
    bios_configuration_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    firmware_config_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    lld_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    os_installation_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    vm_installation_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    nw_config_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    tools_integration_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mbss_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    vascan_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    bios_configuration_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    firmware_config_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    lld_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    os_installation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    vm_installation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    nw_config_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    tools_integration_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    mbss_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    vascan_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Acceptance
    handover_to_cloud_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    hwat_request_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    hwat_signoff_received: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    handover_to_cloud_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    hwat_request_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    hwat_signoff_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Stage evidence attachments (file name required before advancing)
    survey_attachment_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    scm_attachment_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    onsite_attachment_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    onsite_delivery_attachment_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    material_handover_attachment_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    installation_attachment_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    acceptance_attachment_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Owner-reported progress + remarks per stage
    survey_progress_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    scm_progress_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    onsite_progress_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    onsite_delivery_progress_status: Mapped[str | None] = mapped_column(
        String(40), nullable=True
    )
    material_handover_progress_status: Mapped[str | None] = mapped_column(
        String(40), nullable=True
    )
    installation_progress_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    acceptance_progress_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    survey_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    scm_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    onsite_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    onsite_delivery_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    material_handover_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    installation_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    acceptance_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Stage owners — set by project assignee before Survey work begins
    survey_assignee_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    scm_assignee_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    onsite_assignee_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    onsite_delivery_assignee_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    material_handover_assignee_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    installation_assignee_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    configuration_assignee_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    acceptance_assignee_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # Stage tracking — assigned when the step starts; finished when advanced
    survey_assigned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    survey_finished_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    scm_assigned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    scm_finished_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    onsite_assigned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    onsite_finished_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    onsite_delivery_assigned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    onsite_delivery_finished_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    material_handover_assigned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    material_handover_finished_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    installation_assigned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    installation_finished_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    acceptance_assigned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    acceptance_finished_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
