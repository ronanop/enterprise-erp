"""One-shot patch: transform copied ecommerce generator into portal generator."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "scripts" / "_gen_portal_module.py"
text = p.read_text(encoding="utf-8")

text = text.replace(
    "Generate Sprint 22 E-Commerce / External Channel module",
    "Generate Sprint 23 Customer Portal module",
)
text = text.replace("_gen_ecommerce_module.py", "_gen_portal_module.py")
text = text.replace('ECOMMERCE = SRC / "modules" / "ecommerce"', 'PORTAL = SRC / "modules" / "portal"')
text = text.replace("ECOMMERCE", "PORTAL")

repls = [
    ("E-Commerce", "Customer Portal"),
    ("Ecommerce", "Portal"),
    ("ecommerce", "portal"),
    ("EcRowMixin", "PtRowMixin"),
    ("Ec", "Pt"),
    ("ERD_22", "ERD_23"),
    ("Sprint 22", "Sprint 23"),
    ("apply_ecommerce_filter", "apply_portal_filter"),
    ("EcommerceScopedRepository", "PortalScopedRepository"),
    ("EcommerceScopeValidator", "PortalScopeValidator"),
    ("EcommerceNumberService", "PortalNumberService"),
    ("EcommerceIntegrationService", "PortalIntegrationService"),
    ("EcommerceApplicationService", "PortalApplicationService"),
    ("EcommerceEntityType", "PortalEntityType"),
    ("EcommerceFinanceAdapter", "PortalFinanceAdapter"),
    ("EcommerceMasterDataAdapter", "PortalMasterDataAdapter"),
    ("EcommerceOrganizationAdapter", "PortalOrganizationAdapter"),
    ("EcommerceSalesAdapter", "PortalSalesAdapter"),
    ("EcommerceInventoryAdapter", "PortalInventoryAdapter"),
    ("EcommerceIntegrationHubAdapter", "PortalIntegrationHubAdapter"),
    ("test_ec_hub", "test_pt_hub"),
    ("ec_hub", "pt_hub"),
]
for old, new in repls:
    text = text.replace(old, new)

# Fix accidental double-replace on router name
text = text.replace("portalportal", "portal")

p.write_text(text, encoding="utf-8")
print("bulk replace done", len(text))
