"""Procurement permission constants per ERD_06 §14.1."""

PROC_PERMISSIONS: list[tuple[str, str, str, str]] = [
    # Requisition
    ("procurement.requisition:read", "procurement.requisition", "read", "procurement"),
    ("procurement.requisition:create", "procurement.requisition", "create", "procurement"),
    ("procurement.requisition:update", "procurement.requisition", "update", "procurement"),
    ("procurement.requisition:delete", "procurement.requisition", "delete", "procurement"),
    ("procurement.requisition:submit", "procurement.requisition", "submit", "procurement"),
    ("procurement.requisition:approve", "procurement.requisition", "approve", "procurement"),
    ("procurement.requisition:convert", "procurement.requisition", "convert", "procurement"),
    # RFQ
    ("procurement.rfq:read", "procurement.rfq", "read", "procurement"),
    ("procurement.rfq:create", "procurement.rfq", "create", "procurement"),
    ("procurement.rfq:update", "procurement.rfq", "update", "procurement"),
    ("procurement.rfq:publish", "procurement.rfq", "publish", "procurement"),
    ("procurement.rfq:close", "procurement.rfq", "close", "procurement"),
    # Vendor Quotation
    ("procurement.vendor_quotation:read", "procurement.vendor_quotation", "read", "procurement"),
    (
        "procurement.vendor_quotation:create",
        "procurement.vendor_quotation",
        "create",
        "procurement",
    ),
    (
        "procurement.vendor_quotation:update",
        "procurement.vendor_quotation",
        "update",
        "procurement",
    ),
    (
        "procurement.vendor_quotation:select",
        "procurement.vendor_quotation",
        "select",
        "procurement",
    ),
    # Order
    ("procurement.order:read", "procurement.order", "read", "procurement"),
    ("procurement.order:create", "procurement.order", "create", "procurement"),
    ("procurement.order:update", "procurement.order", "update", "procurement"),
    ("procurement.order:submit", "procurement.order", "submit", "procurement"),
    ("procurement.order:approve", "procurement.order", "approve", "procurement"),
    ("procurement.order:cancel", "procurement.order", "cancel", "procurement"),
    ("procurement.order:send", "procurement.order", "send", "procurement"),
    # GRN
    ("procurement.grn:read", "procurement.grn", "read", "procurement"),
    ("procurement.grn:create", "procurement.grn", "create", "procurement"),
    ("procurement.grn:update", "procurement.grn", "update", "procurement"),
    ("procurement.grn:confirm", "procurement.grn", "confirm", "procurement"),
    # Invoice
    ("procurement.invoice:read", "procurement.invoice", "read", "procurement"),
    ("procurement.invoice:create", "procurement.invoice", "create", "procurement"),
    ("procurement.invoice:update", "procurement.invoice", "update", "procurement"),
    ("procurement.invoice:submit", "procurement.invoice", "submit", "procurement"),
    ("procurement.invoice:approve", "procurement.invoice", "approve", "procurement"),
    ("procurement.invoice:post", "procurement.invoice", "post", "procurement"),
    ("procurement.invoice:cancel", "procurement.invoice", "cancel", "procurement"),
    # Return
    ("procurement.return:read", "procurement.return", "read", "procurement"),
    ("procurement.return:create", "procurement.return", "create", "procurement"),
    ("procurement.return:update", "procurement.return", "update", "procurement"),
    ("procurement.return:submit", "procurement.return", "submit", "procurement"),
    ("procurement.return:approve", "procurement.return", "approve", "procurement"),
    ("procurement.return:receive", "procurement.return", "receive", "procurement"),
    ("procurement.return:post", "procurement.return", "post", "procurement"),
    # Contract
    ("procurement.contract:read", "procurement.contract", "read", "procurement"),
    ("procurement.contract:create", "procurement.contract", "create", "procurement"),
    ("procurement.contract:update", "procurement.contract", "update", "procurement"),
    ("procurement.contract:submit", "procurement.contract", "submit", "procurement"),
    ("procurement.contract:approve", "procurement.contract", "approve", "procurement"),
    # Performance
    ("procurement.performance:read", "procurement.performance", "read", "procurement"),
    # Report
    ("procurement.report:read", "procurement.report", "read", "procurement"),
    ("procurement.report:export", "procurement.report", "export", "procurement"),
]

# Master-data vendor lookups required for PO creation, SCM handoff, and vendor registry.
PROC_MASTER_VENDOR_PERMISSIONS = [
    "master.vendor:read",
    "master.vendor:create",
    "master.vendor:update",
]

BUYER_PERMISSIONS = [
    "procurement.requisition:read",
    "procurement.requisition:create",
    "procurement.requisition:update",
    "procurement.requisition:submit",
    "procurement.requisition:convert",
    "procurement.rfq:read",
    "procurement.rfq:create",
    "procurement.rfq:update",
    "procurement.rfq:publish",
    "procurement.rfq:close",
    "procurement.vendor_quotation:read",
    "procurement.vendor_quotation:create",
    "procurement.vendor_quotation:update",
    "procurement.vendor_quotation:select",
    "procurement.order:read",
    "procurement.order:create",
    "procurement.order:update",
    "procurement.order:submit",
    "procurement.order:send",
    "procurement.grn:read",
    "procurement.grn:create",
    "procurement.grn:update",
    "procurement.grn:confirm",
    "procurement.invoice:read",
    "procurement.invoice:create",
    "procurement.invoice:update",
    "procurement.invoice:submit",
    "procurement.return:read",
    "procurement.return:create",
    "procurement.return:update",
    "procurement.return:submit",
    "procurement.return:receive",
    "procurement.contract:read",
    "procurement.performance:read",
    "procurement.report:read",
] + PROC_MASTER_VENDOR_PERMISSIONS

PROCUREMENT_MANAGER_PERMISSIONS = list(
    dict.fromkeys(
        BUYER_PERMISSIONS
        + [
            "procurement.requisition:delete",
            "procurement.requisition:approve",
            "procurement.order:approve",
            "procurement.order:cancel",
            "procurement.return:approve",
            "procurement.contract:create",
            "procurement.contract:update",
            "procurement.contract:submit",
            "procurement.contract:approve",
            "procurement.report:export",
        ]
    )
)

FINANCE_REVIEWER_PERMISSIONS = [
    "procurement.invoice:read",
    "procurement.invoice:approve",
    "procurement.invoice:post",
    "procurement.invoice:cancel",
    "procurement.return:read",
    "procurement.return:approve",
    "procurement.return:post",
    "procurement.report:read",
    "procurement.report:export",
    "master.vendor:read",
]
