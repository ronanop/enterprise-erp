"""CRM adapters."""

from modules.crm.adapters.master_data_port import CrmMasterDataAdapter
from modules.crm.adapters.sales_port import CrmSalesAdapter

__all__ = ["CrmMasterDataAdapter", "CrmSalesAdapter"]
