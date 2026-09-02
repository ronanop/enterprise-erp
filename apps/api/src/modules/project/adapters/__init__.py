"""Project adapters."""

from modules.project.adapters.finance_port import ProjectFinanceAdapter
from modules.project.adapters.crm_port import ProjectCrmAdapter
from modules.project.adapters.master_data_port import ProjectMasterDataAdapter
from modules.project.adapters.organization_port import ProjectOrganizationAdapter
from modules.project.adapters.payroll_port import ProjectPayrollAdapter
from modules.project.adapters.procurement_port import ProjectProcurementAdapter

__all__ = [
    "ProjectCrmAdapter",
    "ProjectFinanceAdapter",
    "ProjectMasterDataAdapter",
    "ProjectOrganizationAdapter",
    "ProjectPayrollAdapter",
    "ProjectProcurementAdapter",
]
