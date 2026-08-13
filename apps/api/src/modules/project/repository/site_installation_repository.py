"""Project PrjSiteInstallation repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.project.models.site_installation import PrjSiteInstallation
from modules.project.repository.base import PrjScopedRepository, utcnow


class SiteInstallationRepository(PrjScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> PrjSiteInstallation | None:
        stmt = select(PrjSiteInstallation).where(
            PrjSiteInstallation.id == row_id,
            PrjSiteInstallation.is_deleted.is_(False),
        )
        stmt = self.apply_prj_filter(stmt, PrjSiteInstallation, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def get_by_project(
        self, ctx: TenantContext, project_id: UUID
    ) -> PrjSiteInstallation | None:
        stmt = select(PrjSiteInstallation).where(
            PrjSiteInstallation.project_id == project_id,
            PrjSiteInstallation.is_deleted.is_(False),
        )
        stmt = self.apply_prj_filter(stmt, PrjSiteInstallation, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(PrjSiteInstallation).where(
            PrjSiteInstallation.company_id == company_id,
            PrjSiteInstallation.is_deleted.is_(False),
        )
        stmt = self.apply_prj_filter(stmt, PrjSiteInstallation, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> PrjSiteInstallation:
        row = PrjSiteInstallation(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> PrjSiteInstallation | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None or k in {
                "tile_details",
                "remarks",
                "requestor_name",
                "circle",
                "cloud_name",
                "site_name",
                "power_requirements",
                "rfai_number",
                "fabric_partner",
                "application",
                "cable_length",
                "cable_lines",
                "lug_lines",
                "industrial_socket_lines",
                "power_on_material_date",
                "survey_completed_date",
                "space_available_date",
                "power_available_date",
                "mo_request_date",
                "im_material_date",
                "material_handover_date",
                "rack_server_stacking_date",
                "rack_server_power_on_date",
                "dac_ilo_cabling_date",
                "bios_configuration_date",
                "firmware_config_date",
                "lld_date",
                "os_installation_date",
                "vm_installation_date",
                "nw_config_date",
                "tools_integration_date",
                "mbss_date",
                "vascan_date",
                "handover_to_cloud_date",
                "hwat_request_date",
                "hwat_signoff_date",
                "survey_assignee_employee_id",
                "scm_assignee_employee_id",
                "installation_assignee_employee_id",
                "configuration_assignee_employee_id",
                "acceptance_assignee_employee_id",
                "survey_assigned_date",
                "survey_finished_date",
                "scm_assigned_date",
                "scm_finished_date",
                "installation_assigned_date",
                "installation_finished_date",
                "acceptance_assigned_date",
                "acceptance_finished_date",
                "survey_attachment_name",
                "scm_attachment_name",
                "onsite_attachment_name",
                "installation_attachment_name",
                "acceptance_attachment_name",
                "survey_progress_status",
                "scm_progress_status",
                "onsite_progress_status",
                "installation_progress_status",
                "acceptance_progress_status",
                "survey_remarks",
                "scm_remarks",
                "onsite_remarks",
                "installation_remarks",
                "acceptance_remarks",
                "material_handover_to_name",
                "onsite_assignee_employee_id",
                "onsite_assigned_date",
                "onsite_finished_date",
                "server_qty",
                "rack_qty",
                "server_wh_delivery_date",
                "server_on_site_delivery_date",
                "rack_wh_delivery_date",
                "rack_on_site_delivery_date",
                "pdu_wh_delivery_date",
                "pdu_on_site_delivery_date",
            }:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
