# ENTERPRISE DATABASE STANDARDS (DBS)
## iConnect Plus

**Version:** 1.1
**Status:** Architecture Baseline Approved (Technology Alignment - SDD v1.1 ADR-002)
**Document Type:** Database Governance Standard
**Owner:** Enterprise Architecture Team
**Classification:** Internal - Confidential

---

## Document Control

| Field            | Value                                        |
| ---------------- | -------------------------------------------- |
| Document Name    | Enterprise Database Standards (DBS)          |
| Project          | iConnect Plus       |
| Version          | 1.1                                          |
| Status           | Architecture Baseline Approved (ADR-002)     |
| Document Type    | Database Governance Standard                 |
| Owner            | Enterprise Architecture Team                 |
| Reviewed By      | Solution Architect                           |
| Approved By      | Chief Technology Officer (CTO)               |
| Classification   | Internal - Confidential                      |
| Applicable To    | All ERP Modules                              |
| Effective Date   | TBD                                          |
| Review Cycle     | Quarterly                                    |

---

## Revision History

| Version | Date               | Author                       | Changes                     | Status   |
| ------- | ------------------ | ---------------------------- | --------------------------- | -------- |
| 0.1     | Initial Draft      | Enterprise Architecture Team | Initial Database Standards  | Draft    |
| 1.0     | Architecture Review | Enterprise Architecture Team | Approved Baseline           | Approved |
| 1.1     | 2026-07-06          | Enterprise Architecture Team | SQLAlchemy 2.0 / Alembic alignment per SDD v1.1 ADR-002 | Approved |

---

## Table of Contents

- [PART 1 - DATABASE GOVERNANCE](#part-1--database-governance)
  - [3. Purpose](#3-purpose)
  - [4. Scope](#4-scope)
  - [5. Database Vision](#5-database-vision)
  - [6. Database Design Principles](#6-database-design-principles)
  - [7. Enterprise Database Architecture](#7-enterprise-database-architecture)
  - [8. Database Classification](#8-database-classification)
  - [9. Database Governance](#9-database-governance)
  - [10. Enterprise Database Lifecycle](#10-enterprise-database-lifecycle)
  - [11. Compliance Statement](#11-compliance-statement)
  - [12. Architecture Approval](#12-architecture-approval)

- [PART 2 - DATABASE STANDARDS](#part-2--database-standards)
  - [13. Database Naming Standards](#13-database-naming-standards)
  - [14. Schema Naming Standards](#14-schema-naming-standards)
  - [15. Table Naming Standards](#15-table-naming-standards)
  - [16. Column Naming Standards](#16-column-naming-standards)
  - [17. Primary Key Standards](#17-primary-key-standards)
  - [18. Foreign Key Standards](#18-foreign-key-standards)
  - [19. Unique Key Standards](#19-unique-key-standards)
  - [20. Constraint Naming Standards](#20-constraint-naming-standards)
  - [21. Index Naming Standards](#21-index-naming-standards)
  - [22. Sequence Standards](#22-sequence-standards)
  - [23. Enum Standards](#23-enum-standards)
  - [24. Data Type Standards](#24-data-type-standards)
  - [25. UUID Standards](#25-uuid-standards)
  - [26. SQLAlchemy 2.0 ORM Standards](#26-sqlalchemy-20-orm-standards)

- [PART 3 - TABLE STANDARDS](#part-3--table-standards)
  - [27. Table Classification Framework](#27-table-classification-framework)
  - [28. Master Table Standards](#28-master-table-standards)
  - [29. Transaction Table Standards](#29-transaction-table-standards)
  - [30. Reference Table Standards](#30-reference-table-standards)
  - [31. Workflow Table Standards](#31-workflow-table-standards)
  - [32. Audit Table Standards](#32-audit-table-standards)
  - [33. History Table Standards](#33-history-table-standards)
  - [34. Configuration Table Standards](#34-configuration-table-standards)
  - [35. Integration Table Standards](#35-integration-table-standards)
  - [36. Notification Table Standards](#36-notification-table-standards)
  - [37. Analytics Table Standards](#37-analytics-table-standards)
  - [38. Scheduler Table Standards](#38-scheduler-table-standards)
  - [39. Security Table Standards](#39-security-table-standards)
  - [40. Standard Table Lifecycle](#40-standard-table-lifecycle)
  - [41. Common Mandatory Columns Matrix](#41-common-mandatory-columns-matrix)
  - [42. Table Design Checklist](#42-table-design-checklist)

- [PART 4 - ENTERPRISE DATABASE RULES](#part-4--enterprise-database-rules)
  - [43. Audit Standards](#43-audit-standards)
  - [44. Standard Audit Columns](#44-standard-audit-columns)
  - [45. Soft Delete Standards](#45-soft-delete-standards)
  - [46. Versioning Standards](#46-versioning-standards)
  - [47. Multi-Tenant Standards](#47-multi-tenant-standards)
  - [48. Multi-Company Standards](#48-multi-company-standards)
  - [49. Multi-Branch Standards](#49-multi-branch-standards)
  - [50. Data Ownership Rules](#50-data-ownership-rules)
  - [51. Referential Integrity Rules](#51-referential-integrity-rules)
  - [52. Cascade Rules](#52-cascade-rules)
  - [53. JSON Standards](#53-json-standards)
  - [54. File Storage Standards](#54-file-storage-standards)
  - [55. Encryption Standards](#55-encryption-standards)
  - [56. Security Classification](#56-security-classification)
  - [57. Data Masking Standards](#57-data-masking-standards)
  - [58. Data Quality Standards](#58-data-quality-standards)
  - [59. Database Governance Checklist](#59-database-governance-checklist)

- [PART 5 - PERFORMANCE, SCALABILITY & OPERATIONS](#part-5--performance-scalability--operations)
  - [60. Database Performance Principles](#60-database-performance-principles)
  - [61. Index Strategy](#61-index-strategy)
  - [62. Composite Index Strategy](#62-composite-index-strategy)
  - [63. Full-Text Search Strategy](#63-full-text-search-strategy)
  - [64. Query Optimization Standards](#64-query-optimization-standards)
  - [65. Pagination Standards](#65-pagination-standards)
  - [66. Caching Strategy](#66-caching-strategy)
  - [67. Partition Strategy](#67-partition-strategy)
  - [68. Archival Strategy](#68-archival-strategy)
  - [69. Backup Strategy](#69-backup-strategy)
  - [70. Disaster Recovery Standards](#70-disaster-recovery-standards)
  - [71. Database Monitoring Standards](#71-database-monitoring-standards)
  - [72. Performance Optimization Standards](#72-performance-optimization-standards)
  - [73. Capacity Planning](#73-capacity-planning)
  - [74. Database Health Checklist](#74-database-health-checklist)
  - [75. Performance Testing Standards](#75-performance-testing-standards)
  - [76. Capacity Targets](#76-capacity-targets)
  - [77. Operational Review Checklist](#77-operational-review-checklist)

- [PART 6 - DEVELOPMENT GOVERNANCE & DATABASE APPROVAL](#part-6--development-governance--database-approval)
  - [78. SQLAlchemy 2.0 ORM Standards](#78-sqlalchemy-20-orm-standards)
  - [79. Migration Standards](#79-migration-standards)
  - [80. Seed Data Standards](#80-seed-data-standards)
  - [81. Database Coding Standards](#81-database-coding-standards)
  - [82. Database Review Checklist](#82-database-review-checklist)
  - [83. Database Change Management](#83-database-change-management)
  - [84. Database Versioning Policy](#84-database-versioning-policy)
  - [85. Architecture Governance](#85-architecture-governance)
  - [86. Exception Management](#86-exception-management)
  - [87. Database Security Review](#87-database-security-review)
  - [88. Production Readiness Checklist](#88-production-readiness-checklist)
  - [89. Appendices](#89-appendices)
  - [90. Final Database Architecture Approval](#90-final-database-architecture-approval)

- [Cross Reference Matrix](#cross-reference-matrix)
- [Database Governance Summary](#database-governance-summary)
- [Enterprise Database Readiness](#enterprise-database-readiness)
- [Next Phase](#next-phase)

---

# PART 1 - DATABASE GOVERNANCE

---

## 3. Purpose

The purpose of this document is to establish a single, consistent, enterprise-wide database standard for the ERP Platform.

This document defines:

- Database Architecture Standards
- Naming Standards
- Data Modeling Standards
- Multi-Tenant Rules
- Data Integrity Rules
- Performance Standards
- Security Standards
- Governance Rules

Every database object in the ERP system-including tables, views, indexes, constraints, functions, triggers, stored procedures (if used), materialized views, and migrations-must comply with this document.

---

## 4. Scope

This standard applies to every module of the ERP.

**Covered Domains:**

- Foundation
- Organization
- Master Data
- Finance
- HR
- Payroll
- CRM
- Sales
- Procurement
- Inventory
- Warehouse
- Manufacturing
- Quality
- SCM
- Projects
- Assets
- Service Management
- Helpdesk
- DMS
- BI
- GRC
- Integration Hub
- E-Commerce
- Analytics
- Platform Services

**Out of Scope**

This document does not define:

- Business Processes (BRD)
- Functional Behavior (FRD)
- System Architecture (SDD)
- API Specifications
- UI Design

---

## 5. Database Vision

The ERP database shall serve as a single source of truth for all enterprise operational data while supporting:

- Multi-Tenant SaaS Deployment
- Multi-Company Operations
- Multi-Branch Operations
- High Availability
- High Performance
- Enterprise Reporting
- Analytics
- Future Microservice Extraction

---

## 6. Database Design Principles

Every database object shall follow these principles.

**DBP-01**

Single Source of Truth

No duplicate master data shall exist.

---

**DBP-02**

Normalization First

Database shall be normalized to at least Third Normal Form (3NF).

Controlled denormalization is permitted only for reporting and performance optimization.

---

**DBP-03**

Referential Integrity

All business relationships shall be enforced through foreign keys unless there is a documented exception.

---

**DBP-04**

UUID-Based Identity

Every business entity shall use UUID as the primary key.

---

**DBP-05**

Auditability

Every business transaction shall be traceable.

---

**DBP-06**

Soft Delete

Business records shall not be physically deleted.

---

**DBP-07**

Tenant Isolation

No data leakage across tenants.

---

**DBP-08**

Security by Design

Sensitive data shall be encrypted.

---

**DBP-09**

Scalability

The database shall support horizontal application scaling and future service decomposition.

---

**DBP-10**

Performance

Indexes shall be designed based on access patterns rather than assumptions.

---

## 7. Enterprise Database Architecture

### Architecture Overview

```text
Applications
        │
        ▼
SQLAlchemy 2.0 ORM
        │
        ▼
PostgreSQL Cluster
        │
 ┌──────┼─────────┐
 │      │         │
 ▼      ▼         ▼

Core ERP DB

Analytics DB

Read Replicas

        │
        ▼

Redis Cache

        │
        ▼

OpenSearch

        │
        ▼

Object Storage
```

### Database Components

| Component        | Purpose                        |
| ---------------- | ------------------------------ |
| Core ERP Database | Transactional data (OLTP)     |
| Analytics Database | Reporting and BI             |
| Read Replica     | Read-heavy workloads           |
| Redis            | Caching                        |
| OpenSearch       | Full-text search               |
| Object Storage   | Files & Documents              |

---

## 8. Database Classification

The ERP database shall be logically classified into the following domains:

| Domain        | Purpose                        |
| ------------- | ------------------------------ |
| Foundation    | Authentication, RBAC, Workflow |
| Organization  | Companies, Branches            |
| Master Data   | Core Business Masters          |
| Transactions  | Operational Data               |
| Workflow      | Approval Processes             |
| Audit         | Audit Logs                     |
| Integration   | External Systems               |
| Analytics     | BI & Reporting                 |
| Configuration | System Settings                |

---

## 9. Database Governance

### Ownership

Every table must have:

| Role             | Responsibility          |
| ---------------- | ----------------------- |
| Business Owner   | Business Rules          |
| Data Steward     | Data Quality            |
| Technical Owner  | Database Maintenance    |

### Approval Process

No new table may be added unless:

- Architecture Review completed
- Naming standards validated
- Security review completed
- Performance review completed
- ERD updated
- API impact assessed
- Migration strategy defined

---

## 10. Enterprise Database Lifecycle

```text
Requirement
      │
      ▼
BRD
      │
      ▼
FRD
      │
      ▼
SDD
      │
      ▼
Database Standards (DBS)
      │
      ▼
ERD
      │
      ▼
Physical Schema
      │
      ▼
SQLAlchemy Models
      │
      ▼
Alembic Migration
      │
      ▼
API Implementation
      │
      ▼
Development
      │
      ▼
Testing
      │
      ▼
Deployment
```

---

## 11. Compliance Statement

All ERP database objects shall comply with:

- Enterprise Database Standards (DBS)
- System Design Document (SDD)
- Functional Requirement Document (FRD)
- Business Requirement Document (BRD)

No implementation shall bypass the standards defined in this document.

---

## 12. Architecture Approval

This document establishes the official database governance baseline for the iConnect Plus.

Any deviation from these standards must be documented through an Architecture Decision Record (ADR) and approved by the Enterprise Architecture Review Board.

**ARCHITECT REVIEW**

| Area                  | Status |
| --------------------- | ------ |
| Document Governance   | ✅     |
| Database Vision       | ✅     |
| Database Principles   | ✅     |
| Architecture Baseline | ✅     |
| Governance Model      | ✅     |
| Compliance Model      | ✅     |
| Lifecycle Definition  | ✅     |

---

# PART 2 - DATABASE STANDARDS

---

## 13. Database Naming Standards

### Purpose

Establish a consistent, scalable, and maintainable naming convention across all database objects.

### Objectives

- Improve readability
- Maintain consistency
- Simplify maintenance
- Reduce ambiguity
- Enable automated code generation
- Ensure SQLAlchemy 2.0 ORM compatibility

### General Rules

**DNS-01**

Use snake_case for all database objects.

✅ Correct

```text
purchase_orders
employee_master
inventory_transactions
```

❌ Incorrect

```text
PurchaseOrders
purchaseOrders
Purchase_Order
```

---

**DNS-02**

Use only lowercase letters.

---

**DNS-03**

Do not use spaces.

---

**DNS-04**

Avoid abbreviations unless officially standardized.

Example

❌

```text
emp
cust
vend
```

✅

```text
employee
customer
vendor
```

---

**DNS-05**

Object names should clearly represent business meaning.

---

## 14. Schema Naming Standards

The ERP shall use logical schemas to separate responsibilities.

### Recommended Schemas

| Schema        | Purpose                        |
| ------------- | ------------------------------ |
| foundation    | Authentication, RBAC           |
| organization  | Companies, Branches            |
| master        | Master Data                    |
| finance       | Finance                        |
| hr            | HR & Payroll                   |
| crm           | CRM                            |
| sales         | Sales                          |
| procurement   | Procurement                    |
| inventory     | Inventory                      |
| manufacturing | Manufacturing                  |
| quality       | Quality                        |
| projects      | Projects                       |
| assets        | Asset Management               |
| service       | Service Management             |
| helpdesk      | Helpdesk                       |
| dms           | Document Management            |
| analytics     | BI                             |
| integration   | Integration Hub                |
| audit         | Audit                          |
| config        | System Configuration           |

### Rule

Business modules must never create tables inside another module's schema.

---

## 15. Table Naming Standards

Every table shall use meaningful names.

### Prefix Strategy

| Prefix  | Description             |
| ------- | ----------------------- |
| master_ | Master Tables           |
| trx_    | Transaction Tables      |
| ref_    | Reference Tables        |
| audit_  | Audit Tables            |
| hist_   | History Tables          |
| wf_     | Workflow Tables         |
| cfg_    | Configuration Tables    |
| int_    | Integration Tables      |
| ana_    | Analytics Tables        |
| ntf_    | Notification Tables     |

### Examples

**Master**

```text
master_customer

master_vendor

master_product

master_employee
```

**Transactions**

```text
trx_sales_order

trx_purchase_order

trx_invoice

trx_payment
```

**Reference**

```text
ref_country

ref_currency

ref_tax_type

ref_language
```

**Workflow**

```text
wf_definition

wf_instance

wf_task
```

**Audit**

```text
audit_log

audit_change

audit_session
```

---

## 16. Column Naming Standards

Column names shall be descriptive.

### Primary Key

```text
id
```

### Foreign Keys

Always:

```text
customer_id

vendor_id

employee_id

company_id

branch_id
```

Never:

```text
cust

emp

company

vendorCode
```

### Audit Columns

Every business table shall include:

```text
created_at

created_by

updated_at

updated_by
```

### Soft Delete

```text
is_deleted

deleted_at

deleted_by
```

### Tenant Columns

```text
tenant_id

company_id

branch_id
```

### Status Columns

```text
status

workflow_status

approval_status
```

---

## 17. Primary Key Standards

### Standard

Every table must use:

```text
UUID
```

### Example

```sql
id UUID PRIMARY KEY
```

### Why UUID?

- Globally unique
- Microservice ready
- Secure
- Replication friendly
- Import friendly

---

## 18. Foreign Key Standards

Every relationship shall be enforced through Foreign Keys.

### Example

```sql
customer_id
REFERENCES master_customer(id)
```

### Rules

- No orphan records
- Indexed FK
- Consistent naming

---

## 19. Unique Key Standards

Unique constraints shall enforce business uniqueness.

### Examples

**Customer**

```text
customer_code
```

**Employee**

```text
employee_code
```

**Vendor**

```text
vendor_code
```

**Invoice**

```text
invoice_number
```

### Composite Unique Examples

```text
company_id + customer_code

company_id + employee_code
```

---

## 20. Constraint Naming Standards

Use standard naming.

### Primary Key

```text
pk_table_name
```

Example

```text
pk_master_customer
```

### Foreign Key

```text
fk_child_parent
```

Example

```text
fk_sales_order_customer
```

### Unique Key

```text
uk_table_column
```

### Check Constraint

```text
ck_table_rule
```

### Default Constraint (if explicitly named)

```text
df_table_column
```

---

## 21. Index Naming Standards

Indexes shall follow standard names.

| Index Type  | Prefix    |
| ----------- | --------- |
| Primary     | pk_       |
| Unique      | ux_       |
| Foreign Key | ix_fk_    |
| Search      | ix_search_ |
| Composite   | ix_comp_  |

### Examples

```text
ix_customer_email

ix_sales_order_date

ix_comp_inventory_branch_product
```

---

## 22. Sequence Standards

Only when UUID is not applicable.

### Format

```text
seq_table_name
```

### Example

```text
seq_invoice_number
```

### Business Number Format

**Invoice**

```text
INV-2026-000001
```

**Purchase Order**

```text
PO-2026-000001
```

**Employee**

```text
EMP-000001
```

---

## 23. Enum Standards

Business statuses should use ENUM only when values are stable.

### Examples

- Status
- Gender
- Approval Status
- Workflow Status

Frequently changing values should use Reference Tables instead.

---

## 24. Data Type Standards

| Data           | PostgreSQL Type   |
| -------------- | ----------------- |
| ID             | UUID              |
| Name           | VARCHAR(255)      |
| Code           | VARCHAR(100)      |
| Description    | TEXT              |
| Amount         | NUMERIC(18,2)     |
| Quantity       | NUMERIC(18,4)     |
| Percentage     | NUMERIC(5,2)      |
| Boolean        | BOOLEAN           |
| Date           | DATE              |
| DateTime       | TIMESTAMPTZ       |
| JSON           | JSONB             |
| Binary/File Ref | VARCHAR(500)     |

### Rules

- Avoid TEXT unless required.
- Use NUMERIC for financial values.
- Use TIMESTAMPTZ instead of TIMESTAMP for timezone-aware records.
- Prefer JSONB over JSON in PostgreSQL for indexing and performance.

---

## 25. UUID Standards

### Version

Recommended:

```text
UUID v7
```

Fallback:

```text
UUID v4
```

### Rules

- Generated by the application layer.
- Never reused.
- Immutable after creation.

---

## 26. SQLAlchemy 2.0 ORM Standards

Since SQLAlchemy 2.0 ORM is selected as the persistence layer:

### Model Naming

```text
class MasterCustomer
```

### Database Table

```text
master_customer
```

Use mapping:

```text
__tablename__ = "master_customer"
```

### Field Mapping

Example

```text
customer_code = mapped_column("customer_code", ...)
```

### Rules

- SQLAlchemy Declarative Model class names: PascalCase
- Database table names: snake_case
- Database columns: snake_case
- Use `__tablename__` and `mapped_column` name mapping consistently.
- Do not expose database naming conventions directly to application code.
- SQLAlchemy models reside in the infrastructure layer only.
- API request/response schemas use Pydantic v2 (per SDD v1.1) and remain separate from ORM models.

---

**PART 2 APPROVAL**

Database Standards are now established for:

| Standard                    | Status |
| --------------------------- | ------ |
| Naming Standards            | ✓      |
| Schema Standards            | ✓      |
| Table Standards             | ✓      |
| Column Standards            | ✓      |
| PK Standards                | ✓      |
| FK Standards                | ✓      |
| Constraint Standards        | ✓      |
| Index Standards             | ✓      |
| Sequence Standards          | ✓      |
| Enum Standards              | ✓      |
| Data Types                  | ✓      |
| UUID Standards              | ✓      |
| SQLAlchemy 2.0 ORM Compatibility    | ✓      |

**ARCHITECT REVIEW**

At this point, the ERP has a fully standardized database naming and design convention. This ensures every future ERD, SQL migration, Alembic migration, SQLAlchemy Declarative Model, and API implementation follows one consistent pattern.

---

# PART 3 - TABLE STANDARDS

---

## 27. Table Classification Framework

### Purpose

Every table in the ERP must belong to exactly one primary classification to ensure consistency in design, governance, retention, security, and lifecycle management.

### Table Categories

| Category      | Prefix   | Purpose                    |
| ------------- | -------- | -------------------------- |
| Master        | master_  | Core business entities     |
| Transaction   | trx_     | Business transactions      |
| Reference     | ref_     | Lookup & static data       |
| Workflow      | wf_      | Approval processes         |
| Audit         | audit_   | Audit logging              |
| History       | hist_    | Historical versions        |
| Configuration | cfg_     | Configurable settings      |
| Integration   | int_     | External integrations      |
| Notification  | ntf_     | Notifications              |
| Analytics     | ana_     | BI & Reporting             |
| Scheduler     | sch_     | Background jobs            |
| Security      | sec_     | Security & Authentication  |

---

## 28. Master Table Standards

### Purpose

Master tables store core business entities.

Examples:

```text
master_customer
master_vendor
master_product
master_employee
master_asset
master_warehouse
```

### Mandatory Columns

```sql
id UUID PRIMARY KEY

tenant_id UUID NOT NULL

company_id UUID NOT NULL

code VARCHAR(100) NOT NULL

name VARCHAR(255) NOT NULL

status VARCHAR(30)

created_at TIMESTAMPTZ

created_by UUID

updated_at TIMESTAMPTZ

updated_by UUID

is_deleted BOOLEAN DEFAULT FALSE

deleted_at TIMESTAMPTZ

deleted_by UUID

version INTEGER DEFAULT 1
```

### Business Rules

- Business code must be unique per company.
- No physical deletion.
- Versioning mandatory.
- Approval required for creation (where applicable).
- Audit logging mandatory.

### Index Strategy

```text
PK(id)

UK(company_id, code)

IX(name)

IX(status)

IX(tenant_id)
```

---

## 29. Transaction Table Standards

### Purpose

Store operational business transactions.

Examples:

```text
trx_sales_order

trx_purchase_order

trx_invoice

trx_payment

trx_inventory_transaction
```

### Mandatory Columns

```sql
id UUID PRIMARY KEY

document_number VARCHAR(50)

document_date DATE

status VARCHAR(30)

workflow_status VARCHAR(30)

tenant_id UUID

company_id UUID

branch_id UUID

created_at TIMESTAMPTZ

created_by UUID

updated_at TIMESTAMPTZ

updated_by UUID

is_deleted BOOLEAN

deleted_at TIMESTAMPTZ

deleted_by UUID

version INTEGER
```

### Business Rules

- Document number immutable after posting.
- Workflow mandatory.
- Full audit required.
- Soft delete only before final posting (configurable by module).

### Standard Child Tables

Example:

```text
trx_sales_order
    │
    └── trx_sales_order_item
```

Header-detail pattern mandatory for all transactional documents.

---

## 30. Reference Table Standards

### Purpose

Store reusable lookup values.

### Examples

```text
ref_country

ref_currency

ref_tax_type

ref_language

ref_uom
```

### Characteristics

- Read-heavy
- Rarely updated
- Globally shared (unless business-specific)

### Business Rules

- No soft delete.
- Prefer `is_active` for deactivation.
- Changes require administrator privileges.

---

## 31. Workflow Table Standards

### Purpose

Support workflow engine.

### Examples

```text
wf_definition

wf_step

wf_instance

wf_task

wf_action
```

### Rules

- Immutable workflow history.
- Every action timestamped.
- Escalations logged.
- Parallel approvals supported.

---

## 32. Audit Table Standards

### Purpose

Record all critical system actions.

### Examples

```text
audit_log

audit_change

audit_session
```

### Mandatory Fields

```sql
entity_name

entity_id

operation

old_value JSONB

new_value JSONB

performed_by

performed_at

ip_address

user_agent
```

### Rules

- Append-only.
- No updates.
- No deletes.
- Retention: 10 years minimum.

---

## 33. History Table Standards

### Purpose

Preserve historical versions.

### Examples

```text
hist_employee

hist_customer

hist_product
```

### Mandatory Fields

```sql
history_id

entity_id

version

effective_from

effective_to

changed_by

changed_at
```

### Rules

- Insert-only.
- Linked to master record.
- Used for SCD Type 2 and compliance.

---

## 34. Configuration Table Standards

### Purpose

Store configurable application settings.

### Examples

```text
cfg_system_setting

cfg_company_setting

cfg_branch_setting
```

### Rules

- Key-value structure where appropriate.
- Version controlled.
- Environment-aware if needed.

---

## 35. Integration Table Standards

### Purpose

Support communication with external systems.

### Examples

```text
int_api_log

int_webhook

int_sync_job

int_import_batch
```

### Mandatory Fields

```sql
integration_name

direction

request_payload JSONB

response_payload JSONB

status

processed_at
```

### Rules

- Payloads stored securely.
- Retry count maintained.
- Sensitive values masked where applicable.

---

## 36. Notification Table Standards

### Purpose

Track system notifications.

### Examples

```text
ntf_notification

ntf_template

ntf_delivery_log
```

### Rules

- Multi-channel support.
- Delivery status tracked.
- Retry mechanism supported.

---

## 37. Analytics Table Standards

### Purpose

Store reporting and warehouse data.

### Examples

```text
ana_fact_sales

ana_fact_inventory

ana_dim_customer

ana_dim_date
```

### Rules

- Read optimized.
- ETL managed.
- Not used for OLTP transactions.

---

## 38. Scheduler Table Standards

### Purpose

Manage background jobs.

### Examples

```text
sch_job

sch_execution

sch_queue
```

### Mandatory Fields

```sql
job_name

schedule

status

started_at

completed_at

duration_ms
```

### Rules

- Job history retained.
- Failed jobs logged.
- Retry policy configurable.

---

## 39. Security Table Standards

### Purpose

Store authentication and authorization data.

### Examples

```text
sec_user

sec_role

sec_permission

sec_session

sec_api_key
```

### Rules

- Passwords never stored in plaintext.
- API keys encrypted.
- Sessions revocable.
- MFA supported.

---

## 40. Standard Table Lifecycle

Every table shall follow the lifecycle below where applicable:

```text
Draft
   │
   ▼
Active
   │
   ▼
Inactive
   │
   ▼
Archived
   │
   ▼
Purged (Only if legally permitted)
```

---

## 41. Common Mandatory Columns Matrix

| Category     | Tenant   | Audit    | Soft Delete | Version  | Workflow |
| ------------ | -------- | -------- | ----------- | -------- | -------- |
| Master       | ✅       | ✅       | ✅          | ✅       | Optional |
| Transaction  | ✅       | ✅       | ✅          | ✅       | ✅       |
| Reference    | Optional | ✅       | ❌          | Optional | ❌       |
| Workflow     | ✅       | ✅       | ❌          | ❌       | Core     |
| Audit        | Optional | N/A      | ❌          | ❌       | ❌       |
| History      | Optional | ✅       | ❌          | ✅       | ❌       |
| Integration  | ✅       | ✅       | Optional    | Optional | ❌       |
| Notification | ✅       | ✅       | Optional    | ❌       | ❌       |
| Analytics    | Optional | ❌       | ❌          | ❌       | ❌       |
| Scheduler    | Optional | ✅       | ❌          | ❌       | ❌       |
| Security     | ✅       | ✅       | Optional    | ❌       | ❌       |

---

## 42. Table Design Checklist

Every new table must satisfy the following before approval:

```text
✅ Naming standards followed
✅ Correct table classification
✅ UUID primary key
✅ Foreign keys defined
✅ Required indexes added
✅ Audit columns included
✅ Soft delete strategy reviewed
✅ Tenant strategy applied
✅ Security classification assigned
✅ Retention policy defined
✅ ERD updated
✅ SQLAlchemy model mapping verified
```

---

**PART 3 APPROVAL**

The iConnect Plus now has standardized templates for every major table category.

These standards shall be mandatory for:

- All ERD volumes
- PostgreSQL schema design
- SQLAlchemy Declarative Models
- Database migrations
- Future modules and extensions

**ARCHITECT REVIEW**

At this stage, the following database foundations are locked:

| Area                      | Status |
| ------------------------- | ------ |
| Database Governance       | ✓      |
| Naming Standards          | ✓      |
| Schema Standards          | ✓      |
| PK/FK Standards           | ✓      |
| Data Type Standards       | ✓      |
| SQLAlchemy Standards          | ✓      |
| Master Table Standards    | ✓      |
| Transaction Table Standards | ✓    |
| Reference Table Standards | ✓      |
| Workflow Standards        | ✓      |
| Audit Standards           | ✓      |
| History Standards         | ✓      |
| Integration Standards     | ✓      |
| Analytics Standards       | ✓      |
| Notification Standards    | ✓      |
| Scheduler Standards       | ✓      |
| Security Standards        | ✓      |

---

# PART 4 - ENTERPRISE DATABASE RULES

---

## 43. Audit Standards

### Purpose

Every business-critical operation must be traceable, reproducible, and attributable to a specific user, process, or system.

### Audit Principles

**AUD-01**

All Create operations must be logged.

**AUD-02**

All Update operations must capture:

- Previous Value
- New Value

**AUD-03**

Delete operations shall be implemented as Soft Delete wherever applicable and logged.

**AUD-04**

All Approval and Rejection actions shall be audited.

**AUD-05**

Authentication and Authorization events shall be audited.

### Auditable Operations

| Operation          | Mandatory |
| ------------------ | --------- |
| Login              | ✅        |
| Logout             | ✅        |
| Create             | ✅        |
| Update             | ✅        |
| Delete (Soft)      | ✅        |
| Approve            | ✅        |
| Reject             | ✅        |
| Export             | ✅        |
| Import             | ✅        |
| Print              | Optional  |
| Workflow Actions   | ✅        |
| Role Changes       | ✅        |
| Permission Changes | ✅        |

### Audit Retention

Minimum:

```text
10 Years
```

Financial Data:

```text
10+ Years
```

Compliance Records:

```text
As Per Regulatory Requirement
```

---

## 44. Standard Audit Columns

Every Master and Transaction table shall include the following:

```sql
created_at TIMESTAMPTZ NOT NULL

created_by UUID NOT NULL

updated_at TIMESTAMPTZ

updated_by UUID

version INTEGER DEFAULT 1
```

### Optional

```sql
approved_at TIMESTAMPTZ

approved_by UUID
```

### Rules

- `created_at` is immutable.
- `created_by` cannot be updated.
- `updated_at` changes automatically.
- `version` increments on every successful update.

---

## 45. Soft Delete Standards

### Purpose

No business-critical data shall be permanently deleted under normal operations.

### Mandatory Columns

```sql
is_deleted BOOLEAN DEFAULT FALSE

deleted_at TIMESTAMPTZ

deleted_by UUID
```

### Rules

**SD-01**

Physical DELETE statements are prohibited on business tables.

**SD-02**

Deleted records shall not appear in normal queries.

**SD-03**

Only administrators may restore deleted records.

**SD-04**

Permanent deletion requires documented approval.

---

## 46. Versioning Standards

Every master entity shall support version tracking.

### Version Columns

```sql
version INTEGER

effective_from TIMESTAMPTZ

effective_to TIMESTAMPTZ
```

### Rules

- Version starts at 1.
- Every approved modification creates a new version where business history is required.
- Historical records remain immutable.

---

## 47. Multi-Tenant Standards

### Tenant Hierarchy

```text
Tenant
 │
 ├── Company
 │
 ├── Branch
 │
 └── Department
```

### Mandatory Columns

```sql
tenant_id UUID

company_id UUID

branch_id UUID
```

### Rules

**MT-01**

Every transactional record belongs to exactly one tenant.

**MT-02**

Cross-tenant joins are prohibited.

**MT-03**

Tenant filtering is mandatory in every repository/service query.

**MT-04**

System administrators may access multiple tenants only through explicit authorization.

---

## 48. Multi-Company Standards

Each company represents an independent legal entity.

### Company Isolation

Every company maintains:

- Chart of Accounts
- Financial Books
- Tax Configuration
- Fiscal Calendar
- Banking Configuration

### Rules

- Company codes must be unique within a tenant.
- Financial transactions cannot cross companies without approved inter-company processes.

---

## 49. Multi-Branch Standards

Each company may have multiple branches.

### Branch Data

Examples:

- Inventory
- Employees
- Sales
- Purchases
- Assets

### Rules

- Branch transactions must reference `branch_id`.
- Inter-branch transfers shall follow dedicated workflows.

---

## 50. Data Ownership Rules

Every table must have three defined owners.

| Owner Type       | Responsibility           |
| ---------------- | ------------------------ |
| Business Owner   | Business rules           |
| Data Steward     | Data quality             |
| Technical Owner  | Schema & performance     |

### Rule

No table may exist without documented ownership.

---

## 51. Referential Integrity Rules

Relationships shall always use Foreign Keys unless explicitly documented.

### Rules

**RI-01**

Orphan records are prohibited.

**RI-02**

Foreign Keys must reference Primary Keys.

**RI-03**

Business relationships shall not rely solely on application logic.

**RI-04**

Every FK should have an appropriate supporting index.

---

## 52. Cascade Rules

The default strategy is:

```text
ON DELETE RESTRICT

ON UPDATE CASCADE
```

### Allowed Cascade Actions

| Action     | Usage                    |
| ---------- | ------------------------ |
| RESTRICT   | Default                  |
| CASCADE    | Reference updates        |
| SET NULL   | Optional relationships   |
| NO ACTION  | Exceptional cases        |

### Rule

ON DELETE CASCADE is not allowed for business transaction tables unless approved by the Architecture Review Board.

---

## 53. JSON Standards

PostgreSQL JSONB shall be used only for semi-structured data.

### Allowed Use Cases

- External API Payloads
- Dynamic Configuration
- Workflow Metadata
- Integration Logs
- Search Filters

### Prohibited Use Cases

- Core Master Data
- Financial Data
- Foreign Key Relationships

### Rules

- Prefer relational modeling first.
- JSONB fields should be indexed only when justified.

---

## 54. File Storage Standards

Files shall not be stored inside PostgreSQL.

### Storage Location

- AWS S3
- MinIO
- Azure Blob Storage
- Other S3-Compatible Object Storage

### Database Stores Only

```text
File Path

Object Key

Checksum

File Size

Content Type

Version

Storage Provider
```

---

## 55. Encryption Standards

### Data in Transit

```text
TLS 1.3
```

### Data at Rest

```text
AES-256
```

### Mandatory Encrypted Data

- Password Hashes (using a strong password hashing algorithm; never reversible encryption)
- Bank Account Numbers
- Tax Identification Numbers
- API Secrets
- OAuth Credentials
- Payment Tokens
- Personal Identifiers where required by policy

### Key Management

- Centralized Secret Management
- Key Rotation Policy
- Least Privilege Access

---

## 56. Security Classification

Every table shall be classified.

| Level        | Description                     |
| ------------ | ------------------------------- |
| Public       | Public information              |
| Internal     | Internal operational data       |
| Confidential | Sensitive business data         |
| Restricted   | Highly sensitive regulated data |

### Examples

| Table          | Classification |
| -------------- | -------------- |
| ref_country    | Public         |
| master_customer | Internal      |
| trx_invoice    | Confidential   |
| trx_payroll    | Restricted     |
| sec_api_key    | Restricted     |

---

## 57. Data Masking Standards

Sensitive information shall be masked in non-production environments.

### Mandatory Masking

- Salary
- Bank Accounts
- PAN / Tax IDs
- Government IDs
- Customer Personal Information
- Employee Personal Information

### Rules

- Production data shall never be copied directly into development environments without masking.
- Test datasets should be synthetic wherever practical.

---

## 58. Data Quality Standards

Every business entity shall satisfy:

- Completeness
- Accuracy
- Consistency
- Uniqueness
- Validity
- Timeliness

### Validation Rules

- Mandatory fields cannot be NULL unless explicitly allowed.
- Business codes must be unique where applicable.
- Foreign key references must exist.
- Enumerated values must be validated.

---

## 59. Database Governance Checklist

Before any new table is approved:

```text
✅ Naming Standards validated
✅ PK/FK Strategy validated
✅ Audit Columns included
✅ Soft Delete reviewed
✅ Security Classification assigned
✅ Tenant Strategy applied
✅ Index Strategy reviewed
✅ Retention Policy defined
✅ ERD updated
✅ SQLAlchemy mapping verified
✅ API impact reviewed
✅ Performance impact reviewed
```

---

**PART 4 APPROVAL**

Enterprise Database Rules are now approved and mandatory for:

- All future ERD volumes
- PostgreSQL schema implementation
- SQLAlchemy Declarative Models
- Database migrations
- API development
- Reporting and Analytics

**ARCHITECT REVIEW**

The following governance capabilities are now locked:

| Area                       | Status |
| -------------------------- | ------ |
| Audit Standards            | ✓      |
| Audit Columns              | ✓      |
| Soft Delete Standards      | ✓      |
| Versioning Standards       | ✓      |
| Multi-Tenant Standards     | ✓      |
| Multi-Company Standards    | ✓      |
| Multi-Branch Standards     | ✓      |
| Data Ownership Rules       | ✓      |
| Referential Integrity Rules | ✓     |
| Cascade Rules              | ✓      |
| JSON Usage Standards       | ✓      |
| File Storage Standards     | ✓      |
| Encryption Standards       | ✓      |
| Security Classification    | ✓      |
| Data Masking Standards     | ✓      |
| Data Quality Standards     | ✓      |
| Governance Checklist       | ✓      |

---

# PART 5 - PERFORMANCE, SCALABILITY & OPERATIONS

---

## 60. Database Performance Principles

### Purpose

Ensure consistent, scalable, and predictable database performance across all ERP modules.

### Performance Goals

| Metric              | Target          |
| ------------------- | --------------- |
| OLTP Query Response | < 200 ms        |
| Standard API Query  | < 500 ms        |
| Dashboard Load      | < 2 sec         |
| Search Response     | < 1 sec         |
| Report Generation   | < 30 sec        |
| Bulk Import         | Configurable    |

### Principles

**PERF-01**

Design indexes based on actual access patterns.

**PERF-02**

Avoid unnecessary joins.

**PERF-03**

Avoid N+1 query problems.

**PERF-04**

Use pagination for large datasets.

**PERF-05**

Archive historical data.

---

## 61. Index Strategy

Indexes shall be created based on business usage.

### Mandatory Indexes

Every business table:

```sql
PRIMARY KEY(id)

INDEX(tenant_id)

INDEX(company_id)

INDEX(created_at)
```

### Common Business Indexes

```text
customer_code

employee_code

document_number

status

workflow_status
```

### Rules

- Every Foreign Key must be indexed.
- Every search field should be evaluated for indexing.
- Avoid duplicate indexes.

---

## 62. Composite Index Strategy

Composite indexes shall support common query patterns.

### Examples

**Customer Search**

```sql
(company_id, customer_code)
```

**Sales Orders**

```sql
(company_id, branch_id, document_date)
```

**Inventory**

```sql
(company_id, warehouse_id, product_id)
```

**Payroll**

```sql
(company_id, payroll_period)
```

### Rules

- Order columns based on query selectivity.
- Validate indexes using execution plans.

---

## 63. Full-Text Search Strategy

### Platform

```text
OpenSearch / Elasticsearch
```

### Indexed Entities

```text
Customers

Employees

Products

Assets

Documents

Tickets

Invoices

Projects
```

### Search Features

- Full-text search
- Prefix search
- Fuzzy search
- Faceted search
- Auto-complete

### Synchronization

Event-driven indexing via Integration/Event Bus.

---

## 64. Query Optimization Standards

### Rules

- Select only required columns.
- Avoid `SELECT *`.
- Use parameterized queries.
- Prefer keyset pagination for very large datasets.
- Limit nested joins where possible.

### ORM Rules (SQLAlchemy 2.0)

- Use `load_only()` instead of fetching full objects.
- Avoid excessive eager loading.
- Batch related queries when appropriate.
- Use SQLAlchemy Session per request via FastAPI dependency injection.

---

## 65. Pagination Standards

Every list API must support pagination.

### Default

```text
Page Size = 25
```

### Maximum

```text
Page Size = 200
```

### Response Metadata

```json
{
  "page": 1,
  "pageSize": 25,
  "totalRecords": 1500,
  "totalPages": 60
}
```

---

## 66. Caching Strategy

### Platform

```text
Redis
```

### Cache Categories

| Data               | Cache    |
| ------------------ | -------- |
| Reference Data     | Yes      |
| Master Data        | Yes      |
| User Permissions   | Yes      |
| System Settings    | Yes      |
| Dashboards         | Yes      |
| Reports            | Optional |

### Do Not Cache

- Financial postings in progress
- Workflow approval state
- Security-sensitive transactions

### Cache Expiration

| Type           | TTL        |
| -------------- | ---------- |
| Reference Data | 24 Hours   |
| Permissions    | 30 Minutes |
| Dashboard      | 5 Minutes  |
| Settings       | 1 Hour     |

---

## 67. Partition Strategy

Partition high-volume tables.

### Candidate Tables

```text
audit_logs

trx_invoice

trx_sales_order

trx_inventory_transaction

trx_payroll

ntf_delivery_log
```

### Partition Type

```text
Range Partitioning
```

### Partition Key

```text
Year
Month
```

### Rules

- New partitions created automatically.
- Old partitions archived according to policy.

---

## 68. Archival Strategy

### Purpose

Reduce active database size.

### Archive Threshold

| Data Type         | Archive After |
| ----------------- | ------------- |
| Audit Logs        | 5 Years       |
| Notifications     | 2 Years       |
| Integration Logs  | 2 Years       |
| Transactions      | Configurable  |
| Reports           | Configurable  |

### Archive Types

- Online Archive
- Offline Archive
- Compliance Archive

### Rules

- Archived data remains searchable where required.
- Archived data is read-only.

---

## 69. Backup Strategy

### Backup Types

- Full Backup
- Incremental Backup
- Transaction Log Backup

### Schedule

| Backup           | Frequency           |
| ---------------- | ------------------- |
| Full             | Daily               |
| Incremental      | Hourly              |
| Transaction Logs | Every 15 Minutes    |

### Rules

- Backup encryption mandatory.
- Backup validation mandatory.
- Restore testing mandatory.

---

## 70. Disaster Recovery Standards

### Recovery Objectives

| Metric | Target     |
| ------ | ---------- |
| RTO    | 4 Hours    |
| RPO    | 15 Minutes |

### DR Components

- Primary Region
- Secondary Region
- Automated Failover
- Read Replicas

### DR Testing

Minimum:

```text
Twice Per Year
```

---

## 71. Database Monitoring Standards

### Monitor

```text
CPU
Memory
Disk
Connections
Slow Queries
Locks
Deadlocks
Replication Lag
Cache Hit Ratio
```

### Alert Thresholds

Configured according to environment.

---

## 72. Performance Optimization Standards

### Review Areas

- Missing indexes
- Unused indexes
- Slow queries
- Table bloat
- Vacuum status
- Analyze statistics

### Maintenance

```text
VACUUM
ANALYZE
REINDEX (when required)
```

---

## 73. Capacity Planning

### Growth Monitoring

Track:

```text
Database Size
Table Growth
Index Growth
Storage Usage
Daily Transactions
Monthly Transactions
```

### Review Frequency

Monthly.

---

## 74. Database Health Checklist

Regular checks:

```text
Index fragmentation
Query performance
Backup success
Replication health
Storage utilization
Connection pool usage
Autovacuum effectiveness
```

---

## 75. Performance Testing Standards

Testing shall include:

- Load Testing
- Stress Testing
- Spike Testing
- Soak Testing

### Test Data

Minimum:

```text
10 Million Transaction Records
1 Million Master Records
Production-like dataset
```

---

## 76. Capacity Targets

The architecture shall support at minimum:

| Metric               | Target        |
| -------------------- | ------------- |
| Users                | 100,000+      |
| Companies            | 1,000+        |
| Branches             | 10,000+       |
| Concurrent Sessions  | 10,000+       |
| Daily Transactions   | 5 Million+    |
| Total Records        | 500 Million+  |

---

## 77. Operational Review Checklist

Before production:

```text
✅ Index review completed
✅ Execution plans reviewed
✅ Backup tested
✅ Restore tested
✅ Replication validated
✅ Partitioning configured
✅ Monitoring enabled
✅ Alerts configured
✅ Performance benchmarks achieved
```

---

**PART 5 APPROVAL**

Performance, Scalability, and Operations standards are approved for all ERP modules.

These standards are mandatory for:

- Database implementation
- SQLAlchemy Declarative Models
- Query development
- Reporting
- Performance testing
- Production deployment

**ARCHITECT REVIEW**

The following operational standards are now locked:

| Area                         | Status |
| ---------------------------- | ------ |
| Performance Principles       | ✓      |
| Index Strategy               | ✓      |
| Composite Index Strategy     | ✓      |
| Full-Text Search Strategy    | ✓      |
| Query Optimization           | ✓      |
| Pagination Standards         | ✓      |
| Redis Caching Strategy       | ✓      |
| Partition Strategy           | ✓      |
| Archival Strategy            | ✓      |
| Backup Standards             | ✓      |
| Disaster Recovery            | ✓      |
| Database Monitoring          | ✓      |
| Performance Optimization     | ✓      |
| Capacity Planning            | ✓      |
| Performance Testing          | ✓      |
| Production Readiness Checklist | ✓    |

---

# PART 6 - DEVELOPMENT GOVERNANCE & DATABASE APPROVAL

---

## 78. SQLAlchemy 2.0 ORM Standards

### Purpose

Ensure a consistent mapping between the PostgreSQL database and the application layer using SQLAlchemy 2.0 ORM (per SDD v1.1 ADR-002).

### Model Naming

```text
SQLAlchemy Declarative Models: PascalCase
Database Tables: snake_case
Database Columns: snake_case
```

Example:

```text
class MasterCustomer(Base):
    __tablename__ = "master_customer"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    customer_code: Mapped[str] = mapped_column("customer_code", ...)
```

### Relationship Standards

- Every relation must explicitly define foreign keys.
- Avoid implicit many-to-many relations for business entities.
- Junction tables must be modeled explicitly.
- Use `relationship()` with explicit `foreign_keys` where ambiguity exists.
- SQLAlchemy Declarative Models reside in the infrastructure layer only; domain layer must not import ORM models.

### Migration Rules

- Never modify production schema manually.
- All schema changes must be generated through Alembic Migrations.
- Every migration must have a meaningful name.
- Alembic revision scripts are version controlled alongside SQLAlchemy models.

Example:

```text
20260715_add_customer_credit_limit
```

---

## 79. Migration Standards

### Rules

Every migration must satisfy:

- Architecture Review
- ERD Updated
- Rollback Strategy
- Backward Compatibility
- Tested on Staging

### Migration Lifecycle

```text
Development
        │
        ▼
Alembic Migration Generated
        │
        ▼
Code Review
        │
        ▼
QA Validation
        │
        ▼
UAT
        │
        ▼
Production Deployment
```

### Rollback Policy

Every migration affecting production must have:

- Rollback Script
- Data Recovery Plan
- Validation Checklist

---

## 80. Seed Data Standards

Seed data should be deterministic and idempotent.

### Seed Categories

| Category           | Mandatory |
| ------------------ | --------- |
| Countries          | ✅        |
| States             | ✅        |
| Currencies         | ✅        |
| Languages          | ✅        |
| UOM                | ✅        |
| Tax Types          | ✅        |
| Roles              | ✅        |
| Permissions        | ✅        |
| Workflow Templates | ✅        |

### Rules

- Business transactional data must never be seeded.
- Seed scripts must be version controlled.
- Seed execution should be repeatable without creating duplicates.

---

## 81. Database Coding Standards

### SQL Standards

- Use parameterized queries.
- Avoid dynamic SQL unless justified.
- Use transactions for multi-step business operations.
- Explicitly handle commit and rollback.

### Naming Standards

- No reserved keywords as table names.
- No abbreviations unless standardized.
- Use descriptive aliases in complex queries.

### Query Standards

- Avoid `SELECT *`.
- Retrieve only required columns.
- Prefer joins over repeated subqueries where appropriate.
- Optimize based on execution plans, not assumptions.

---

## 82. Database Review Checklist

Every database change must pass the following review:

### Design

- ERD updated
- Naming standards followed
- Table classification correct

### Integrity

- PK defined
- FK defined
- Constraints validated

### Performance

- Index strategy reviewed
- Query impact analyzed
- Estimated growth evaluated

### Security

- Security classification assigned
- Sensitive fields encrypted
- Tenant isolation validated

### Governance

- Audit support verified
- Soft delete reviewed
- Retention policy assigned

---

## 83. Database Change Management

All schema changes must be managed through a controlled change process.

### Change Types

| Type     | Approval                    |
| -------- | --------------------------- |
| Minor    | Module Architect            |
| Major    | Solution Architect          |
| Critical | Architecture Review Board   |

### Required Documentation

- Business Justification
- Impact Analysis
- ERD Update
- Migration Plan
- Rollback Plan

---

## 84. Database Versioning Policy

### Version Format

```text
Major.Minor.Patch

1.0.0
```

### Version Rules

**Major**

```text
Structural redesign
```

**Minor**

```text
New tables/features
```

**Patch**

```text
Bug fixes and minor improvements
```

### Database Baseline

Every production deployment must reference an approved baseline version.

---

## 85. Architecture Governance

The database architecture shall be governed by the Enterprise Architecture Review Board (EARB).

### Responsibilities

- Review schema changes
- Approve new modules
- Validate ERDs
- Review performance impacts
- Enforce governance standards

### Architecture Decision Records (ADR)

Any exception to DBS standards requires an ADR including:

- Decision
- Context
- Alternatives Considered
- Impact
- Approval

---

## 86. Exception Management

Exceptions to these standards are permitted only when:

- Technically justified
- Business approved
- Architecturally reviewed
- Documented through ADR

### Rules

- Temporary exceptions must include an expiration date.
- Permanent exceptions require EARB approval.

---

## 87. Database Security Review

Before production deployment:

```text
Access control verified
Encryption verified
Secrets management verified
Backup encryption verified
Audit logging verified
Security testing completed
```

---

## 88. Production Readiness Checklist

Before Go-Live:

### Database

```text
Schema Approved
Migrations Tested
Seed Data Validated
Indexes Optimized
Partitioning Configured
Replication Healthy
```

### Operations

```text
Monitoring Enabled
Alerts Configured
Backup Successful
Restore Tested
Disaster Recovery Tested
```

### Security

```text
Encryption Enabled
RBAC Validated
Tenant Isolation Tested
Audit Logging Enabled
```

### Performance

```text
Load Testing Passed
Stress Testing Passed
Query Benchmarks Met
Capacity Review Completed
```

---

## 89. Appendices

| Appendix   | Content                                 |
| ---------- | --------------------------------------- |
| Appendix A | Standard Master Table Template          |
| Appendix B | Standard Transaction Table Template     |
| Appendix C | Standard Reference Table Template       |
| Appendix D | Standard Workflow Table Template        |
| Appendix E | Standard Audit Table Template           |
| Appendix F | Standard History Table Template         |
| Appendix G | Standard SQLAlchemy Model Template        |
| Appendix H | Standard SQL Migration Template         |
| Appendix I | Standard Index Naming Examples          |
| Appendix J | Common Database Design Patterns         |

### Appendix G - Standard SQLAlchemy Model Template

Every SQLAlchemy Declarative Model must follow this structural template:

```text
class Master{Entity}(Base):
    __tablename__ = "master_{entity}"

    # Primary Key
    id: Mapped[UUID] = mapped_column(primary_key=True)

    # Business Columns (snake_case)
    {entity}_code: Mapped[str] = mapped_column(...)
    {entity}_name: Mapped[str] = mapped_column(...)

    # Tenant Columns (mandatory for transactional entities)
    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("sec_tenant.id"))
    company_id: Mapped[UUID] = mapped_column(ForeignKey("org_company.id"))
    branch_id: Mapped[UUID] = mapped_column(ForeignKey("org_branch.id"))

    # Audit Columns (mandatory)
    created_at: Mapped[datetime] = mapped_column(...)
    created_by: Mapped[UUID] = mapped_column(...)
    updated_at: Mapped[datetime] = mapped_column(...)
    updated_by: Mapped[UUID] = mapped_column(...)
    version: Mapped[int] = mapped_column(...)

    # Soft Delete Columns (mandatory for master/transaction tables)
    is_deleted: Mapped[bool] = mapped_column(default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(...)
    deleted_by: Mapped[UUID | None] = mapped_column(...)
```

Rules:

- Class name: PascalCase with table classification prefix (e.g., `MasterCustomer`, `TrxSalesOrder`).
- `__tablename__` must match the physical PostgreSQL table name exactly.
- All column names use `snake_case` via `mapped_column` name mapping.
- Models are defined in the infrastructure layer (`models.py` per domain module per SDD v1.1).
- API request/response schemas use Pydantic v2 and remain separate from ORM models.

### Appendix J - Common Database Design Patterns

- Header-Detail Pattern
- Junction Table Pattern
- Lookup Table Pattern
- Soft Delete Pattern
- Audit Pattern
- Versioning Pattern
- Event Log Pattern

---

## 90. Final Database Architecture Approval

This document establishes the official Enterprise Database Standards (DBS) baseline for the iConnect Plus.

All future:

- ERDs
- Database Schemas
- SQLAlchemy Declarative Models
- Alembic Migrations
- APIs
- Reports
- Integrations

must comply with this document.

No deviation is permitted without formal architecture approval.

---

**DBS COMPLETION STATUS**

| Part                              | Status |
| --------------------------------- | ------ |
| PART 1 - Database Governance      | ✅     |
| PART 2 - Database Standards       | ✅     |
| PART 3 - Table Standards          | ✅     |
| PART 4 - Enterprise Rules         | ✅     |
| PART 5 - Performance & Operations | ✅     |
| PART 6 - Development Governance   | ✅     |

**FINAL ARCHITECT REVIEW**

The ERP documentation stack is now:

| Document                          | Status      |
| --------------------------------- | ----------- |
| BRD (Business Requirements)       | ✅ Complete |
| FRD (Functional Requirements)     | ✅ Complete |
| SDD (System Design)               | ✅ Complete (v1.1 - ADR-002) |
| DBS (Database Standards)          | ✅ Complete (v1.1) |

**ENTERPRISE READINESS STATUS**

| Deliverable              | Status |
| ------------------------ | ------ |
| Business Architecture    | ✅     |
| Functional Architecture  | ✅     |
| System Architecture      | ✅     |
| Technical Architecture   | ✅     |
| Infrastructure Architecture | ✅  |
| Database Governance      | ✅     |

Estimated Documentation Readiness: ~92-95%

The remaining work is implementation-oriented rather than planning-oriented.

---

# Cross Reference Matrix

This matrix maps each document in the enterprise documentation stack to its area of ownership and responsibility.

```text
Business Requirements
        │
        ▼
BRD (Business Requirements Document)
        │
        ▼
FRD (Functional Requirements Document)
        │
        ▼
SDD (System Design Document)
        │
        ▼
DBS (Enterprise Database Standards)
        │
        ▼
ERD (Enterprise Entity Relationship Diagram)
        │
        ▼
Physical Schema & SQLAlchemy Declarative Models
        │
        ▼
Alembic Migrations
        │
        ▼
API Specifications
        │
        ▼
Development
```

## Document Responsibility Matrix

| Responsibility Area                    | Owned By | Document |
| -------------------------------------- | -------- | -------- |
| Business Goals & Objectives            | Business | BRD      |
| Business Processes & Use Cases         | Business | BRD      |
| Business Rules                         | Business | BRD      |
| Stakeholder Requirements               | Business | BRD      |
| Functional Behaviour                   | Solution | FRD      |
| Module Functional Specifications       | Solution | FRD      |
| Screen & Workflow Functional Design    | Solution | FRD      |
| Functional Acceptance Criteria         | Solution | FRD      |
| Enterprise Architecture                | Architecture | SDD  |
| Application Architecture               | Architecture | SDD  |
| Technical Architecture                 | Architecture | SDD  |
| Infrastructure Architecture            | Architecture | SDD  |
| Technology Stack Selection             | Architecture | SDD  |
| Non-Functional Requirements            | Architecture | SDD  |
| DevOps & CI/CD Architecture            | Architecture | SDD  |
| Security Architecture                  | Architecture | SDD  |
| Database Naming Standards              | Database | DBS      |
| Table Classification & Design          | Database | DBS      |
| PK/FK Strategy                         | Database | DBS      |
| Audit Column Standards                 | Database | DBS      |
| Soft Delete Standards                  | Database | DBS      |
| Multi-Tenant Data Rules                | Database | DBS      |
| Data Security & Encryption Rules       | Database | DBS      |
| Database Performance Standards         | Database | DBS      |
| Indexing Strategy                      | Database | DBS      |
| Partitioning & Archival                | Database | DBS      |
| Backup & Disaster Recovery (DB Level)  | Database | DBS      |
| SQLAlchemy 2.0 ORM Mapping Standards   | Database | DBS      |
| Migration Governance                   | Database | DBS      |
| Data Quality Standards                 | Database | DBS      |
| Database Change Management             | Database | DBS      |
| Database Versioning Policy             | Database | DBS      |
| Exception Management (DB Level)        | Database | DBS      |
| Entity Relationship Diagrams           | Data Design | ERD   |
| Physical Schema Design                 | Data Design | ERD   |
| Table-Level Business Logic             | Development | Code |
| API Implementation                     | Development | Code |

---

## Cross-Document Dependency Rules

| If a change is made in... | Then these documents must be reviewed... |
| ------------------------- | ---------------------------------------- |
| BRD                       | FRD, SDD, DBS, ERD                       |
| FRD                       | SDD, DBS, ERD                            |
| SDD                       | DBS, ERD, API Specifications             |
| DBS                       | ERD, SQLAlchemy Declarative Models, Alembic Migrations, API Specifications |
| ERD                       | SQLAlchemy Declarative Models, Alembic Migrations, API Specifications      |

---

# Database Governance Summary

This section provides a consolidated summary of all approved enterprise database standards. It serves as a quick reference for architects, developers, and reviewers. The detailed standards above remain authoritative and unchanged.

---

## Naming Standards Summary

- All database objects use `snake_case`.
- Only lowercase letters are permitted.
- No spaces, no abbreviations unless standardized.
- Table prefixes are mandatory: `master_`, `trx_`, `ref_`, `audit_`, `hist_`, `wf_`, `cfg_`, `int_`, `ana_`, `ntf_`, `sch_`, `sec_`.
- Schema names map to business domains (e.g., `finance`, `hr`, `inventory`).
- Constraint naming follows patterns: `pk_`, `fk_`, `uk_`, `ck_`, `df_`.
- Index naming follows patterns: `pk_`, `ux_`, `ix_fk_`, `ix_search_`, `ix_comp_`.
- SQLAlchemy Declarative Model class names use PascalCase; database table and column names use snake_case.

---

## Table Standards Summary

- Every table belongs to exactly one classification category.
- Master tables store core business entities and require UUID PK, tenant columns, audit columns, soft delete columns, and versioning.
- Transaction tables store operational data and require document number, workflow status, header-detail pattern, and full audit.
- Reference tables are read-heavy, globally shared, and use `is_active` instead of soft delete.
- Audit tables are append-only with a minimum 10-year retention.
- History tables support SCD Type 2 with insert-only policy.
- All table types have defined mandatory column profiles per the Common Mandatory Columns Matrix.

---

## PK/FK Standards Summary

- Every table uses `UUID` as primary key (`UUID v7` recommended, `UUID v4` as fallback).
- UUIDs are generated by the application layer and are immutable after creation.
- Every foreign key references a primary key.
- Orphan records are prohibited.
- Every FK must be indexed.
- Cascade strategy defaults to `ON DELETE RESTRICT` / `ON UPDATE CASCADE`.
- `ON DELETE CASCADE` is prohibited on business transaction tables without EARB approval.

---

## Audit Standards Summary

- All Create, Update, Soft Delete, Approve, Reject, Export, Import, Login, Logout, Role Change, and Permission Change operations are auditable.
- Every master and transaction table includes: `created_at`, `created_by`, `updated_at`, `updated_by`, `version`.
- `created_at` and `created_by` are immutable.
- `version` increments on every successful update.
- Audit log retention minimum is 10 years; financial data 10+ years.
- Audit tables are append-only with no updates or deletes.

---

## Soft Delete Standards Summary

- Physical `DELETE` statements are prohibited on all business tables.
- Soft delete columns are mandatory: `is_deleted BOOLEAN DEFAULT FALSE`, `deleted_at TIMESTAMPTZ`, `deleted_by UUID`.
- Deleted records must not appear in normal queries.
- Only administrators may restore deleted records.
- Permanent deletion requires documented approval.

---

## Multi-Tenant Standards Summary

- Tenant hierarchy: Tenant → Company → Branch → Department.
- Every transactional table must include: `tenant_id`, `company_id`, `branch_id`.
- Cross-tenant joins are strictly prohibited.
- Tenant filtering is mandatory in every repository and service query.
- Each company maintains independent Chart of Accounts, Financial Books, Tax Configuration, Fiscal Calendar, and Banking Configuration.
- Inter-branch transfers follow dedicated workflows.

---

## Security Standards Summary

- Every table is assigned a security classification: Public, Internal, Confidential, or Restricted.
- Data in transit is protected by TLS 1.3.
- Data at rest is protected by AES-256.
- Mandatory encrypted fields: password hashes, bank account numbers, tax IDs, API secrets, OAuth credentials, payment tokens, and applicable personal identifiers.
- Centralized key management with key rotation policy and least privilege access.
- Production data must never be copied to non-production environments without masking.
- Sensitive fields in non-production are masked: salary, bank accounts, PAN/Tax IDs, government IDs, customer and employee personal data.
- Passwords are never stored in plaintext; API keys are encrypted; sessions are revocable.

---

## Performance Standards Summary

- OLTP query response target: < 200 ms.
- Standard API query target: < 500 ms.
- Dashboard load target: < 2 seconds.
- Search response target: < 1 second.
- Report generation target: < 30 seconds.
- Every business table requires indexes on: `id` (PK), `tenant_id`, `company_id`, `created_at`.
- Every FK must be indexed.
- Composite indexes designed by query selectivity.
- `SELECT *` is prohibited; only required columns may be selected.
- Pagination is mandatory for all list APIs (default page size 25, maximum 200).
- Redis caching is applied to reference data, master data, permissions, settings, and dashboards.
- High-volume tables are partitioned by Year/Month using range partitioning.
- Architecture targets: 100,000+ users, 1,000+ companies, 10,000+ branches, 5 million+ daily transactions, 500 million+ total records.

---

## Migration Standards Summary

- All schema changes are managed through Alembic Migrations - no manual production schema changes.
- Every migration requires: architecture review, ERD update, rollback strategy, backward compatibility validation, and staging test.
- Migration lifecycle: Development → Alembic Migration Generated → Code Review → QA Validation → UAT → Production Deployment.
- Every production migration must include a rollback script, data recovery plan, and validation checklist.
- Seed data must be deterministic, idempotent, and version controlled.
- Business transactional data must never be seeded.
- Database versioning follows `Major.Minor.Patch` format.

---

## Governance Standards Summary

- The Enterprise Architecture Review Board (EARB) governs all database architecture decisions.
- Every table must have a documented Business Owner, Data Steward, and Technical Owner.
- No new table may be added without completing the full governance checklist.
- All exceptions to DBS standards require a formal Architecture Decision Record (ADR).
- Temporary exceptions must carry an expiration date; permanent exceptions require EARB approval.
- Database change types are classified as Minor (Module Architect approval), Major (Solution Architect approval), or Critical (EARB approval).
- Quarterly review cycle is mandatory for this document.
- All ERP database objects must comply with DBS, SDD, FRD, and BRD in that hierarchy.

---

# Enterprise Database Readiness

| Document                                    | Status      |
| ------------------------------------------- | ----------- |
| BRD - Business Requirements Document        | ✓ Complete  |
| FRD - Functional Requirements Document      | ✓ Complete  |
| SDD - System Design Document (All Volumes)  | ✓ Complete (v1.1 - ADR-002) |
| DBS - Enterprise Database Standards         | ✓ Complete (v1.1) |

---

# Next Phase

```text
Enterprise ERD
        │
        ▼
Physical Database Schema
        │
        ▼
SQLAlchemy Models
        │
        ▼
Alembic Migrations
        │
        ▼
API Specifications
        │
        ▼
Development
```

## Next Phase Activity Detail

| Phase | Activity                    | Description                                                                          |
| ----- | --------------------------- | ------------------------------------------------------------------------------------ |
| 1     | Enterprise ERD              | Design complete entity relationship diagrams for all domains per DBS standards       |
| 2     | Physical Database Schema    | Define all PostgreSQL table schemas, indexes, and constraints per DBS naming rules   |
| 3     | SQLAlchemy Models           | Implement SQLAlchemy Declarative Models with correct `__tablename__` and `mapped_column` per DBS ORM standards |
| 4     | Alembic Migrations          | Generate and validate Alembic migration scripts for all schema changes per DBS migration governance            |
| 5     | API Specifications          | Produce full OpenAPI specifications for all modules aligned with SDD v1.1 and DBS                              |
| 6     | Development                 | Implement domain by domain with continuous DBS compliance verification                                         |

---

*End of Enterprise Database Standards (DBS) - iConnect Plus - Version 1.1*
