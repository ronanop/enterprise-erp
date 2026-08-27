"""Asset ORM models."""

from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_assignment import AstAssetAssignment
from modules.asset.models.asset_audit import AstAssetAudit
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.models.asset_checklist import AstAssetChecklist
from modules.asset.models.asset_component import AstAssetComponent
from modules.asset.models.assignment_component import AstAssignmentComponent
from modules.asset.models.asset_depreciation import AstAssetDepreciation
from modules.asset.models.asset_disposal import AstAssetDisposal
from modules.asset.models.asset_document import AstAssetDocument
from modules.asset.models.asset_insurance import AstAssetInsurance
from modules.asset.models.asset_location import AstAssetLocation
from modules.asset.models.asset_maintenance import AstAssetMaintenance
from modules.asset.models.asset_maintenance_plan import AstAssetMaintenancePlan
from modules.asset.models.asset_meter_reading import AstAssetMeterReading
from modules.asset.models.asset_notification import AstAssetNotification
from modules.asset.models.asset_report import AstAssetReport
from modules.asset.models.asset_revaluation import AstAssetRevaluation
from modules.asset.models.asset_service_history import AstAssetServiceHistory
from modules.asset.models.asset_transfer import AstAssetTransfer
from modules.asset.models.asset_warranty import AstAssetWarranty
from modules.asset.models.dc_challan import AstDcChallan
from modules.asset.models.dc_challan_document import AstDcChallanDocument
from modules.asset.models.incoming_asset import (
    AstIncomingArrivalEvent,
    AstIncomingAssetLine,
    AstIncomingAssetUnit,
    AstIncomingQcEvent,
)

__all__ = [
    "AstAssetCategory",
    "AstAsset",
    "AstAssetComponent",
    "AstAssignmentComponent",
    "AstAssetAssignment",
    "AstAssetTransfer",
    "AstAssetLocation",
    "AstAssetWarranty",
    "AstAssetInsurance",
    "AstAssetMaintenancePlan",
    "AstAssetMaintenance",
    "AstAssetServiceHistory",
    "AstAssetDepreciation",
    "AstAssetDisposal",
    "AstAssetRevaluation",
    "AstAssetAudit",
    "AstAssetDocument",
    "AstAssetChecklist",
    "AstAssetMeterReading",
    "AstAssetNotification",
    "AstAssetReport",
    "AstIncomingAssetLine",
    "AstIncomingAssetUnit",
    "AstIncomingArrivalEvent",
    "AstIncomingQcEvent",
    "AstDcChallan",
    "AstDcChallanDocument",
]
