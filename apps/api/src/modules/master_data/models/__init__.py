"""Master Data ORM models."""

from modules.master_data.models.asset import MasterAsset
from modules.master_data.models.category import MasterProductCategory
from modules.master_data.models.employee import MasterEmployee
from modules.master_data.models.party import MasterCustomer, MasterVendor
from modules.master_data.models.party_registration import MasterPartyRegistration
from modules.master_data.models.product import MasterProduct
from modules.master_data.models.reference import MasterCurrency, MasterTax, MasterUom
from modules.master_data.models.warehouse import MasterWarehouse

__all__ = [
    "MasterAsset",
    "MasterCurrency",
    "MasterCustomer",
    "MasterEmployee",
    "MasterPartyRegistration",
    "MasterProduct",
    "MasterProductCategory",
    "MasterTax",
    "MasterUom",
    "MasterVendor",
    "MasterWarehouse",
]
