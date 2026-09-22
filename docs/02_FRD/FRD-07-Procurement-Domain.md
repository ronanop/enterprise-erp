# FRD-07 PROCUREMENT DOMAIN

## Version
1.0

## Status
Architecture Approved

## Cross References
- Upstream dependency: [FRD-03 Master Data Domain](./FRD-03-Master-Data-Domain.md)
- Downstream dependencies: [FRD-08 Inventory & Warehouse Domain](./FRD-08-Inventory-Warehouse-Domain.md), [FRD-04 Finance & Accounting Domain](./FRD-04-Finance-Accounting-Domain.md)
- Related: [FRD-14 Quality Management Domain](./FRD-14-Quality-Management-Domain.md) (Incoming Quality Check)

## 1. PURPOSE

Procurement Domain organization ke purchasing process ko manage karega.

From:

```
Purchase Requirement
↓
Purchase Requisition
↓
RFQ
↓
Vendor Selection
↓
Purchase Order
↓
Goods Receipt
↓
Vendor Invoice
↓
Payment
```

### Business Objectives

- Standardized Procurement
- Vendor Management
- Cost Control
- Purchase Transparency
- Approval Governance
- Supplier Performance Tracking

## 2. MODULES COVERED

- Purchase Requisition
- RFQ Management
- Vendor Quotation Management
- Vendor Comparison
- Purchase Orders
- Goods Receipt Notes (GRN)
- Vendor Contracts
- Purchase Invoicing
- Vendor Performance

## 3. PROCUREMENT LIFECYCLE

```
Purchase Need
↓
Purchase Requisition
↓
RFQ
↓
Vendor Quotes
↓
Vendor Selection
↓
Purchase Order
↓
Goods Receipt
↓
Vendor Invoice
↓
Payment
↓
Closed
```

## 4. PURCHASE REQUISITION (PR)

### Purpose

Internal request for procurement.

### Requisition Fields

| Field | Mandatory |
|---|---|
| PR Number | Yes |
| Requester | Yes |
| Department | Yes |
| Cost Center | Yes |
| Required Date | Yes |
| Priority | Yes |
| Status | Yes |

### PR Number Format

```
PR-2026-000001
```

### Priority Levels

- Low
- Medium
- High
- Critical

### Status

- Draft
- Submitted
- Approved
- Rejected
- Converted To RFQ

## 5. RFQ MANAGEMENT

### Purpose

Collect vendor quotations.

### RFQ Fields

| Field |
|---|
| RFQ Number |
| PR Reference |
| RFQ Date |
| Closing Date |
| Vendors Invited |
| Status |

### RFQ Number

```
RFQ-2026-000001
```

### RFQ Status

- Draft
- Published
- Quotes Received
- Closed
- Cancelled

## 6. VENDOR QUOTATION MANAGEMENT

### Purpose

Store vendor responses.

### Quotation Fields

| Field |
|---|
| Vendor |
| RFQ |
| Quote Date |
| Valid Until |
| Total Amount |
| Currency |

### Attachments

Allowed:

- PDF
- Excel
- Images
- Documents

## 7. VENDOR COMPARISON

### Purpose

Compare quotations.

### Comparison Parameters

- Price
- Delivery Time
- Payment Terms
- Vendor Rating
- Warranty
- Past Performance

### Recommendation Engine

System shall generate:

- Best Price
- Best Delivery
- Best Overall Score

## 8. PURCHASE ORDER (PO)

### Purpose

Official procurement order.

### PO Fields

| Field |
|---|
| PO Number |
| Vendor |
| PO Date |
| Currency |
| Payment Terms |
| Delivery Date |
| Status |

### PO Number

```
PO-2026-000001
```

### PO Status

- Draft
- Approved
- Sent
- Partially Received
- Received
- Closed
- Cancelled

### Business Rules

Approved PO:

Can Create GRN

Cancelled PO:

Cannot Receive Goods

## 9. PO LINE ITEMS

### Fields

| Field |
|---|
| Product |
| Quantity |
| UOM |
| Unit Cost |
| Tax |
| Line Total |

### Validation

- Quantity > 0
- Cost > 0

## 10. GOODS RECEIPT NOTE (GRN)

### Purpose

Receive purchased goods.

### GRN Fields

| Field |
|---|
| GRN Number |
| PO Reference |
| Warehouse |
| Receipt Date |
| Status |

### GRN Number

```
GRN-2026-000001
```

### Status

- Pending
- Partially Received
- Received
- Rejected

### Inventory Impact

GRN Posting:

Inventory Increase

## 11. VENDOR CONTRACT MANAGEMENT

### Purpose

Manage procurement agreements.

### Fields

| Field |
|---|
| Contract Number |
| Vendor |
| Start Date |
| End Date |
| Contract Value |
| Status |

### Status

- Draft
- Active
- Expired
- Terminated

## 12. PURCHASE INVOICE

### Purpose

Vendor billing management.

### Fields

| Field |
|---|
| Invoice Number |
| Vendor |
| Invoice Date |
| Due Date |
| Amount |
| Tax |

### Finance Impact

Invoice Posting:

- Expense / Inventory Dr
- Accounts Payable Cr

## 13. VENDOR PERFORMANCE MANAGEMENT

### KPIs

- On-Time Delivery %
- Quality Rating
- Cost Competitiveness
- Contract Compliance
- Issue Resolution Time

### Vendor Score

Scale:

0 - 100

## 14. SCREEN INVENTORY

- Purchase Dashboard
- Purchase Requisition List
- RFQ Dashboard
- Vendor Quotes
- Vendor Comparison
- Purchase Order Dashboard
- GRN Dashboard
- Purchase Invoice Dashboard
- Vendor Contracts
- Vendor Performance Dashboard

## 15. APPROVAL WORKFLOWS

### Purchase Requisition

```
Employee
↓
Manager
↓
Approved
```

### RFQ Approval

```
Procurement Executive
↓
Procurement Manager
↓
Approved
```

### Purchase Order Approval

```
Buyer
↓
Procurement Manager
↓
Finance Manager
↓
Approved
```

### High Value Purchase

```
Buyer
↓
Procurement Manager
↓
Finance Manager
↓
CFO
↓
Approved
```

Threshold configurable.

## 16. NOTIFICATIONS

Events

- PR Submitted
- RFQ Published
- Vendor Quote Received
- PO Approved
- GRN Created
- Invoice Due

Channels

- Email
- In-App
- WhatsApp

## 17. AUDIT REQUIREMENTS

Track:

- PR Changes
- RFQ Changes
- Vendor Selection
- PO Changes
- GRN Posting
- Invoice Posting

## 18. DATABASE TABLES

- purchase_requisitions
- purchase_requisition_items
- rfqs
- rfq_vendors
- vendor_quotations
- vendor_comparisons
- purchase_orders
- purchase_order_items
- grns
- grn_items
- vendor_contracts
- purchase_invoices
- vendor_performance

## 19. KEY RELATIONSHIPS

```
Vendor
1:N Quotations

Vendor
1:N Purchase Orders

Purchase Requisition
1:N RFQs

RFQ
1:N Vendor Quotes

Purchase Order
1:N GRNs

Purchase Order
1:N Purchase Invoices
```

## 20. API SPECIFICATIONS

### PR APIs

```
GET /api/v1/purchase-requisitions

POST /api/v1/purchase-requisitions

PUT /api/v1/purchase-requisitions/{id}
```

### RFQ APIs

```
GET /api/v1/rfqs

POST /api/v1/rfqs
```

### PO APIs

```
GET /api/v1/purchase-orders

POST /api/v1/purchase-orders

PUT /api/v1/purchase-orders/{id}
```

### GRN APIs

```
GET /api/v1/grns

POST /api/v1/grns
```

## 21. REPORTS

### Procurement Reports

- Purchase Requisition Report
- RFQ Analysis Report
- Vendor Comparison Report
- Purchase Order Report
- GRN Report
- Vendor Performance Report
- Procurement Spend Analysis
- Contract Utilization Report

## 22. ACCEPTANCE CRITERIA

✅ Purchase Requisition workflow works

✅ RFQ process works

✅ Vendor comparison works

✅ Purchase Order approval works

✅ GRN updates inventory

✅ Purchase Invoice updates AP

✅ Vendor performance calculated

✅ Procurement reports generated

## 23. UAT SCENARIOS

### UAT-001

Create Purchase Requisition

Expected:

PR Created Successfully

### UAT-002

Publish RFQ

Expected:

RFQ Sent To Vendors

### UAT-003

Create Purchase Order

Expected:

PO Generated Successfully

### UAT-004

Post GRN

Expected:

Inventory Updated

### UAT-005

Post Vendor Invoice

Expected:

Accounts Payable Created

## ARCHITECT REVIEW

FRD-07 Procurement Domain is now locked.

### Dependency Chain

```
Foundation
↓
Organization
↓
Master Data
↓
Procurement
↓
Inventory
↓
Finance
```
