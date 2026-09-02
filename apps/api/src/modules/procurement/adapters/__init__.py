"""Procurement adapters — cross-module ports (no foreign-schema writes)."""

from modules.procurement.adapters.crm_adapter import ProcurementCrmAdapter
from modules.procurement.adapters.master_data_adapter import ProcurementMasterDataAdapter

__all__ = ["ProcurementCrmAdapter", "ProcurementMasterDataAdapter"]
