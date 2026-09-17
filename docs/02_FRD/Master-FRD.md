# MASTER FUNCTIONAL REQUIREMENTS DOCUMENT (FRD)
## Connect Plus - Consolidated Master FRD

**Version:** 1.0
**Status:** Architecture Approved (All 22 Domains Locked)

This Master FRD consolidates all 22 domain-level Functional Requirements Documents (FRD-01 through FRD-22) covering the complete Connect Plus architecture. Content within each domain section is preserved exactly as approved in the corresponding standalone module FRD file. Each module is also available as a separate file in the `modules/` folder, cross-referenced below.

---

## TABLE OF CONTENTS

- [FRD-01 Foundation Domain (Architecture Freeze)](#frd-01-foundation-domain-architecture-freeze)
- [FRD-02 Organization Domain](#frd-02-organization-domain)
- [FRD-03 Master Data Domain](#frd-03-master-data-domain)
- [FRD-04 Finance & Accounting Domain](#frd-04-finance-accounting-domain)
- [FRD-05 CRM Domain](#frd-05-crm-domain)
- [FRD-06 Sales Domain](#frd-06-sales-domain)
- [FRD-07 Procurement Domain](#frd-07-procurement-domain)
- [FRD-08 Inventory & Warehouse Domain](#frd-08-inventory-warehouse-domain)
- [FRD-09 Human Resource (HR) Domain](#frd-09-human-resource-hr-domain)
- [FRD-10 Payroll Domain](#frd-10-payroll-domain)
- [FRD-11 Project Management Domain](#frd-11-project-management-domain)
- [FRD-12 Asset Management Domain](#frd-12-asset-management-domain)
- [FRD-13 Manufacturing Domain](#frd-13-manufacturing-domain)
- [FRD-14 Quality Management Domain](#frd-14-quality-management-domain)
- [FRD-15 Supply Chain Management (SCM) Domain](#frd-15-supply-chain-management-scm-domain)
- [FRD-16 Service Management Domain](#frd-16-service-management-domain)
- [FRD-17 Helpdesk & Customer Support Domain](#frd-17-helpdesk-customer-support-domain)
- [FRD-18 Business Intelligence (BI), Reporting & Analytics Domain](#frd-18-business-intelligence-bi-reporting-analytics-domain)
- [FRD-19 Document Management System (DMS) Domain](#frd-19-document-management-system-dms-domain)
- [FRD-20 Compliance, Risk Management & Governance Domain](#frd-20-compliance-risk-management-governance-domain)
- [FRD-21 Integration Hub & Enterprise Platform Services](#frd-21-integration-hub-enterprise-platform-services)
- [FRD-22 E-Commerce & External Channel Integration Domain](#frd-22-e-commerce-external-channel-integration-domain)

---

## ENTERPRISE DEPENDENCY CHAIN (GLOBAL)

```
Foundation (FRD-01)
↓
Organization (FRD-02)
↓
Master Data (FRD-03)
↓
┌─────────────┬─────────────┬──────────────┬───────────────┬─────────────┐
Finance(04)   CRM(05)       Procurement(07) HR(09)         Integration Hub(21)
↓             ↓             ↓               ↓               ↓
Sales(06)     Sales(06)     Inventory(08)   Payroll(10)     E-Commerce(22)
↓                           ↓               ↓
Finance(04)                 Manufacturing(13) Projects(11)
                            ↓               ↓
                            Quality(14)      Assets(12)
                            ↓               ↓
                            SCM(15)          Finance(04)
                                             ↓
                                             Service Mgmt(16) ← Helpdesk(17)
                                             ↓
                                             Finance(04)

Cross-Cutting Layers: BI & Analytics (18), DMS (19), GRC (20) - consume/serve all domains above.
```

---

## FRD-01 Foundation Domain (Architecture Freeze)

### Version
1.0

### Status
Architecture Approved

### Cross References
- Downstream dependency: [FRD-02 Organization Domain](./FRD-02-Organization-Domain.md)
- Referenced by all modules for Authentication, Authorization, RBAC, Workflow, Notification, and Audit services.
- Related platform backbone: [FRD-21 Integration Hub & Enterprise Platform Services](./FRD-21-Integration-Hub-Enterprise-Platform-Services.md)

### Purpose

Foundation Domain ERP ke sabhi modules ke liye centralized platform services provide karega.

Ye domain provide karega:

- Authentication
- Authorization
- User Management
- Role Management
- Permission Management
- Organization Context
- Workflow Engine
- Notification Engine
- Audit Engine
- Global Settings

### FOUNDATION MODULE BREAKDOWN

```
Foundation Domain

├── Authentication
├── Session Management
├── User Management
├── Role Management
├── Permission Management
├── RBAC Engine
├── Organization Context
├── Workflow Engine
├── Notification Engine
├── Audit Engine
└── Settings Management
```

### USER TYPES

#### Super Admin

Access:

- Entire ERP
- Multi Company
- All Settings

#### Company Admin

Access:

- Company Level

Cannot:

- Access Other Companies

#### Branch Admin

Access:

- Branch Level

Cannot:

- Access Other Branches

#### Manager

Department Specific Access

#### Employee

Self Service Access

### AUTHENTICATION MODULE

#### Purpose

Secure user access.

#### Login Screen

##### Fields

| Field | Type | Required |
|---|---|---|
| Email | Email | Yes |
| Password | Password | Yes |

##### Actions

- Login
- Forgot Password

##### Validation Rules

Email:

- Must be valid email format

Password:

- Minimum 8 characters
- At least:
  - 1 Uppercase
  - 1 Lowercase
  - 1 Number
  - 1 Special Character

#### MFA Screen

##### Fields

| Field | Type |
|---|---|
| OTP | Numeric |

Length:

- 6 Digits

Expiry:

- 5 Minutes

#### Authentication Flow

```
Email
Password
↓
Validate
↓
MFA
↓
Generate Access Token
↓
Dashboard
```

### SESSION MANAGEMENT

#### Requirements

Track:

- Login Time
- Logout Time
- Device
- Browser
- IP Address

#### Session Timeout

30 Minutes Inactivity

#### Concurrent Sessions

Configurable:

- Single Session
- OR
- Multiple Sessions

### USER MANAGEMENT MODULE

#### Screen Inventory

- User List
- User Create
- User Edit
- User Details
- User Deactivate
- User Reset Password

#### User Create Fields

| Field | Required |
|---|---|
| Employee | Yes |
| Email | Yes |
| Username | Yes |
| Role | Yes |
| Company | Yes |
| Branch | Yes |
| Status | Yes |

#### User Status

- Active
- Inactive
- Locked
- Pending Activation

### ROLE MANAGEMENT

#### Screen Inventory

- Role List
- Role Create
- Role Edit
- Role Clone
- Role Archive

#### Role Fields

| Field |
|---|
| Role Name |
| Description |
| Role Type |

#### Role Types

- System Role
- Business Role
- Custom Role

### PERMISSION MANAGEMENT

#### Permission Levels

##### Level 1

Module

Example:

- Finance
- HR
- Sales

##### Level 2

Screen

Example:

- Sales Order
- Invoice
- Customer

##### Level 3

Action

- View
- Create
- Edit
- Delete
- Approve
- Export
- Print

##### Level 4

Data Scope

- Own Records
- Department
- Branch
- Company
- Global

### RBAC ENGINE

#### Permission Formula

```
User
↓
Role
↓
Permissions
↓
Data Scope
```

#### Access Evaluation

Example:

HR Manager

Can View:
- Employees

Can Edit:
- Employees

Cannot Delete:
- Employees

### ORGANIZATION CONTEXT

#### Context Levels

- Tenant
- Company
- Branch
- Department

#### Mandatory Filters

Every Business Record Must Contain:

- tenant_id
- company_id
- branch_id
- created_by
- created_at

### WORKFLOW ENGINE

#### Purpose

Dynamic Approval Management

#### Workflow Builder

Admin can create:

- Approval Levels
- Conditions
- Escalations
- Notifications

Without coding.

#### Workflow States

- Draft
- Submitted
- Under Review
- Approved
- Rejected
- Cancelled

#### Example Workflow

Purchase Request

```
Employee
↓
Manager
↓
Finance
↓
Procurement
↓
Approved
```

#### Escalation

Rule:

If no action within 48 hours

Escalate

### NOTIFICATION ENGINE

#### Channels

- Email
- SMS
- WhatsApp
- In-App

#### Notification Types

- Approval Request
- Approval Granted
- Approval Rejected
- Password Reset
- Inventory Alert
- Payroll Generated

#### Template Management

Templates support:

- Variables
- Conditions
- Localization

Example:

Hello {{EmployeeName}}

Your Leave Request has been approved.

### AUDIT ENGINE

#### Purpose

Track all critical changes.

#### Audit Events

- Create
- Update
- Delete
- Approve
- Reject
- Login
- Logout

#### Audit Fields

| Field |
|---|
| User |
| Module |
| Record ID |
| Action |
| Old Value |
| New Value |
| IP Address |
| Timestamp |

#### Retention

7 Years

Minimum.

### SETTINGS MANAGEMENT

#### Categories

##### Company Settings
- Company Name
- Branding
- Logo

##### Localization
- Language
- Currency
- Timezone

##### Security
- Password Policy
- MFA Policy

##### Email
- SMTP Configuration

##### Notifications
- SMS Providers
- WhatsApp Providers

### FOUNDATION DATABASE TABLES

#### Core Tables

- users
- roles
- permissions
- role_permissions
- user_roles
- sessions
- mfa_codes
- workflows
- workflow_steps
- workflow_conditions
- notifications
- notification_templates
- audit_logs
- settings
- companies
- branches
- departments

### API MODULES

#### Authentication APIs

```
POST /api/v1/auth/login

POST /api/v1/auth/logout

POST /api/v1/auth/mfa

POST /api/v1/auth/forgot-password

POST /api/v1/auth/reset-password
```

#### User APIs

```
GET /api/v1/users

POST /api/v1/users

PUT /api/v1/users/{id}

DELETE /api/v1/users/{id}
```

#### Role APIs

```
GET /api/v1/roles

POST /api/v1/roles

PUT /api/v1/roles/{id}
```

#### Workflow APIs

```
GET /api/v1/workflows

POST /api/v1/workflows

PUT /api/v1/workflows/{id}
```

### SECURITY REQUIREMENTS

Mandatory:

- JWT Access Token
- Refresh Token
- MFA
- Password Hashing
- Rate Limiting
- CSRF Protection
- XSS Protection
- SQL Injection Protection

### ACCEPTANCE CRITERIA

Foundation Module shall be accepted when:

✅ Users can authenticate securely

✅ MFA works successfully

✅ Roles and permissions are enforced

✅ Workflow engine supports dynamic approvals

✅ Notifications are delivered

✅ Audit logs are generated

✅ Organization isolation is enforced

✅ Security testing is passed

✅ UAT sign-off is completed

### UAT TEST SCENARIOS

#### UAT-001

Login with valid credentials

Expected:

User logged in successfully

#### UAT-002

Login with invalid password

Expected:

Authentication failed

#### UAT-003

Role without permission accesses module

Expected:

Access denied

#### UAT-004

Approval workflow escalation

Expected:

Escalation triggered after configured duration

#### UAT-005

Audit log generation

Expected:

Action recorded in audit log

### Architect Review

FRD-01 is now sufficient to begin:

- Authentication Development
- RBAC Development
- Workflow Engine Development
- Notification Engine Development
- Audit Engine Development


---

## FRD-02 Organization Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Upstream dependency: [FRD-01 Foundation Domain](./FRD-01-Foundation-Domain.md)
- Downstream dependency: [FRD-03 Master Data Domain](./FRD-03-Master-Data-Domain.md)

### 1. PURPOSE

Organization Domain ERP ki legal, operational aur reporting hierarchy define karega.

Ye domain define karega:

```
Tenant
↓
Company
↓
Branch
↓
Business Unit
↓
Department
↓
Cost Center
↓
Profit Center
```

ERP ke saare modules isi structure ko reference karenge.

### 2. BUSINESS OBJECTIVES

System shall:

- Support Multi-Tenant Architecture
- Support Multi-Company Operations
- Support Multi-Branch Operations
- Support Multi-Department Operations
- Support Cost Allocation
- Support Profitability Analysis
- Support Organizational Reporting

### 3. ORGANIZATION HIERARCHY

#### Level 1

Tenant

Example:

Tenant: ABC Group

#### Level 2

Company

Examples:

- ABC India Pvt Ltd
- ABC UAE LLC

#### Level 3

Branch

Examples:

- Delhi
- Mumbai
- Bangalore
- Dubai

#### Level 4

Business Unit

Examples:

- Manufacturing
- Retail
- Services

#### Level 5

Department

Examples:

- Finance
- HR
- Sales
- Operations

#### Level 6

Cost Center

Examples:

- Sales Delhi
- HR Corporate
- Production Unit 1

#### Level 7

Profit Center

Examples:

- Retail Division
- Manufacturing Division

### 4. SCREEN INVENTORY

- Company List
- Company Create
- Company Details
- Branch List
- Branch Create
- Branch Details
- Business Unit List
- Business Unit Create
- Department List
- Department Create
- Cost Center List
- Cost Center Create
- Profit Center List
- Profit Center Create
- Organization Tree View

### 5. COMPANY MANAGEMENT

#### Company Create Screen

##### Fields

| Field | Mandatory |
|---|---|
| Company Name | Yes |
| Company Code | Yes |
| Legal Name | Yes |
| Registration Number | Yes |
| Tax Number | Yes |
| Country | Yes |
| Base Currency | Yes |
| Timezone | Yes |
| Status | Yes |

##### Validation Rules

Company Code

Must be:

- Unique Across Tenant

Tax Number

Must be:

- Unique Per Country

##### Status Values

- Active
- Inactive
- Archived

### 6. BRANCH MANAGEMENT

#### Branch Create

##### Fields

| Field | Mandatory |
|---|---|
| Company | Yes |
| Branch Name | Yes |
| Branch Code | Yes |
| Address | Yes |
| Country | Yes |
| State | Yes |
| City | Yes |
| Status | Yes |

##### Business Rules

Every branch must belong to:

- One Company

### 7. BUSINESS UNIT MANAGEMENT

#### Fields

| Field |
|---|
| Business Unit Name |
| Business Unit Code |
| Description |
| Company |

#### Examples

- Retail
- Manufacturing
- Services
- Wholesale

### 8. DEPARTMENT MANAGEMENT

#### Fields

| Field |
|---|
| Department Name |
| Department Code |
| Department Head |
| Company |
| Branch |

#### Examples

- Finance
- Human Resources
- Sales
- Operations
- IT

### 9. COST CENTER MANAGEMENT

#### Purpose

Track expenses and budgets.

#### Fields

| Field |
|---|
| Cost Center Name |
| Cost Center Code |
| Department |
| Branch |
| Manager |

#### Referenced By

- Finance
- Payroll
- Projects
- Procurement

### 10. PROFIT CENTER MANAGEMENT

#### Purpose

Track profitability.

#### Fields

| Field |
|---|
| Profit Center Name |
| Profit Center Code |
| Business Unit |
| Branch |

#### Referenced By

- Finance
- Sales
- Projects

### 11. ORGANIZATION TREE VIEW

#### Purpose

Visual hierarchy management.

Example:

```
ABC Group
│
├── ABC India
│   ├── Delhi
│   │   ├── Finance
│   │   ├── HR
│   │
│   ├── Mumbai
│
├── ABC UAE
│   ├── Dubai
```

### 12. DATA OWNERSHIP RULES

Every business record shall contain:

- tenant_id
- company_id
- branch_id
- created_by
- updated_by

Mandatory.

### 13. PERMISSION MODEL

#### Super Admin

Full Access

#### Company Admin

Access:

- Own Company Only

#### Branch Admin

Access:

- Own Branch Only

#### Department Manager

Access:

- Own Department Only

### 14. WORKFLOWS

#### Company Creation Workflow

```
Draft
↓
Review
↓
Approved
↓
Active
```

#### Branch Creation Workflow

```
Draft
↓
Approval
↓
Active
```

### 15. NOTIFICATIONS

Events:

- Company Created
- Branch Created
- Department Updated
- Cost Center Created

Channels:

- Email
- In-App

### 16. AUDIT REQUIREMENTS

Track:

- Create
- Update
- Delete
- Activate
- Deactivate

For:

- Companies
- Branches
- Departments
- Cost Centers
- Profit Centers

### 17. DATABASE TABLES

- tenants
- companies
- branches
- business_units
- departments
- cost_centers
- profit_centers
- organization_settings

### 18. KEY RELATIONSHIPS

```
Tenant
1 → N Companies

Company
1 → N Branches

Branch
1 → N Departments

Department
1 → N Cost Centers

Business Unit
1 → N Profit Centers
```

### 19. API SPECIFICATIONS

#### Company APIs

```
GET /api/v1/companies

POST /api/v1/companies

PUT /api/v1/companies/{id}

DELETE /api/v1/companies/{id}
```

#### Branch APIs

```
GET /api/v1/branches

POST /api/v1/branches

PUT /api/v1/branches/{id}
```

#### Department APIs

```
GET /api/v1/departments

POST /api/v1/departments

PUT /api/v1/departments/{id}
```

### 20. REPORTS

#### Organization Reports

- Company Report
- Branch Report
- Department Report
- Cost Center Report
- Profit Center Report

### 21. ACCEPTANCE CRITERIA

✅ Multi-company works

✅ Multi-branch works

✅ Organization hierarchy enforced

✅ Data isolation enforced

✅ Permission scope enforced

✅ Audit logs generated

✅ Reports generated successfully

### 22. UAT SCENARIOS

#### UAT-001

Create Company

Expected:

Company created successfully

#### UAT-002

Create Branch

Expected:

Branch linked to company

#### UAT-003

Branch Admin accesses another branch

Expected:

Access Denied

#### UAT-004

Organization Tree loads

Expected:

Hierarchy displayed correctly

### Architect Review

FRD-02 Organization Domain is now locked.

#### Dependency Chain

```
Foundation
↓
Organization
↓
Master Data
↓
Finance
HR
CRM
Sales
Inventory
```


---

## FRD-03 Master Data Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Upstream dependency: [FRD-02 Organization Domain](./FRD-02-Organization-Domain.md)
- Downstream dependencies: [FRD-04 Finance & Accounting Domain](./FRD-04-Finance-Accounting-Domain.md), [FRD-05 CRM Domain](./FRD-05-CRM-Domain.md), [FRD-06 Sales Domain](./FRD-06-Sales-Domain.md), [FRD-07 Procurement Domain](./FRD-07-Procurement-Domain.md), [FRD-08 Inventory & Warehouse Domain](./FRD-08-Inventory-Warehouse-Domain.md), [FRD-13 Manufacturing Domain](./FRD-13-Manufacturing-Domain.md)

### 1. PURPOSE

Master Data Domain ERP ke core business entities ko manage karega.

Ye domain ensure karega:

- Single Source of Truth
- Standardized Data
- Data Reusability
- Cross Module Consistency
- Reporting Accuracy

### 2. MODULES COVERED

- Employee Master
- Customer Master
- Vendor Master
- Product Master
- Warehouse Master
- Asset Master
- Tax Master
- Currency Master
- UOM Master

### 3. MASTER DATA GOVERNANCE RULES

#### Rule 1

Master Data centrally maintained hoga.

#### Rule 2

Duplicate records allowed nahi honge.

#### Rule 3

Every master record must have:

- tenant_id
- company_id
- status
- created_by
- created_at
- updated_by
- updated_at

#### Rule 4

Soft Delete Only

Delete
=
Archive

Actual delete prohibited.

### 4. EMPLOYEE MASTER

#### Purpose

Central employee repository.

#### Referenced By:

- HR
- Payroll
- Projects
- Assets
- Helpdesk
- Workflow Engine

#### Employee Create Fields

| Field | Mandatory |
|---|---|
| Employee Code | Yes |
| First Name | Yes |
| Last Name | Yes |
| Email | Yes |
| Mobile | Yes |
| Company | Yes |
| Branch | Yes |
| Department | Yes |
| Designation | Yes |
| Reporting Manager | No |
| Date of Joining | Yes |
| Status | Yes |

#### Employee Status

- Draft
- Active
- On Leave
- Resigned
- Terminated

#### Employee Code Format

```
EMP-000001
```

Auto Generated

### 5. CUSTOMER MASTER

#### Purpose

Maintain all customers.

#### Referenced By:

- CRM
- Sales
- Finance
- Helpdesk

#### Fields

| Field | Mandatory |
|---|---|
| Customer Code | Yes |
| Customer Name | Yes |
| Customer Type | Yes |
| Tax Number | No |
| Email | No |
| Mobile | No |
| Billing Address | Yes |
| Shipping Address | No |
| Credit Limit | No |
| Status | Yes |

#### Customer Types

- Individual
- Corporate
- Government

#### Customer Code

```
CUS-000001
```

### 6. VENDOR MASTER

#### Purpose

Supplier Management

#### Referenced By:

- Procurement
- Inventory
- Finance

#### Fields

| Field |
|---|
| Vendor Code |
| Vendor Name |
| Tax Number |
| Contact Person |
| Mobile |
| Email |
| Payment Terms |
| Status |

#### Vendor Code

```
VEN-000001
```

### 7. PRODUCT MASTER

#### Purpose

Central product catalog.

Most critical master.

#### Referenced By:

- Sales
- Procurement
- Inventory
- Manufacturing
- Projects

#### Fields

| Field |
|---|
| Product Code |
| Product Name |
| Category |
| UOM |
| Tax Category |
| Cost Price |
| Selling Price |
| Barcode |
| Status |

#### Product Types

- Inventory Item
- Service
- Raw Material
- Finished Good
- Consumable

#### Product Code

```
PRD-000001
```

### 8. WAREHOUSE MASTER

#### Purpose

Manage storage locations.

#### Referenced By:

- Inventory
- SCM
- Manufacturing

#### Fields

| Field |
|---|
| Warehouse Code |
| Warehouse Name |
| Branch |
| Address |
| Capacity |
| Status |

#### Warehouse Code

```
WH-000001
```

### 9. ASSET MASTER

#### Purpose

Manage company assets.

#### Referenced By:

- Asset Management
- Finance
- HR

#### Fields

| Field |
|---|
| Asset Code |
| Asset Name |
| Asset Type |
| Purchase Date |
| Purchase Cost |
| Assigned Employee |
| Status |

#### Asset Code

```
AST-000001
```

### 10. TAX MASTER

#### Purpose

Central tax configuration.

#### Referenced By:

- Sales
- Finance
- Procurement

#### Tax Types

- GST
- VAT
- TDS
- Service Tax

#### Fields

| Field |
|---|
| Tax Code |
| Tax Name |
| Tax Rate |
| Effective Date |
| Status |

### 11. CURRENCY MASTER

#### Purpose

Multi-currency support.

#### Fields

| Field |
|---|
| Currency Code |
| Currency Name |
| Symbol |
| Exchange Rate |
| Status |

#### Examples

- INR
- USD
- EUR
- AED

### 12. UOM MASTER

#### Purpose

Standard measurement units.

#### Fields

| Field |
|---|
| UOM Code |
| UOM Name |
| Decimal Precision |
| Status |

#### Examples

- KG
- LTR
- PCS
- BOX
- MTR

### 13. SCREEN INVENTORY

- Employee List
- Customer List
- Vendor List
- Product List
- Warehouse List
- Asset List
- Tax List
- Currency List
- UOM List
- Master Dashboard

### 14. DATA VALIDATION RULES

Email

Must be valid email format.

Mobile

Must be country specific.

Tax Number

Must be unique.

Product Code

Must be unique.

Employee Code

Must be unique.

Customer Code

Must be unique.

### 15. APPROVAL WORKFLOWS

#### Employee Creation

```
Draft
↓
HR Review
↓
Approved
↓
Active
```

#### Customer Creation

```
Draft
↓
Sales Review
↓
Approved
```

#### Product Creation

```
Draft
↓
Inventory Review
↓
Finance Validation
↓
Approved
```

### 16. NOTIFICATIONS

Events

- Employee Created
- Customer Approved
- Vendor Approved
- Product Created
- Warehouse Created

Channels

- Email
- In-App

### 17. AUDIT REQUIREMENTS

Track:

- Create
- Update
- Archive
- Approve
- Reject

For every master record.

### 18. DATABASE TABLES

- employees
- customers
- vendors
- products
- warehouses
- assets
- taxes
- currencies
- uoms
- product_categories
- asset_categories

### 19. KEY RELATIONSHIPS

```
Company
1:N Employees

Company
1:N Customers

Company
1:N Vendors

Company
1:N Products

Branch
1:N Warehouses

Employee
1:N Assets
```

### 20. API SPECIFICATIONS

#### Employee APIs

```
GET /api/v1/employees

POST /api/v1/employees

PUT /api/v1/employees/{id}
```

#### Customer APIs

```
GET /api/v1/customers

POST /api/v1/customers

PUT /api/v1/customers/{id}
```

#### Product APIs

```
GET /api/v1/products

POST /api/v1/products

PUT /api/v1/products/{id}
```

### 21. REPORTS

- Employee Master Report
- Customer Master Report
- Vendor Master Report
- Product Catalog Report
- Warehouse Report
- Asset Register Report

### 22. ACCEPTANCE CRITERIA

✅ Unique master records maintained

✅ Duplicate prevention works

✅ Approval workflows work

✅ Organization hierarchy enforced

✅ Audit logs generated

✅ Reports generated

### 23. UAT SCENARIOS

#### UAT-001

Create Employee

Expected:

Employee Created Successfully

#### UAT-002

Duplicate Customer Code

Expected:

Validation Error

#### UAT-003

Product Approval Workflow

Expected:

Product becomes Active after Approval

#### UAT-004

Warehouse linked to Branch

Expected:

Relationship saved correctly

### Architect Review

FRD-03 Master Data Domain is now locked.

#### Dependency Chain

```
Foundation
↓
Organization
↓
Master Data
↓
Finance
CRM
Sales
Procurement
Inventory
Manufacturing
```


---

## FRD-04 Finance & Accounting Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Upstream dependency: [FRD-03 Master Data Domain](./FRD-03-Master-Data-Domain.md)
- Downstream dependencies: [FRD-06 Sales Domain](./FRD-06-Sales-Domain.md), [FRD-07 Procurement Domain](./FRD-07-Procurement-Domain.md), [FRD-10 Payroll Domain](./FRD-10-Payroll-Domain.md), [FRD-12 Asset Management Domain](./FRD-12-Asset-Management-Domain.md), [FRD-11 Project Management Domain](./FRD-11-Project-Management-Domain.md)

### 1. PURPOSE

Finance Domain organization ke saare financial transactions ko manage karega.

#### Core Objectives

- Financial Control
- Financial Reporting
- Compliance
- Budget Control
- Profitability Analysis
- Tax Management

### 2. MODULES COVERED

- Chart of Accounts
- General Ledger
- Journal Entries
- Accounts Payable
- Accounts Receivable
- Budget Management
- Cost Center Accounting
- Profit Center Accounting
- Bank Reconciliation
- Tax Engine
- Financial Reporting

### 3. FINANCIAL ARCHITECTURE

#### Principle

Golden Rule:

Every Financial Transaction

Must Create

Double Entry Accounting

#### Example

Sales Invoice

- Accounts Receivable Dr
- Sales Revenue Cr

Purchase Invoice

- Expense Dr
- Accounts Payable Cr

### 4. CHART OF ACCOUNTS (COA)

#### Purpose

Central account structure.

#### Account Types

- Assets
- Liabilities
- Equity
- Revenue
- Expenses

#### Account Create Fields

| Field | Mandatory |
|---|---|
| Account Code | Yes |
| Account Name | Yes |
| Account Type | Yes |
| Parent Account | No |
| Cost Center Enabled | No |
| Profit Center Enabled | No |
| Status | Yes |

#### Account Code Example

- 1000 Assets
- 2000 Liabilities
- 3000 Equity
- 4000 Revenue
- 5000 Expenses

### 5. GENERAL LEDGER

#### Purpose

Central accounting book.

#### Features

- Ledger Posting
- Ledger Inquiry
- Ledger Adjustments
- Period Closing

#### Business Rule

No transaction directly modifies GL.

All entries come from:

- Journal Entries
- Sales
- Purchases
- Payroll
- Assets

### 6. JOURNAL ENTRIES

#### Entry Types

- Manual
- System Generated
- Adjustment
- Reversal

#### Journal Fields

| Field |
|---|
| Journal Number |
| Date |
| Description |
| Debit Account |
| Credit Account |
| Amount |
| Currency |

#### Validation

Rule:

Total Debit

Must Equal

Total Credit

### 7. ACCOUNTS RECEIVABLE (AR)

#### Purpose

Track customer dues.

#### Sources

- Sales Invoices
- Debit Notes

#### Features

- Customer Aging
- Payment Tracking
- Credit Control
- Collections

#### Aging Buckets

- 0-30
- 31-60
- 61-90
- 90+

### 8. ACCOUNTS PAYABLE (AP)

#### Purpose

Track vendor liabilities.

#### Sources

- Purchase Invoices
- Credit Notes

#### Features

- Vendor Aging
- Payment Scheduling
- Payment Approvals

### 9. COST CENTER ACCOUNTING

#### Purpose

Track departmental costs.

Examples:

- Sales Delhi
- HR Corporate
- Production Unit

#### Referenced By

- Payroll
- Projects
- Procurement
- Expenses

### 10. PROFIT CENTER ACCOUNTING

#### Purpose

Track profitability.

Examples:

- Retail Business
- Manufacturing Division
- Services Division

#### Reports

- Profitability Report
- Revenue Analysis

### 11. BUDGET MANAGEMENT

#### Budget Types

- Annual
- Quarterly
- Monthly

#### Budget Fields

| Field |
|---|
| Budget Name |
| Cost Center |
| Amount |
| Fiscal Year |

#### Controls

System shall:

- Warn
- Or
- Block

Budget Exceeding Transactions

### 12. TAX ENGINE

#### Purpose

Central tax processing.

#### Supported Taxes

- GST
- VAT
- TDS
- Service Tax

#### Features

- Tax Rules
- Tax Calculation
- Tax Reports

#### Tax Configuration

| Field |
|---|
| Tax Code |
| Rate |
| Effective Date |

### 13. BANK RECONCILIATION

#### Purpose

Match ERP and Bank.

#### Inputs

- Bank Statement
- ERP Transactions

#### Outputs

- Matched Entries
- Unmatched Entries

### 14. FISCAL YEAR MANAGEMENT

#### Fields

| Field |
|---|
| Fiscal Year |
| Start Date |
| End Date |
| Status |

#### States

- Open
- Closed
- Archived

### 15. PERIOD CLOSING

#### Monthly Closing

Checklist:

- AR Closed
- AP Closed
- Inventory Closed
- Payroll Closed

#### Closing Rule

Closed period:

Cannot Be Edited

### 16. SCREEN INVENTORY

- Chart Of Accounts
- GL Inquiry
- Journal Entry
- Journal Approval
- AR Dashboard
- AP Dashboard
- Budget Dashboard
- Tax Dashboard
- Bank Reconciliation
- Financial Reports

### 17. APPROVAL WORKFLOWS

#### Journal Approval

```
Draft
Submitted
Finance Manager
Approved
```

#### Budget Approval

```
Draft
Department Head
Finance
Approved
```

#### Vendor Payment

```
Finance Executive
Finance Manager
CFO
Approved
```

### 18. NOTIFICATIONS

Events

- Journal Approved
- Budget Approved
- Payment Due
- Payment Completed
- Fiscal Period Closing

Channels

- Email
- In-App
- SMS

### 19. AUDIT REQUIREMENTS

Track:

- Journal Changes
- Budget Changes
- Tax Changes
- Payment Approvals
- Period Closings

Retention:

7 Years

### 20. DATABASE TABLES

- chart_of_accounts
- journal_entries
- journal_lines
- general_ledger
- accounts_receivable
- accounts_payable
- budgets
- cost_centers
- profit_centers
- tax_rules
- bank_accounts
- bank_reconciliation
- fiscal_years
- period_closings

### 21. KEY RELATIONSHIPS

```
Chart Of Accounts
1:N Journal Entries

Journal Entries
1:N GL Entries

Customer
1:N Accounts Receivable

Vendor
1:N Accounts Payable

Cost Center
1:N Budgets
```

### 22. API SPECIFICATIONS

#### Journal APIs

```
GET /api/v1/journals

POST /api/v1/journals

PUT /api/v1/journals/{id}
```

#### GL APIs

```
GET /api/v1/gl

GET /api/v1/gl/trial-balance
```

#### AR APIs

```
GET /api/v1/ar

POST /api/v1/ar/payment
```

#### AP APIs

```
GET /api/v1/ap

POST /api/v1/ap/payment
```

### 23. REPORTS

#### Financial Reports

- Trial Balance
- Balance Sheet
- Profit & Loss
- Cash Flow Statement

#### AR Reports

- Customer Aging
- Outstanding Invoices

#### AP Reports

- Vendor Aging
- Payment Forecast

#### Budget Reports

- Budget vs Actual

#### Tax Reports

- GST Report
- VAT Report
- TDS Report

### 24. ACCEPTANCE CRITERIA

✅ Double Entry Accounting enforced

✅ Journal Approval Workflow works

✅ AR Aging correct

✅ AP Aging correct

✅ Budget Controls work

✅ Tax Calculations accurate

✅ Bank Reconciliation functional

✅ Financial Reports generated

### 25. UAT SCENARIOS

#### UAT-001

Create Journal Entry

Expected:

Debit = Credit

#### UAT-002

Post Sales Invoice

Expected:

AR Created

GL Posted

#### UAT-003

Budget Exceeded

Expected:

Warning or Block Triggered

#### UAT-004

Close Fiscal Period

Expected:

Further Posting Blocked

### ARCHITECT REVIEW

FRD-04 Finance Domain is now locked.

#### Dependency Chain

```
Foundation
↓
Organization
↓
Master Data
↓
Finance
↓
Sales
Procurement
Payroll
Assets
Projects
```


---

## FRD-05 CRM Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Upstream dependency: [FRD-03 Master Data Domain](./FRD-03-Master-Data-Domain.md)
- Downstream dependency: [FRD-06 Sales Domain](./FRD-06-Sales-Domain.md)

### 1. PURPOSE

CRM domain prospects, leads, opportunities aur customer interactions manage karega.

#### Business Objectives

- Centralized Lead Management
- Opportunity Tracking
- Pipeline Visibility
- Sales Forecasting
- Customer Interaction Tracking
- Conversion Optimization

### 2. MODULES COVERED

- Lead Management
- Lead Assignment
- Lead Qualification
- Opportunity Management
- Activity Management
- Meeting Management
- Task Management
- Pipeline Management
- Sales Forecasting
- Customer Communication

### 3. CRM LIFECYCLE

```
Lead
↓
Qualified
↓
Opportunity
↓
Quotation
↓
Negotiation
↓
Won
↓
Sales Order

OR

Lost
```

### 4. LEAD MANAGEMENT

#### Purpose

Potential customer information capture karna.

#### Lead Sources

- Website
- Referral
- Cold Call
- Email Campaign
- Social Media
- Events
- Manual Entry

#### Lead Fields

| Field | Mandatory |
|---|---|
| Lead Code | Yes |
| First Name | Yes |
| Last Name | No |
| Company Name | No |
| Email | No |
| Mobile | Yes |
| Lead Source | Yes |
| Lead Owner | Yes |
| Status | Yes |

#### Lead Code Format

```
LEAD-000001
```

Auto Generated.

### 5. LEAD STATUS

- New
- Assigned
- Contacted
- Qualified
- Unqualified
- Converted
- Lost

#### Validation Rules

Lead cannot be converted unless:

Mandatory Contact Information Exists

### 6. LEAD ASSIGNMENT

#### Assignment Types

##### Manual

Sales Manager assigns lead.

##### Automatic

Based on:

- Territory
- Industry
- Region
- Workload

### 7. LEAD QUALIFICATION

#### Qualification Parameters

| Parameter |
|---|
| Budget |
| Authority |
| Need |
| Timeline |

#### Outcome

- Qualified
- Unqualified

### 8. OPPORTUNITY MANAGEMENT

#### Purpose

Qualified sales opportunity track karna.

#### Opportunity Fields

| Field |
|---|
| Opportunity Code |
| Opportunity Name |
| Customer |
| Expected Revenue |
| Expected Close Date |
| Sales Owner |
| Stage |

#### Opportunity Code

```
OPP-000001
```

### 9. OPPORTUNITY STAGES

- Qualification
- Discovery
- Proposal
- Negotiation
- Won
- Lost

#### Business Rule

Won Opportunity:

Can Generate Quotation

### 10. ACTIVITY MANAGEMENT

#### Activity Types

- Call
- Meeting
- Email
- Task
- Follow-up

#### Activity Fields

| Field |
|---|
| Activity Type |
| Date |
| Owner |
| Notes |
| Outcome |

### 11. MEETING MANAGEMENT

#### Fields

| Field |
|---|
| Meeting Title |
| Date |
| Time |
| Participants |
| Notes |

#### Outcomes

- Interested
- Need Follow-up
- Closed

### 12. TASK MANAGEMENT

#### Purpose

Track sales activities.

#### Task Status

- Pending
- In Progress
- Completed
- Cancelled

### 13. PIPELINE MANAGEMENT

#### Purpose

Visual sales funnel.

#### Pipeline Stages

- Lead
- Qualified
- Opportunity
- Proposal
- Negotiation
- Won
- Lost

#### Metrics

Track:

- Conversion Rate
- Pipeline Value
- Average Deal Size
- Sales Cycle Length

### 14. CUSTOMER COMMUNICATION

#### Communication Channels

- Email
- Phone
- WhatsApp
- SMS

#### Communication Log

Every interaction stored.

### 15. SALES FORECASTING

#### Forecast Types

- Monthly
- Quarterly
- Yearly

#### Inputs

- Pipeline Value
- Probability %
- Expected Close Date

#### Formula

```
Forecast Revenue
=
Expected Revenue
×
Probability %
```

### 16. SCREEN INVENTORY

- Lead Dashboard
- Lead List
- Lead Details
- Lead Create
- Opportunity Dashboard
- Opportunity List
- Opportunity Details
- Activity Calendar
- Meeting Scheduler
- Task Board
- Pipeline Dashboard
- Forecast Dashboard

### 17. APPROVAL WORKFLOWS

#### Lead Conversion

```
Lead
↓
Qualification
↓
Manager Approval
↓
Opportunity
```

#### Opportunity Closure

```
Won/Lost
↓
Manager Validation
```

### 18. NOTIFICATIONS

Events:

- Lead Assigned
- Lead Qualified
- Opportunity Created
- Meeting Reminder
- Task Due
- Opportunity Won

Channels

- Email
- In-App
- WhatsApp

### 19. AUDIT REQUIREMENTS

Track:

- Lead Creation
- Lead Update
- Lead Assignment
- Opportunity Changes
- Activity Updates
- Status Changes

### 20. DATABASE TABLES

- leads
- lead_sources
- lead_assignments
- lead_notes
- opportunities
- opportunity_stages
- activities
- meetings
- tasks
- communication_logs
- sales_forecasts

### 21. KEY RELATIONSHIPS

```
Lead
1:N Activities

Lead
1:1 Opportunity

Opportunity
1:N Meetings

Opportunity
1:N Tasks

Customer
1:N Opportunities
```

### 22. API SPECIFICATIONS

#### Lead APIs

```
GET /api/v1/leads

POST /api/v1/leads

PUT /api/v1/leads/{id}

DELETE /api/v1/leads/{id}
```

#### Opportunity APIs

```
GET /api/v1/opportunities

POST /api/v1/opportunities

PUT /api/v1/opportunities/{id}
```

#### Activity APIs

```
GET /api/v1/activities

POST /api/v1/activities
```

### 23. REPORTS

#### CRM Reports

- Lead Source Report
- Lead Conversion Report
- Opportunity Report
- Sales Funnel Report
- Sales Forecast Report
- Activity Report

### 24. ACCEPTANCE CRITERIA

✅ Leads created successfully

✅ Lead assignment works

✅ Opportunity conversion works

✅ Pipeline visible

✅ Forecast generated

✅ Activities tracked

✅ Reports generated

### 25. UAT SCENARIOS

#### UAT-001

Create Lead

Expected:

Lead Created Successfully

#### UAT-002

Assign Lead

Expected:

Lead Assigned To Sales User

#### UAT-003

Convert Lead To Opportunity

Expected:

Opportunity Created

#### UAT-004

Create Activity

Expected:

Activity Logged

#### UAT-005

Forecast Revenue

Expected:

Forecast Calculated Correctly

### ARCHITECT REVIEW

FRD-05 CRM Domain is now locked.

#### Dependency Chain

```
Foundation
↓
Organization
↓
Master Data
↓
CRM
↓
Sales
```


---

## FRD-06 Sales Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Upstream dependencies: [FRD-05 CRM Domain](./FRD-05-CRM-Domain.md), [FRD-03 Master Data Domain](./FRD-03-Master-Data-Domain.md)
- Downstream dependency: [FRD-04 Finance & Accounting Domain](./FRD-04-Finance-Accounting-Domain.md)
- Integration dependency: [FRD-08 Inventory & Warehouse Domain](./FRD-08-Inventory-Warehouse-Domain.md)

### 1. PURPOSE

Sales Domain customer orders ko manage karega from quotation to payment collection.

#### Business Objectives

- Sales Process Automation
- Revenue Tracking
- Customer Order Management
- Pricing Standardization
- Invoice Generation
- Payment Tracking

### 2. MODULES COVERED

- Quotation Management
- Sales Order Management
- Pricing Engine
- Contract Management
- Invoice Management
- Payment Tracking
- Returns Management
- Credit Notes
- Sales Analytics

### 3. SALES LIFECYCLE

```
Lead
↓
Opportunity
↓
Quotation
↓
Customer Approval
↓
Sales Order
↓
Delivery
↓
Invoice
↓
Payment
↓
Closed
```

### 4. QUOTATION MANAGEMENT

#### Purpose

Customer proposal generation.

#### Quotation Fields

| Field | Mandatory |
|---|---|
| Quotation Number | Yes |
| Customer | Yes |
| Opportunity | No |
| Quotation Date | Yes |
| Valid Until | Yes |
| Currency | Yes |
| Payment Terms | No |
| Total Amount | Yes |
| Status | Yes |

#### Quotation Number Format

```
QT-2026-000001
```

#### Quotation Status

- Draft
- Submitted
- Sent
- Accepted
- Rejected
- Expired

#### Business Rules

Accepted quotation:

Can Create Sales Order

Rejected quotation:

Cannot Create Sales Order

### 5. QUOTATION ITEMS

#### Fields

| Field |
|---|
| Product |
| Description |
| Quantity |
| UOM |
| Unit Price |
| Discount |
| Tax |
| Line Total |

#### Validation

- Quantity > 0
- Price >= 0

### 6. SALES ORDER MANAGEMENT

#### Purpose

Convert approved quotation into executable order.

#### Sales Order Fields

| Field |
|---|
| Order Number |
| Customer |
| Quotation Reference |
| Order Date |
| Delivery Date |
| Currency |
| Status |

#### Order Number Format

```
SO-2026-000001
```

#### Order Status

- Draft
- Confirmed
- Processing
- Partially Delivered
- Delivered
- Closed
- Cancelled

### 7. SALES ORDER BUSINESS RULES

Rule:

Confirmed Order

Reserves Inventory

Rule:

Cancelled Order

Releases Inventory

Rule:

Delivered Order

Eligible For Invoice

### 8. PRICING ENGINE

#### Purpose

Centralized pricing management.

#### Pricing Types

- Standard Pricing
- Customer Specific Pricing
- Volume Pricing
- Promotional Pricing
- Contract Pricing

#### Pricing Hierarchy

```
Contract Price
↓
Customer Price
↓
Volume Price
↓
Standard Price
```

Highest priority wins.

### 9. CONTRACT MANAGEMENT

#### Purpose

Manage customer contracts.

#### Fields

| Field |
|---|
| Contract Number |
| Customer |
| Start Date |
| End Date |
| Contract Value |
| Status |

#### Contract Status

- Draft
- Active
- Expired
- Terminated

### 10. DELIVERY MANAGEMENT

#### Purpose

Track order fulfillment.

#### Delivery Status

- Pending
- In Progress
- Partially Delivered
- Delivered

#### Integration

Depends On:

- Inventory Module
- Warehouse Module

### 11. INVOICE MANAGEMENT

#### Purpose

Generate financial documents.

#### Invoice Fields

| Field |
|---|
| Invoice Number |
| Customer |
| Invoice Date |
| Due Date |
| Currency |
| Tax Amount |
| Total Amount |

#### Invoice Number Format

```
INV-2026-000001
```

#### Invoice Status

- Draft
- Posted
- Partially Paid
- Paid
- Cancelled

#### Accounting Impact

Invoice Creation:

- Accounts Receivable Dr
- Sales Revenue Cr

Automatic Finance Posting.

### 12. PAYMENT TRACKING

#### Purpose

Track customer payments.

#### Payment Methods

- Cash
- Bank Transfer
- Cheque
- UPI
- Online Gateway

#### Payment Status

- Pending
- Partial
- Paid
- Overdue

### 13. RETURNS MANAGEMENT

#### Purpose

Handle customer returns.

#### Return Types

- Damaged Goods
- Wrong Item
- Excess Quantity
- Quality Issue

#### Return Status

- Requested
- Approved
- Received
- Closed

### 14. CREDIT NOTES

#### Purpose

Adjust customer balances.

#### Scenarios

- Returns
- Pricing Corrections
- Discount Adjustments

#### Accounting Impact

- Sales Return Dr
- Accounts Receivable Cr

### 15. SCREEN INVENTORY

- Quotation Dashboard
- Quotation List
- Quotation Create
- Quotation Details
- Sales Order Dashboard
- Sales Order List
- Sales Order Details
- Invoice Dashboard
- Invoice List
- Payment Dashboard
- Returns Dashboard
- Contract Dashboard

### 16. APPROVAL WORKFLOWS

#### Quotation Approval

```
Draft
↓
Sales Manager
↓
Approved
```

#### Discount Approval

```
Sales Executive
↓
Sales Manager
↓
Finance Approval
↓
Approved
```

#### Credit Note Approval

```
Sales Manager
↓
Finance Manager
↓
Approved
```

### 17. NOTIFICATIONS

Events

- Quotation Approved
- Sales Order Created
- Delivery Completed
- Invoice Generated
- Payment Received
- Payment Overdue

Channels

- Email
- In-App
- WhatsApp

### 18. AUDIT REQUIREMENTS

Track:

- Quotation Changes
- Order Changes
- Invoice Changes
- Payment Updates
- Returns
- Credit Notes

### 19. DATABASE TABLES

- quotations
- quotation_items
- sales_orders
- sales_order_items
- contracts
- deliveries
- invoices
- invoice_items
- payments
- returns
- credit_notes
- pricing_rules

### 20. KEY RELATIONSHIPS

```
Customer
1:N Quotations

Quotation
1:N Quotation Items

Quotation
1:1 Sales Order

Sales Order
1:N Deliveries

Sales Order
1:N Invoices

Invoice
1:N Payments
```

### 21. API SPECIFICATIONS

#### Quotation APIs

```
GET /api/v1/quotations

POST /api/v1/quotations

PUT /api/v1/quotations/{id}
```

#### Sales Order APIs

```
GET /api/v1/sales-orders

POST /api/v1/sales-orders

PUT /api/v1/sales-orders/{id}
```

#### Invoice APIs

```
GET /api/v1/invoices

POST /api/v1/invoices

PUT /api/v1/invoices/{id}
```

#### Payment APIs

```
GET /api/v1/payments

POST /api/v1/payments
```

### 22. REPORTS

#### Sales Reports

- Sales Revenue Report
- Quotation Conversion Report
- Sales Order Report
- Customer Sales Report
- Product Sales Report
- Invoice Aging Report
- Payment Collection Report
- Returns Analysis Report

### 23. ACCEPTANCE CRITERIA

✅ Quotation creation works

✅ Quotation approval works

✅ Sales Order generation works

✅ Inventory reservation works

✅ Invoice generation works

✅ Finance posting works

✅ Payment tracking works

✅ Returns and Credit Notes work

### 24. UAT SCENARIOS

#### UAT-001

Create Quotation

Expected:

Quotation Created Successfully

#### UAT-002

Convert Quotation To Sales Order

Expected:

Sales Order Generated

#### UAT-003

Create Invoice

Expected:

Invoice Posted To Finance

#### UAT-004

Receive Payment

Expected:

Invoice Balance Updated

#### UAT-005

Create Return

Expected:

Return Process Initiated

### ARCHITECT REVIEW

FRD-06 Sales Domain is now locked.

#### Dependency Chain

```
Foundation
↓
Organization
↓
Master Data
↓
CRM
↓
Sales
↓
Finance
```


---

## FRD-07 Procurement Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Upstream dependency: [FRD-03 Master Data Domain](./FRD-03-Master-Data-Domain.md)
- Downstream dependencies: [FRD-08 Inventory & Warehouse Domain](./FRD-08-Inventory-Warehouse-Domain.md), [FRD-04 Finance & Accounting Domain](./FRD-04-Finance-Accounting-Domain.md)
- Related: [FRD-14 Quality Management Domain](./FRD-14-Quality-Management-Domain.md) (Incoming Quality Check)

### 1. PURPOSE

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

#### Business Objectives

- Standardized Procurement
- Vendor Management
- Cost Control
- Purchase Transparency
- Approval Governance
- Supplier Performance Tracking

### 2. MODULES COVERED

- Purchase Requisition
- RFQ Management
- Vendor Quotation Management
- Vendor Comparison
- Purchase Orders
- Goods Receipt Notes (GRN)
- Vendor Contracts
- Purchase Invoicing
- Vendor Performance

### 3. PROCUREMENT LIFECYCLE

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

### 4. PURCHASE REQUISITION (PR)

#### Purpose

Internal request for procurement.

#### Requisition Fields

| Field | Mandatory |
|---|---|
| PR Number | Yes |
| Requester | Yes |
| Department | Yes |
| Cost Center | Yes |
| Required Date | Yes |
| Priority | Yes |
| Status | Yes |

#### PR Number Format

```
PR-2026-000001
```

#### Priority Levels

- Low
- Medium
- High
- Critical

#### Status

- Draft
- Submitted
- Approved
- Rejected
- Converted To RFQ

### 5. RFQ MANAGEMENT

#### Purpose

Collect vendor quotations.

#### RFQ Fields

| Field |
|---|
| RFQ Number |
| PR Reference |
| RFQ Date |
| Closing Date |
| Vendors Invited |
| Status |

#### RFQ Number

```
RFQ-2026-000001
```

#### RFQ Status

- Draft
- Published
- Quotes Received
- Closed
- Cancelled

### 6. VENDOR QUOTATION MANAGEMENT

#### Purpose

Store vendor responses.

#### Quotation Fields

| Field |
|---|
| Vendor |
| RFQ |
| Quote Date |
| Valid Until |
| Total Amount |
| Currency |

#### Attachments

Allowed:

- PDF
- Excel
- Images
- Documents

### 7. VENDOR COMPARISON

#### Purpose

Compare quotations.

#### Comparison Parameters

- Price
- Delivery Time
- Payment Terms
- Vendor Rating
- Warranty
- Past Performance

#### Recommendation Engine

System shall generate:

- Best Price
- Best Delivery
- Best Overall Score

### 8. PURCHASE ORDER (PO)

#### Purpose

Official procurement order.

#### PO Fields

| Field |
|---|
| PO Number |
| Vendor |
| PO Date |
| Currency |
| Payment Terms |
| Delivery Date |
| Status |

#### PO Number

```
PO-2026-000001
```

#### PO Status

- Draft
- Approved
- Sent
- Partially Received
- Received
- Closed
- Cancelled

#### Business Rules

Approved PO:

Can Create GRN

Cancelled PO:

Cannot Receive Goods

### 9. PO LINE ITEMS

#### Fields

| Field |
|---|
| Product |
| Quantity |
| UOM |
| Unit Cost |
| Tax |
| Line Total |

#### Validation

- Quantity > 0
- Cost > 0

### 10. GOODS RECEIPT NOTE (GRN)

#### Purpose

Receive purchased goods.

#### GRN Fields

| Field |
|---|
| GRN Number |
| PO Reference |
| Warehouse |
| Receipt Date |
| Status |

#### GRN Number

```
GRN-2026-000001
```

#### Status

- Pending
- Partially Received
- Received
- Rejected

#### Inventory Impact

GRN Posting:

Inventory Increase

### 11. VENDOR CONTRACT MANAGEMENT

#### Purpose

Manage procurement agreements.

#### Fields

| Field |
|---|
| Contract Number |
| Vendor |
| Start Date |
| End Date |
| Contract Value |
| Status |

#### Status

- Draft
- Active
- Expired
- Terminated

### 12. PURCHASE INVOICE

#### Purpose

Vendor billing management.

#### Fields

| Field |
|---|
| Invoice Number |
| Vendor |
| Invoice Date |
| Due Date |
| Amount |
| Tax |

#### Finance Impact

Invoice Posting:

- Expense / Inventory Dr
- Accounts Payable Cr

### 13. VENDOR PERFORMANCE MANAGEMENT

#### KPIs

- On-Time Delivery %
- Quality Rating
- Cost Competitiveness
- Contract Compliance
- Issue Resolution Time

#### Vendor Score

Scale:

0 - 100

### 14. SCREEN INVENTORY

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

### 15. APPROVAL WORKFLOWS

#### Purchase Requisition

```
Employee
↓
Manager
↓
Approved
```

#### RFQ Approval

```
Procurement Executive
↓
Procurement Manager
↓
Approved
```

#### Purchase Order Approval

```
Buyer
↓
Procurement Manager
↓
Finance Manager
↓
Approved
```

#### High Value Purchase

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

### 16. NOTIFICATIONS

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

### 17. AUDIT REQUIREMENTS

Track:

- PR Changes
- RFQ Changes
- Vendor Selection
- PO Changes
- GRN Posting
- Invoice Posting

### 18. DATABASE TABLES

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

### 19. KEY RELATIONSHIPS

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

### 20. API SPECIFICATIONS

#### PR APIs

```
GET /api/v1/purchase-requisitions

POST /api/v1/purchase-requisitions

PUT /api/v1/purchase-requisitions/{id}
```

#### RFQ APIs

```
GET /api/v1/rfqs

POST /api/v1/rfqs
```

#### PO APIs

```
GET /api/v1/purchase-orders

POST /api/v1/purchase-orders

PUT /api/v1/purchase-orders/{id}
```

#### GRN APIs

```
GET /api/v1/grns

POST /api/v1/grns
```

### 21. REPORTS

#### Procurement Reports

- Purchase Requisition Report
- RFQ Analysis Report
- Vendor Comparison Report
- Purchase Order Report
- GRN Report
- Vendor Performance Report
- Procurement Spend Analysis
- Contract Utilization Report

### 22. ACCEPTANCE CRITERIA

✅ Purchase Requisition workflow works

✅ RFQ process works

✅ Vendor comparison works

✅ Purchase Order approval works

✅ GRN updates inventory

✅ Purchase Invoice updates AP

✅ Vendor performance calculated

✅ Procurement reports generated

### 23. UAT SCENARIOS

#### UAT-001

Create Purchase Requisition

Expected:

PR Created Successfully

#### UAT-002

Publish RFQ

Expected:

RFQ Sent To Vendors

#### UAT-003

Create Purchase Order

Expected:

PO Generated Successfully

#### UAT-004

Post GRN

Expected:

Inventory Updated

#### UAT-005

Post Vendor Invoice

Expected:

Accounts Payable Created

### ARCHITECT REVIEW

FRD-07 Procurement Domain is now locked.

#### Dependency Chain

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


---

## FRD-08 Inventory & Warehouse Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Upstream dependency: [FRD-07 Procurement Domain](./FRD-07-Procurement-Domain.md)
- Downstream dependencies: [FRD-13 Manufacturing Domain](./FRD-13-Manufacturing-Domain.md), [FRD-06 Sales Domain](./FRD-06-Sales-Domain.md), [FRD-04 Finance & Accounting Domain](./FRD-04-Finance-Accounting-Domain.md)
- Related: [FRD-15 Supply Chain Management Domain](./FRD-15-Supply-Chain-Management-Domain.md)

### 1. PURPOSE

Inventory Domain organization ke stock aur warehouse operations ko manage karega.

#### Business Objectives

- Real-Time Inventory Visibility
- Warehouse Optimization
- Stock Accuracy
- Traceability
- Inventory Valuation
- Stock Movement Control

### 2. MODULES COVERED

- Inventory Management
- Warehouse Management
- Bin Management
- Stock Movements
- Stock Transfers
- Stock Adjustments
- Batch Tracking
- Serial Number Tracking
- Barcode Management
- Cycle Counting
- Stock Valuation

### 3. INVENTORY LIFECYCLE

```
Purchase
↓
Goods Receipt
↓
Warehouse Storage
↓
Stock Movement
↓
Issue / Consumption
↓
Transfer
↓
Sale
↓
Inventory Valuation
```

### 4. INVENTORY MASTER

#### Purpose

Central stock repository.

#### Inventory Fields

| Field | Mandatory |
|---|---|
| Product | Yes |
| Warehouse | Yes |
| UOM | Yes |
| Available Qty | Yes |
| Reserved Qty | Yes |
| Status | Yes |

#### Formula

Available Stock:

On Hand

-

Reserved

### 5. WAREHOUSE MANAGEMENT

#### Purpose

Manage physical storage locations.

#### Warehouse Types

- Main Warehouse
- Regional Warehouse
- Distribution Center
- Store
- Transit Warehouse

#### Warehouse Fields

| Field |
|---|
| Warehouse Code |
| Warehouse Name |
| Branch |
| Capacity |
| Manager |

### 6. BIN MANAGEMENT

#### Purpose

Precise stock location management.

#### Example

```
Warehouse
Aisle A
Rack 1
Shelf 2
Bin 10
```

#### Bin Code Format

```
BIN-A01-R01-S02-10
```

### 7. STOCK MOVEMENTS

#### Movement Types

- Receipt
- Issue
- Transfer
- Adjustment
- Return

#### Stock Ledger

Every stock movement creates ledger entry.

#### Fields

| Field |
|---|
| Product |
| Movement Type |
| Quantity |
| Warehouse |
| Date |

### 8. STOCK TRANSFERS

#### Purpose

Move inventory between warehouses.

#### Transfer Types

- Branch To Branch
- Warehouse To Warehouse
- Bin To Bin

#### Workflow

```
Requested
↓
Approved
↓
In Transit
↓
Received
↓
Closed
```

### 9. STOCK ADJUSTMENTS

#### Purpose

Correct inventory discrepancies.

#### Reasons

- Damage
- Loss
- Shrinkage
- Counting Error
- Expiry

#### Approval Required

Yes

### 10. BATCH TRACKING

#### Purpose

Track inventory batches.

#### Fields

| Field |
|---|
| Batch Number |
| Manufacturing Date |
| Expiry Date |
| Quantity |

#### Batch Number Format

```
BATCH-2026-000001
```

### 11. SERIAL NUMBER TRACKING

#### Purpose

Track unique items.

#### Applicable For

- Laptops
- Servers
- Machines
- Equipment

#### Serial Format

```
SN-2026-000001
```

### 12. BARCODE MANAGEMENT

#### Purpose

Enable scanning.

#### Barcode Types

- EAN
- UPC
- QR Code
- Code128

#### Features

- Barcode Generation
- Barcode Printing
- Barcode Scanning

### 13. CYCLE COUNTING

#### Purpose

Inventory verification.

#### Count Types

- Daily
- Weekly
- Monthly
- Annual

#### Count Results

- Match
- Shortage
- Excess

### 14. STOCK VALUATION

#### Purpose

Calculate inventory value.

#### Valuation Methods

- FIFO
- LIFO
- Weighted Average

#### Recommended

FIFO

### 15. INVENTORY RESERVATION

#### Purpose

Reserve stock for orders.

#### Sources

- Sales Orders
- Production Orders
- Projects

#### Rule

Reserved Stock:

Cannot Be Sold Again

### 16. SCREEN INVENTORY

- Inventory Dashboard
- Stock Ledger
- Warehouse Dashboard
- Bin Management
- Transfer Dashboard
- Adjustment Dashboard
- Batch Dashboard
- Serial Tracking Dashboard
- Cycle Count Dashboard
- Valuation Dashboard

### 17. APPROVAL WORKFLOWS

#### Stock Transfer

```
Requester
↓
Warehouse Manager
↓
Approved
```

#### Stock Adjustment

```
Warehouse Executive
↓
Warehouse Manager
↓
Finance Review
↓
Approved
```

#### Cycle Count Variance

```
Counter
↓
Manager
↓
Approved
```

### 18. NOTIFICATIONS

Events

- Low Stock
- Transfer Approved
- Stock Adjustment
- Cycle Count Variance
- Batch Expiry Alert

Channels

- Email
- In-App
- WhatsApp

### 19. AUDIT REQUIREMENTS

Track:

- Stock Receipt
- Stock Issue
- Stock Transfer
- Stock Adjustment
- Cycle Count
- Valuation Changes

### 20. DATABASE TABLES

- inventory
- inventory_ledger
- warehouses
- warehouse_bins
- stock_transfers
- stock_transfer_items
- stock_adjustments
- stock_adjustment_items
- batches
- serial_numbers
- barcodes
- cycle_counts
- inventory_valuations

### 21. KEY RELATIONSHIPS

```
Warehouse
1:N Bins

Product
1:N Inventory

Inventory
1:N Ledger Entries

Inventory
1:N Batches

Inventory
1:N Serial Numbers

Transfer
1:N Transfer Items
```

### 22. API SPECIFICATIONS

#### Inventory APIs

```
GET /api/v1/inventory

GET /api/v1/inventory/ledger
```

#### Transfer APIs

```
GET /api/v1/transfers

POST /api/v1/transfers

PUT /api/v1/transfers/{id}
```

#### Adjustment APIs

```
GET /api/v1/adjustments

POST /api/v1/adjustments
```

#### Cycle Count APIs

```
GET /api/v1/cycle-counts

POST /api/v1/cycle-counts
```

### 23. REPORTS

#### Inventory Reports

- Stock Summary Report
- Stock Ledger Report
- Inventory Aging Report
- Batch Expiry Report
- Serial Tracking Report
- Stock Transfer Report
- Stock Adjustment Report
- Inventory Valuation Report
- Cycle Count Variance Report

### 24. ACCEPTANCE CRITERIA

✅ Stock updates in real time

✅ Transfers work correctly

✅ Adjustments require approval

✅ Batch tracking works

✅ Serial tracking works

✅ Barcode scanning works

✅ Inventory valuation accurate

✅ Audit logs generated

### 25. UAT SCENARIOS

#### UAT-001

Receive Goods

Expected:

Inventory Increased

#### UAT-002

Transfer Stock

Expected:

Inventory Moved Successfully

#### UAT-003

Perform Cycle Count

Expected:

Variance Calculated

#### UAT-004

Reserve Stock For Sales Order

Expected:

Reserved Quantity Updated

#### UAT-005

Generate Valuation Report

Expected:

Inventory Value Calculated Correctly

### ARCHITECT REVIEW

FRD-08 Inventory & Warehouse Domain is now locked.

#### Dependency Chain

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
Manufacturing
↓
Sales
↓
Finance
```

#### Critical Observation

Inventory Domain now supports:

- Real-Time Stock Control
- Warehouse Operations
- Batch & Serial Traceability
- Inventory Valuation
- Stock Reservations
- Audit-Compliant Stock Ledger


---

## FRD-09 Human Resource (HR) Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Upstream dependency: [FRD-03 Master Data Domain](./FRD-03-Master-Data-Domain.md)
- Downstream dependency: [FRD-10 Payroll Domain](./FRD-10-Payroll-Domain.md)

### 1. PURPOSE

HR Domain employee lifecycle ko manage karega.

From:

```
Recruitment
↓
Hiring
↓
Onboarding
↓
Employment
↓
Performance
↓
Training
↓
Separation
```

#### Business Objectives

- Employee Lifecycle Management
- Workforce Visibility
- Attendance Management
- Leave Management
- Shift Management
- Performance Tracking
- Training Management
- Employee Self Service

### 2. MODULES COVERED

- Recruitment
- Candidate Management
- Onboarding
- Employee Management
- Attendance Management
- Leave Management
- Shift Management
- Performance Management
- Training Management
- Employee Self Service (ESS)
- Separation Management

### 3. EMPLOYEE LIFECYCLE

```
Job Requisition
↓
Candidate
↓
Interview
↓
Offer
↓
Joining
↓
Employee
↓
Performance Reviews
↓
Exit Process
```

### 4. RECRUITMENT MANAGEMENT

#### Purpose

Manage hiring process.

#### Job Requisition Fields

| Field | Mandatory |
|---|---|
| Requisition Number | Yes |
| Department | Yes |
| Position | Yes |
| Openings | Yes |
| Hiring Manager | Yes |
| Status | Yes |

#### Requisition Number Format

```
REQ-2026-000001
```

#### Status

- Draft
- Submitted
- Approved
- Open
- Closed

### 5. CANDIDATE MANAGEMENT

#### Candidate Fields

| Field |
|---|
| Candidate ID |
| Name |
| Email |
| Mobile |
| Position Applied |
| Resume |
| Experience |
| Status |

#### Candidate Status

- Applied
- Screening
- Interview
- Selected
- Rejected
- On Hold

#### Candidate ID

```
CAN-000001
```

### 6. INTERVIEW MANAGEMENT

#### Interview Types

- HR Round
- Technical Round
- Manager Round
- Final Round

#### Fields

| Field |
|---|
| Candidate |
| Interviewer |
| Date |
| Time |
| Feedback |
| Result |

#### Results

- Pass
- Fail
- Hold

### 7. OFFER MANAGEMENT

#### Purpose

Manage offer process.

#### Offer Fields

| Field |
|---|
| Offer Number |
| Candidate |
| Position |
| Salary Offered |
| Joining Date |
| Status |

#### Status

- Draft
- Sent
- Accepted
- Rejected
- Expired

### 8. ONBOARDING MANAGEMENT

#### Purpose

Convert candidate into employee.

#### Activities

- Document Verification
- Asset Allocation
- Account Creation
- Training Assignment
- Manager Assignment

#### Onboarding Checklist

Mandatory before activation.

### 9. EMPLOYEE MANAGEMENT

#### Purpose

Manage employee records.

#### Employee Fields

| Field |
|---|
| Employee Code |
| Name |
| Department |
| Designation |
| Reporting Manager |
| Employment Type |
| Date Of Joining |
| Status |

#### Employment Types

- Permanent
- Contract
- Intern
- Consultant

#### Employee Status

- Active
- Probation
- On Leave
- Resigned
- Terminated

### 10. ATTENDANCE MANAGEMENT

#### Purpose

Track working hours.

#### Attendance Sources

- Manual
- Biometric
- Mobile App
- Web Portal
- Third Party Device

#### Attendance Status

- Present
- Absent
- Half Day
- Work From Home
- Holiday

#### Fields

| Field |
|---|
| Employee |
| Date |
| Check In |
| Check Out |
| Total Hours |

### 11. LEAVE MANAGEMENT

#### Leave Types

- Casual Leave
- Sick Leave
- Earned Leave
- Maternity Leave
- Paternity Leave
- Unpaid Leave

#### Leave Fields

| Field |
|---|
| Employee |
| Leave Type |
| Start Date |
| End Date |
| Reason |
| Status |

#### Leave Status

- Draft
- Submitted
- Approved
- Rejected
- Cancelled

### 12. SHIFT MANAGEMENT

#### Purpose

Manage work schedules.

#### Shift Types

- General
- Morning
- Evening
- Night
- Rotational

#### Fields

| Field |
|---|
| Shift Name |
| Start Time |
| End Time |
| Grace Period |

### 13. PERFORMANCE MANAGEMENT

#### Purpose

Evaluate employee performance.

#### Review Cycles

- Monthly
- Quarterly
- Half-Yearly
- Yearly

#### Evaluation Areas

- Goals
- KPIs
- Competencies
- Behavior
- Attendance

#### Ratings

1, 2, 3, 4, 5

### 14. TRAINING MANAGEMENT

#### Purpose

Track employee learning.

#### Training Types

- Technical
- Compliance
- Soft Skills
- Leadership

#### Fields

| Field |
|---|
| Training Name |
| Trainer |
| Date |
| Participants |
| Completion Status |

### 15. EMPLOYEE SELF SERVICE (ESS)

#### Purpose

Allow employees to manage own records.

#### Features

- Profile View
- Leave Requests
- Attendance View
- Payslip View
- Training View
- Performance View
- Asset Requests

### 16. SEPARATION MANAGEMENT

#### Purpose

Manage employee exit.

#### Types

- Resignation
- Termination
- Retirement

#### Exit Checklist

- Asset Return
- Knowledge Transfer
- Clearance
- Final Settlement

### 17. SCREEN INVENTORY

- Recruitment Dashboard
- Candidate Dashboard
- Interview Dashboard
- Employee Dashboard
- Attendance Dashboard
- Leave Dashboard
- Shift Dashboard
- Performance Dashboard
- Training Dashboard
- ESS Dashboard
- Separation Dashboard

### 18. APPROVAL WORKFLOWS

#### Job Requisition

```
Department Head
↓
HR Manager
↓
Approved
```

#### Leave Approval

```
Employee
↓
Reporting Manager
↓
Approved
```

#### Shift Change

```
Employee
↓
Manager
↓
HR Approval
```

#### Separation Approval

```
Employee
↓
Manager
↓
HR
↓
Final Approval
```

### 19. NOTIFICATIONS

Events

- Interview Scheduled
- Offer Sent
- Employee Joined
- Leave Approved
- Training Assigned
- Performance Review Due

Channels

- Email
- In-App
- WhatsApp

### 20. AUDIT REQUIREMENTS

Track:

- Employee Updates
- Attendance Changes
- Leave Approvals
- Performance Reviews
- Training Records
- Exit Actions

### 21. DATABASE TABLES

- job_requisitions
- candidates
- interviews
- offers
- employees
- attendance
- leave_requests
- leave_balances
- shifts
- employee_shifts
- performance_reviews
- training_programs
- training_assignments
- employee_separations

### 22. KEY RELATIONSHIPS

```
Department
1:N Employees

Employee
1:N Attendance

Employee
1:N Leave Requests

Employee
1:N Performance Reviews

Employee
1:N Training Assignments
```

### 23. API SPECIFICATIONS

#### Employee APIs

```
GET /api/v1/employees

POST /api/v1/employees

PUT /api/v1/employees/{id}
```

#### Attendance APIs

```
GET /api/v1/attendance

POST /api/v1/attendance
```

#### Leave APIs

```
GET /api/v1/leaves

POST /api/v1/leaves

PUT /api/v1/leaves/{id}
```

#### Performance APIs

```
GET /api/v1/performance

POST /api/v1/performance
```

### 24. REPORTS

#### HR Reports

- Employee Master Report
- Attendance Report
- Leave Balance Report
- Recruitment Report
- Interview Report
- Performance Report
- Training Completion Report
- Attrition Report

### 25. ACCEPTANCE CRITERIA

✅ Recruitment workflow works

✅ Candidate tracking works

✅ Onboarding checklist enforced

✅ Attendance captured correctly

✅ Leave approval workflow works

✅ Performance reviews recorded

✅ ESS portal functional

✅ Separation process completed properly

### 26. UAT SCENARIOS

#### UAT-001

Create Job Requisition

Expected:

Requisition Created Successfully

#### UAT-002

Schedule Interview

Expected:

Candidate Notified

#### UAT-003

Approve Leave Request

Expected:

Leave Balance Updated

#### UAT-004

Assign Training

Expected:

Training Assigned Successfully

#### UAT-005

Employee Resignation

Expected:

Exit Workflow Triggered

### ARCHITECT REVIEW

FRD-09 HR Domain is now locked.

#### Dependency Chain

```
Foundation
↓
Organization
↓
Master Data
↓
HR
↓
Payroll
```

#### Critical Observation

HR Domain now supports:

- Recruitment-to-Hire
- Employee Lifecycle
- Attendance & Leave
- Performance Management
- Training Management
- Employee Self Service
- Separation Management


---

## FRD-10 Payroll Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Upstream dependency: [FRD-09 HR Domain](./FRD-09-HR-Domain.md)
- Downstream dependency: [FRD-04 Finance & Accounting Domain](./FRD-04-Finance-Accounting-Domain.md)

### 1. PURPOSE

Payroll Domain employee compensation lifecycle manage karega.

#### Business Objectives

- Automated Payroll Processing
- Accurate Salary Computation
- Tax Compliance
- Employee Self-Service
- Finance Integration
- Statutory Compliance

### 2. MODULES COVERED

- Salary Structures
- Payroll Components
- Payroll Processing
- Allowances
- Deductions
- Loans & Advances
- Reimbursements
- Tax Management
- Payslip Generation
- Payroll Accounting
- Bank Transfer Processing

### 3. PAYROLL LIFECYCLE

```
Employee
↓
Attendance
↓
Leave Validation
↓
Payroll Processing
↓
Review
↓
Approval
↓
Payslip Generation
↓
Finance Posting
↓
Bank Transfer
```

### 4. SALARY STRUCTURE MANAGEMENT

#### Purpose

Define employee compensation.

#### Salary Structure Fields

| Field | Mandatory |
|---|---|
| Structure Code | Yes |
| Structure Name | Yes |
| Effective Date | Yes |
| Status | Yes |

#### Structure Code

```
SAL-000001
```

#### Components

- Basic Salary
- HRA
- Special Allowance
- Bonus
- Overtime
- Employer Contributions

### 5. PAYROLL COMPONENTS

#### Earnings

- Basic
- HRA
- Medical
- Conveyance
- Special Allowance
- Bonus
- Incentive
- Overtime

#### Deductions

- Tax
- Provident Fund
- ESI
- Professional Tax
- Loan Recovery
- Advance Recovery
- Other Deductions

### 6. PAYROLL PERIOD MANAGEMENT

#### Fields

| Field |
|---|
| Payroll Month |
| Payroll Year |
| Start Date |
| End Date |
| Status |

#### Status

- Open
- Processing
- Approved
- Closed

### 7. PAYROLL PROCESSING

#### Purpose

Generate payroll.

#### Inputs

- Employee Master
- Attendance
- Leaves
- Salary Structure
- Loans
- Reimbursements

#### Processing Formula

```
Gross Salary
-
Deductions
=
Net Salary
```

### 8. ALLOWANCE MANAGEMENT

#### Types

- Fixed
- Variable
- Percentage Based

#### Examples

- HRA
- Travel Allowance
- Meal Allowance
- Project Allowance

### 9. DEDUCTION MANAGEMENT

#### Types

- Statutory
- Voluntary
- Recovery

#### Examples

- PF
- ESI
- Professional Tax
- Loan Recovery

### 10. LOANS & ADVANCES

#### Purpose

Track employee liabilities.

#### Loan Fields

| Field |
|---|
| Employee |
| Loan Type |
| Amount |
| EMI |
| Start Date |
| End Date |

#### Loan Types

- Personal Loan
- Salary Advance
- Emergency Advance

### 11. REIMBURSEMENT MANAGEMENT

#### Purpose

Employee expense reimbursement.

#### Types

- Travel
- Internet
- Medical
- Training
- Mobile

#### Workflow

```
Employee
↓
Manager
↓
Finance
↓
Approved
```

### 12. TAX MANAGEMENT

#### Purpose

Payroll tax compliance.

#### Supported Taxes

- Income Tax
- Professional Tax
- PF
- ESI

#### Features

- Tax Slabs
- Tax Declaration
- Tax Projection
- Annual Tax Calculation

### 13. PAYSLIP GENERATION

#### Purpose

Generate employee salary statement.

#### Payslip Fields

| Field |
|---|
| Employee |
| Payroll Period |
| Gross Salary |
| Total Deductions |
| Net Salary |

#### Payslip Number

```
PS-2026-000001
```

#### Delivery

- ESS Portal
- Email

### 14. BANK TRANSFER PROCESSING

#### Purpose

Salary disbursement.

#### Payment Modes

- Bank Transfer
- Cheque
- Cash

#### Output

Bank Payment File

### 15. PAYROLL ACCOUNTING

#### Purpose

Integrate with Finance.

#### Accounting Entry

Payroll Posting:

- Salary Expense Dr
- Payroll Liability Cr

Salary Payment:

- Payroll Liability Dr
- Bank Cr

### 16. SCREEN INVENTORY

- Payroll Dashboard
- Salary Structure Dashboard
- Payroll Processing Dashboard
- Loan Dashboard
- Reimbursement Dashboard
- Tax Dashboard
- Payslip Dashboard
- Bank Transfer Dashboard

### 17. APPROVAL WORKFLOWS

#### Payroll Approval

```
HR Executive
↓
HR Manager
↓
Finance Manager
↓
Approved
```

#### Loan Approval

```
Employee
↓
Manager
↓
HR
↓
Approved
```

#### Reimbursement Approval

```
Employee
↓
Manager
↓
Finance
↓
Approved
```

### 18. NOTIFICATIONS

Events

- Payroll Processed
- Payslip Generated
- Loan Approved
- Reimbursement Approved
- Salary Paid

Channels

- Email
- In-App
- WhatsApp

### 19. AUDIT REQUIREMENTS

Track:

- Payroll Runs
- Salary Changes
- Tax Changes
- Loan Updates
- Reimbursement Approvals
- Payslip Generation

### 20. DATABASE TABLES

- salary_structures
- salary_components
- payroll_periods
- payroll_runs
- payroll_details
- employee_loans
- loan_repayments
- reimbursements
- tax_slabs
- tax_declarations
- payslips
- bank_transfers

### 21. KEY RELATIONSHIPS

```
Employee
1:N Payslips

Employee
1:N Loans

Employee
1:N Reimbursements

Payroll Run
1:N Payroll Details

Payroll Detail
1:1 Payslip
```

### 22. API SPECIFICATIONS

#### Payroll APIs

```
GET /api/v1/payroll

POST /api/v1/payroll/process

POST /api/v1/payroll/approve
```

#### Payslip APIs

```
GET /api/v1/payslips

GET /api/v1/payslips/{id}
```

#### Loan APIs

```
GET /api/v1/loans

POST /api/v1/loans
```

#### Reimbursement APIs

```
GET /api/v1/reimbursements

POST /api/v1/reimbursements
```

### 23. REPORTS

#### Payroll Reports

- Payroll Summary Report
- Salary Register
- Payslip Report
- Loan Report
- Reimbursement Report
- Tax Report
- Bank Transfer Report
- Cost Center Payroll Report

### 24. ACCEPTANCE CRITERIA

✅ Payroll processed correctly

✅ Attendance integrated correctly

✅ Leave deductions calculated correctly

✅ Tax calculations accurate

✅ Payslips generated

✅ Finance posting completed

✅ Bank transfer file generated

✅ Audit logs maintained

### 25. UAT SCENARIOS

#### UAT-001

Run Payroll

Expected:

Net Salary Calculated Correctly

#### UAT-002

Generate Payslip

Expected:

Payslip Available In ESS

#### UAT-003

Approve Loan

Expected:

Loan Schedule Created

#### UAT-004

Approve Reimbursement

Expected:

Amount Included In Payroll

#### UAT-005

Post Payroll To Finance

Expected:

Journal Entry Created

### ARCHITECT REVIEW

FRD-10 Payroll Domain is now locked.

#### Dependency Chain

```
Foundation
↓
Organization
↓
Master Data
↓
HR
↓
Payroll
↓
Finance
```

#### Critical Observation

Payroll Domain now supports:

- Salary Structures
- Payroll Processing
- Tax Compliance
- Loans & Advances
- Reimbursements
- Payslip Management
- Finance Integration


---

## FRD-11 Project Management Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Upstream dependency: [FRD-09 HR Domain](./FRD-09-HR-Domain.md)
- Downstream dependencies: [FRD-04 Finance & Accounting Domain](./FRD-04-Finance-Accounting-Domain.md), [FRD-06 Sales Domain](./FRD-06-Sales-Domain.md)

### 1. PURPOSE

Project Management Domain projects ko initiation se closure tak manage karega.

#### Business Objectives

- Project Planning
- Task Tracking
- Resource Management
- Budget Control
- Time Tracking
- Cost Tracking
- Project Profitability

### 2. MODULES COVERED

- Project Management
- Task Management
- Milestone Management
- Resource Allocation
- Timesheets
- Project Budgeting
- Project Costing
- Project Billing
- Project Profitability
- Project Reporting

### 3. PROJECT LIFECYCLE

```
Project Request
↓
Approval
↓
Planning
↓
Execution
↓
Monitoring
↓
Completion
↓
Closure
```

### 4. PROJECT MANAGEMENT

#### Purpose

Manage complete project information.

#### Project Fields

| Field | Mandatory |
|---|---|
| Project Code | Yes |
| Project Name | Yes |
| Customer | No |
| Project Type | Yes |
| Project Manager | Yes |
| Start Date | Yes |
| End Date | Yes |
| Budget | Yes |
| Status | Yes |

#### Project Code Format

```
PRJ-2026-000001
```

#### Project Types

- Internal
- Customer Project
- R&D Project
- Implementation Project
- Support Project

#### Project Status

- Draft
- Approved
- In Progress
- On Hold
- Completed
- Cancelled
- Closed

### 5. WORK BREAKDOWN STRUCTURE (WBS)

#### Purpose

Break project into manageable deliverables.

#### Hierarchy

```
Project
↓
Phase
↓
Milestone
↓
Task
↓
Sub Task
```

#### Example

```
ERP Implementation

Phase 1
 ├─ Requirement Gathering
 ├─ BRD

Phase 2
 ├─ Development
 ├─ Testing
```

### 6. TASK MANAGEMENT

#### Purpose

Track project execution.

#### Task Fields

| Field |
|---|
| Task Number |
| Task Name |
| Assignee |
| Priority |
| Start Date |
| Due Date |
| Status |

#### Priority

- Low
- Medium
- High
- Critical

#### Task Status

- Open
- In Progress
- Blocked
- Completed
- Cancelled

### 7. MILESTONE MANAGEMENT

#### Purpose

Track major project checkpoints.

#### Milestone Fields

| Field |
|---|
| Milestone Name |
| Due Date |
| Owner |
| Status |

#### Status

- Planned
- Achieved
- Delayed

### 8. RESOURCE ALLOCATION

#### Purpose

Assign resources to projects.

#### Resource Types

- Employee
- Contractor
- Consultant
- Vendor Resource

#### Allocation Fields

| Field |
|---|
| Resource |
| Project |
| Allocation % |
| Start Date |
| End Date |

#### Validation

Allocation Cannot Exceed 100%

### 9. TIMESHEET MANAGEMENT

#### Purpose

Track employee effort.

#### Timesheet Fields

| Field |
|---|
| Employee |
| Project |
| Task |
| Date |
| Hours Worked |

#### Validation

Daily Hours ≤ 24

#### Status

- Draft
- Submitted
- Approved
- Rejected

### 10. PROJECT BUDGETING

#### Purpose

Control project spending.

#### Budget Types

- Labor
- Materials
- Travel
- Software
- Hardware
- Other

#### Budget Fields

| Field |
|---|
| Budget Amount |
| Cost Center |
| Fiscal Year |

### 11. PROJECT COSTING

#### Purpose

Track actual project costs.

#### Cost Sources

- Payroll
- Procurement
- Expenses
- Assets
- Vendor Bills

#### Formula

```
Total Project Cost
=
Labor Cost
+
Material Cost
+
Other Costs
```

### 12. PROJECT BILLING

#### Purpose

Customer invoicing.

#### Billing Types

- Fixed Price
- Time & Material
- Milestone Based
- Retainer Based

#### Invoice Triggers

- Milestone Completion
- Monthly Billing
- Manual Billing

### 13. PROJECT PROFITABILITY

#### Purpose

Evaluate project performance.

#### Formula

```
Project Profit
=
Project Revenue
-
Project Cost
```

#### KPIs

- Budget Variance
- Cost Variance
- Margin %
- Revenue
- Profit

### 14. PROJECT RISKS

#### Purpose

Manage project risks.

#### Risk Fields

| Field |
|---|
| Risk Name |
| Impact |
| Probability |
| Owner |
| Mitigation Plan |

#### Risk Levels

- Low
- Medium
- High
- Critical

### 15. SCREEN INVENTORY

- Project Dashboard
- Project List
- Project Details
- WBS View
- Task Board
- Milestone Dashboard
- Resource Allocation Dashboard
- Timesheet Dashboard
- Budget Dashboard
- Cost Dashboard
- Profitability Dashboard
- Risk Register

### 16. APPROVAL WORKFLOWS

#### Project Approval

```
Project Manager
↓
Department Head
↓
Finance
↓
Approved
```

#### Timesheet Approval

```
Employee
↓
Manager
↓
Approved
```

#### Budget Approval

```
Project Manager
↓
Finance
↓
Approved
```

### 17. NOTIFICATIONS

Events

- Project Created
- Task Assigned
- Task Due
- Milestone Achieved
- Timesheet Submitted
- Budget Exceeded

Channels

- Email
- In-App
- WhatsApp

### 18. AUDIT REQUIREMENTS

Track:

- Project Changes
- Task Updates
- Budget Changes
- Timesheet Approvals
- Billing Changes

### 19. DATABASE TABLES

- projects
- project_phases
- project_milestones
- project_tasks
- task_dependencies
- resource_allocations
- timesheets
- timesheet_entries
- project_budgets
- project_costs
- project_billings
- project_risks

### 20. KEY RELATIONSHIPS

```
Project
1:N Phases

Project
1:N Milestones

Project
1:N Tasks

Project
1:N Resources

Project
1:N Timesheets

Project
1:N Costs

Project
1:N Billings
```

### 21. API SPECIFICATIONS

#### Project APIs

```
GET /api/v1/projects

POST /api/v1/projects

PUT /api/v1/projects/{id}
```

#### Task APIs

```
GET /api/v1/tasks

POST /api/v1/tasks

PUT /api/v1/tasks/{id}
```

#### Timesheet APIs

```
GET /api/v1/timesheets

POST /api/v1/timesheets

PUT /api/v1/timesheets/{id}
```

### 22. REPORTS

#### Project Reports

- Project Status Report
- Resource Utilization Report
- Timesheet Report
- Budget vs Actual Report
- Project Cost Report
- Project Revenue Report
- Project Profitability Report
- Risk Report

### 23. ACCEPTANCE CRITERIA

✅ Project lifecycle works

✅ Task management works

✅ Resource allocation validated

✅ Timesheets submitted and approved

✅ Project costing calculated

✅ Project billing generated

✅ Profitability calculated

✅ Reports generated

### 24. UAT SCENARIOS

#### UAT-001

Create Project

Expected:

Project Created Successfully

#### UAT-002

Assign Resource

Expected:

Allocation Created

#### UAT-003

Submit Timesheet

Expected:

Timesheet Sent For Approval

#### UAT-004

Generate Project Invoice

Expected:

Invoice Created Successfully

#### UAT-005

View Profitability Report

Expected:

Profit Calculated Correctly

### ARCHITECT REVIEW

FRD-11 Project Management Domain is now locked.

#### Dependency Chain

```
Foundation
↓
Organization
↓
Master Data
↓
HR
↓
Projects
↓
Finance
↓
Sales
```

#### Critical Observation

Project Domain now supports:

- End-to-End Project Lifecycle
- WBS & Task Management
- Resource Planning
- Timesheets
- Budgeting & Costing
- Customer Billing
- Project Profitability


---

## FRD-12 Asset Management Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Upstream dependency: [FRD-07 Procurement Domain](./FRD-07-Procurement-Domain.md)
- Downstream dependencies: [FRD-04 Finance & Accounting Domain](./FRD-04-Finance-Accounting-Domain.md), [FRD-09 HR Domain](./FRD-09-HR-Domain.md)
- Related: [FRD-16 Service Management Domain](./FRD-16-Service-Management-Domain.md), [FRD-17 Helpdesk & Customer Support Domain](./FRD-17-Helpdesk-Customer-Support-Domain.md)

### 1. PURPOSE

Asset Management Domain organization ke physical aur digital assets ka complete lifecycle manage karega.

#### Business Objectives

- Asset Visibility
- Asset Accountability
- Asset Maintenance
- Depreciation Tracking
- Asset Lifecycle Management
- Compliance & Audit Readiness

### 2. MODULES COVERED

- Asset Registration
- Asset Categorization
- Asset Allocation
- Asset Tracking
- Asset Maintenance
- Asset Depreciation
- Asset Transfer
- Asset Return
- Asset Disposal
- Asset Lifecycle Management

### 3. ASSET LIFECYCLE

```
Purchase
↓
Asset Registration
↓
Allocation
↓
Usage
↓
Maintenance
↓
Transfer
↓
Return
↓
Disposal
```

### 4. ASSET REGISTRATION

#### Purpose

Register assets into ERP.

#### Asset Fields

| Field | Mandatory |
|---|---|
| Asset Code | Yes |
| Asset Name | Yes |
| Asset Category | Yes |
| Asset Type | Yes |
| Purchase Date | Yes |
| Purchase Cost | Yes |
| Company | Yes |
| Branch | Yes |
| Status | Yes |

#### Asset Code Format

```
AST-2026-000001
```

#### Asset Categories

- IT Assets
- Furniture
- Vehicles
- Machinery
- Infrastructure
- Software Licenses

### 5. ASSET CATEGORIZATION

#### Asset Types

- Fixed Asset
- Consumable Asset
- Digital Asset
- Leased Asset

#### Purpose

Enable reporting and accounting classification.

### 6. ASSET ALLOCATION

#### Purpose

Assign assets to employees, departments or locations.

#### Allocation Types

- Employee
- Department
- Project
- Branch
- Warehouse

#### Allocation Fields

| Field |
|---|
| Asset |
| Allocation Type |
| Allocated To |
| Allocation Date |
| Expected Return Date |

#### Business Rule

One asset cannot be allocated to multiple employees simultaneously unless marked as shared.

### 7. ASSET TRACKING

#### Purpose

Track asset ownership and location.

#### Tracking Methods

- Barcode
- QR Code
- RFID
- Manual Tracking

#### Trackable Data

- Current Owner
- Current Location
- Allocation History
- Status History

### 8. ASSET MAINTENANCE

#### Purpose

Manage preventive and corrective maintenance.

#### Maintenance Types

- Preventive
- Corrective
- Emergency
- Annual Service

#### Maintenance Fields

| Field |
|---|
| Asset |
| Maintenance Type |
| Scheduled Date |
| Completion Date |
| Vendor |
| Cost |
| Status |

- Scheduled
- In Progress
- Completed
- Cancelled

### 9. ASSET DEPRECIATION

#### Purpose

Calculate asset value reduction.

#### Methods

- Straight Line
- Written Down Value
- Units Of Production

#### Recommended

Straight Line

#### Formula

```
Annual Depreciation
=
(Purchase Cost - Salvage Value)
/
Useful Life
```

#### Finance Impact

Monthly depreciation posting:

- Depreciation Expense Dr
- Accumulated Depreciation Cr

### 10. ASSET TRANSFER

#### Purpose

Move assets between entities.

#### Transfer Types

- Employee To Employee
- Department To Department
- Branch To Branch
- Project To Project

#### Workflow

```
Request
↓
Approval
↓
Transfer
↓
Confirmation
```

### 11. ASSET RETURN

#### Purpose

Recover assets.

#### Triggers

- Employee Resignation
- Project Completion
- Department Change
- Asset Replacement

#### Validation

Asset must be returned before employee clearance.

### 12. ASSET DISPOSAL

#### Purpose

Retire assets.

#### Disposal Types

- Sale
- Scrap
- Donation
- Write-Off

#### Approval Required

Mandatory.

#### Finance Impact

- Remove Asset Value
- Calculate Gain/Loss

### 13. ASSET LIFECYCLE MANAGEMENT

#### Asset States

- Registered
- Allocated
- In Use
- Under Maintenance
- Returned
- Disposed

#### State Transitions

Controlled through workflow engine.

### 14. SCREEN INVENTORY

- Asset Dashboard
- Asset Register
- Asset Allocation Dashboard
- Asset Tracking Dashboard
- Maintenance Dashboard
- Depreciation Dashboard
- Transfer Dashboard
- Return Dashboard
- Disposal Dashboard
- Asset Lifecycle Dashboard

### 15. APPROVAL WORKFLOWS

#### Asset Allocation

```
Asset Manager
↓
Department Head
↓
Approved
```

#### Asset Transfer

```
Requester
↓
Asset Manager
↓
Approved
```

#### Asset Disposal

```
Asset Manager
↓
Finance Manager
↓
CFO
↓
Approved
```

### 16. NOTIFICATIONS

Events

- Asset Allocated
- Asset Returned
- Maintenance Due
- Maintenance Completed
- Depreciation Run
- Asset Disposal Approved

Channels

- Email
- In-App
- WhatsApp

### 17. AUDIT REQUIREMENTS

Track:

- Asset Creation
- Asset Allocation
- Asset Transfer
- Maintenance Updates
- Depreciation Posting
- Disposal Approval

#### Retention

7 Years Minimum

### 18. DATABASE TABLES

- assets
- asset_categories
- asset_allocations
- asset_transfers
- asset_returns
- asset_maintenance
- maintenance_vendors
- asset_depreciation
- asset_disposals
- asset_lifecycle_logs

### 19. KEY RELATIONSHIPS

```
Asset
1:N Allocations

Asset
1:N Maintenance Records

Asset
1:N Depreciation Entries

Asset
1:N Transfers

Employee
1:N Asset Allocations
```

### 20. API SPECIFICATIONS

#### Asset APIs

```
GET /api/v1/assets

POST /api/v1/assets

PUT /api/v1/assets/{id}
```

#### Allocation APIs

```
GET /api/v1/asset-allocations

POST /api/v1/asset-allocations
```

#### Maintenance APIs

```
GET /api/v1/maintenance

POST /api/v1/maintenance
```

#### Disposal APIs

```
GET /api/v1/disposals

POST /api/v1/disposals
```

### 21. REPORTS

#### Asset Reports

- Asset Register Report
- Asset Allocation Report
- Asset Utilization Report
- Maintenance Cost Report
- Depreciation Report
- Asset Transfer Report
- Asset Disposal Report
- Asset Lifecycle Report

### 22. ACCEPTANCE CRITERIA

✅ Asset registration works

✅ Asset allocation works

✅ Asset transfer workflow works

✅ Maintenance schedules work

✅ Depreciation calculated correctly

✅ Asset return process works

✅ Disposal workflow works

✅ Finance postings generated

### 23. UAT SCENARIOS

#### UAT-001

Register Asset

Expected:

Asset Created Successfully

#### UAT-002

Allocate Asset

Expected:

Asset Assigned To Employee

#### UAT-003

Run Depreciation

Expected:

Depreciation Entry Generated

#### UAT-004

Transfer Asset

Expected:

Ownership Updated

#### UAT-005

Dispose Asset

Expected:

Asset Status Changed To Disposed

### ARCHITECT REVIEW

FRD-12 Asset Management Domain is now locked.

#### Dependency Chain

```
Foundation
↓
Organization
↓
Master Data
↓
Procurement
↓
Assets
↓
Finance
↓
HR
```

#### Critical Observation

Asset Domain now supports:

- Complete Asset Lifecycle
- Employee Asset Tracking
- Preventive Maintenance
- Depreciation Accounting
- Asset Transfers
- Disposal Governance
- Audit Compliance


---

## FRD-13 Manufacturing Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Upstream dependency: [FRD-08 Inventory & Warehouse Domain](./FRD-08-Inventory-Warehouse-Domain.md)
- Downstream dependency: [FRD-14 Quality Management Domain](./FRD-14-Quality-Management-Domain.md)

### 1. PURPOSE

Manufacturing Domain raw materials ko finished goods mein convert karne ke complete production lifecycle ko manage karega.

#### Business Objectives

- Production Planning
- Material Requirement Planning (MRP)
- Shop Floor Control
- Capacity Optimization
- Cost Control
- Quality Assurance
- Production Traceability

### 2. MODULES COVERED

- Bill Of Materials (BOM)
- Routing Management
- Production Planning
- Material Requirement Planning (MRP)
- Work Orders
- Capacity Planning
- Shop Floor Control
- Material Consumption
- Production Execution
- Finished Goods Receipt
- Scrap Management
- Rework Management
- Production Costing

### 3. MANUFACTURING LIFECYCLE

```
Demand
↓
Production Planning
↓
MRP
↓
Work Order
↓
Material Issue
↓
Production
↓
Quality Check
↓
Finished Goods Receipt
↓
Inventory
↓
Sales
```

### 4. BILL OF MATERIALS (BOM)

#### Purpose

Define finished product structure.

#### BOM Fields

| Field | Mandatory |
|---|---|
| BOM Number | Yes |
| Product | Yes |
| Revision | Yes |
| Effective Date | Yes |
| Status | Yes |

#### BOM Number

```
BOM-2026-000001
```

#### BOM Components

| Field |
|---|
| Raw Material |
| Quantity |
| UOM |
| Scrap % |
| Alternative Material |

#### Example

```
Laptop

├── Motherboard
├── RAM
├── SSD
├── Battery
└── Screen
```

### 5. BOM VERSION CONTROL

#### Purpose

Track engineering changes.

#### Status

- Draft
- Active
- Obsolete

#### Rule

Only one active BOM per product.

### 6. ROUTING MANAGEMENT

#### Purpose

Define manufacturing operations.

#### Example

```
Cutting
↓
Assembly
↓
Testing
↓
Packaging
```

#### Routing Fields

| Field |
|---|
| Routing Code |
| Operation |
| Work Center |
| Standard Time |
| Setup Time |

### 7. WORK CENTER MANAGEMENT

#### Purpose

Manage production resources.

#### Work Center Types

- Machine
- Assembly Line
- Packaging Line
- Inspection Station

#### Fields

| Field |
|---|
| Work Center Code |
| Capacity |
| Shift |
| Status |

### 8. PRODUCTION PLANNING

#### Purpose

Create production schedules.

#### Planning Inputs

- Sales Forecast
- Sales Orders
- Inventory Levels
- Production Capacity

#### Outputs

- Production Plan
- Work Orders
- Material Requirements

### 9. MATERIAL REQUIREMENT PLANNING (MRP)

#### Purpose

Calculate material requirements.

#### Inputs

- Production Plan
- Current Inventory
- Open Purchase Orders
- BOM

#### Outputs

- Material Shortages
- Purchase Requisitions
- Production Orders

#### Formula

```
Required Material
=
Planned Production
×
BOM Quantity
```

### 10. WORK ORDER MANAGEMENT

#### Purpose

Execute manufacturing jobs.

#### Work Order Fields

| Field |
|---|
| Work Order Number |
| Product |
| Quantity |
| Planned Start |
| Planned End |
| Status |

#### Work Order Number

```
WO-2026-000001
```

#### Status

- Draft
- Released
- In Progress
- Completed
- Closed
- Cancelled

### 11. MATERIAL ISSUE

#### Purpose

Issue raw materials to production.

#### Inventory Impact

```
Raw Material Stock
↓
Consumed
```

#### Validation

Material must exist in inventory.

### 12. PRODUCTION EXECUTION

#### Purpose

Track actual production.

#### Data Captured

- Produced Quantity
- Rejected Quantity
- Scrap Quantity
- Operator
- Machine

### 13. SHOP FLOOR CONTROL

#### Purpose

Monitor production operations.

#### Features

- Work Order Tracking
- Machine Status
- Operator Tracking
- Production Monitoring

#### Machine Status

- Idle
- Running
- Maintenance
- Breakdown

### 14. CAPACITY PLANNING

#### Purpose

Optimize production resources.

#### Inputs

- Machine Capacity
- Labor Capacity
- Shift Capacity

#### Outputs

- Utilization %
- Available Capacity
- Overload Alerts

### 15. FINISHED GOODS RECEIPT

#### Purpose

Move production output into inventory.

#### Inventory Impact

```
Finished Goods Stock
↑
Increase
```

#### Trigger

Completed Work Order.

### 16. SCRAP MANAGEMENT

#### Purpose

Track production waste.

#### Scrap Types

- Material Scrap
- Process Scrap
- Damaged Goods

#### Fields

| Field |
|---|
| Scrap Quantity |
| Reason |
| Cost Impact |

### 17. REWORK MANAGEMENT

#### Purpose

Correct defective production.

#### Rework Triggers

- Quality Failure
- Customer Return
- Production Error

#### Workflow

```
Defect
↓
Inspection
↓
Rework Order
↓
Completion
```

### 18. PRODUCTION COSTING

#### Purpose

Calculate manufacturing costs.

#### Cost Components

- Material Cost
- Labor Cost
- Machine Cost
- Overhead Cost

#### Formula

```
Production Cost
=
Material
+
Labor
+
Overheads
```

### 19. ACCOUNTING IMPACT

#### Material Issue

- WIP Dr
- Raw Material Inventory Cr

#### Finished Goods Receipt

- Finished Goods Inventory Dr
- WIP Cr

#### Scrap

- Scrap Expense Dr
- Inventory Cr

### 20. SCREEN INVENTORY

- Manufacturing Dashboard
- BOM Management
- Routing Dashboard
- MRP Dashboard
- Production Plan Dashboard
- Work Order Dashboard
- Shop Floor Dashboard
- Capacity Dashboard
- Material Issue Dashboard
- Production Cost Dashboard
- Scrap Dashboard
- Rework Dashboard

### 21. APPROVAL WORKFLOWS

#### BOM Approval

```
Engineer
↓
Production Manager
↓
Approved
```

#### Production Plan Approval

```
Planner
↓
Production Head
↓
Approved
```

#### Work Order Release

```
Production Manager
↓
Approved
```

#### Scrap Approval

```
Supervisor
↓
Production Manager
↓
Finance
↓
Approved
```

### 22. NOTIFICATIONS

Events

- MRP Shortage Alert
- Work Order Released
- Production Completed
- Machine Breakdown
- Capacity Overload
- Scrap Exceeded Threshold

Channels

- Email
- In-App
- WhatsApp

### 23. AUDIT REQUIREMENTS

Track:

- BOM Changes
- Routing Changes
- Work Order Changes
- Material Issues
- Production Entries
- Scrap Entries
- Rework Orders

### 24. DATABASE TABLES

- boms
- bom_components
- routing_headers
- routing_operations
- work_centers
- production_plans
- mrp_runs
- mrp_requirements
- work_orders
- material_issues
- production_entries
- finished_goods_receipts
- scrap_records
- rework_orders
- production_costs

### 25. KEY RELATIONSHIPS

```
Product
1:N BOMs

BOM
1:N BOM Components

Product
1:N Work Orders

Work Order
1:N Material Issues

Work Order
1:N Production Entries

Work Order
1:N Scrap Records
```

### 26. API SPECIFICATIONS

#### BOM APIs

```
GET /api/v1/boms

POST /api/v1/boms

PUT /api/v1/boms/{id}
```

#### Work Order APIs

```
GET /api/v1/work-orders

POST /api/v1/work-orders

PUT /api/v1/work-orders/{id}
```

#### MRP APIs

```
POST /api/v1/mrp/run

GET /api/v1/mrp/results
```

#### Production APIs

```
POST /api/v1/production/entry

POST /api/v1/material-issue
```

### 27. REPORTS

#### Manufacturing Reports

- BOM Report
- Production Plan Report
- MRP Shortage Report
- Work Order Report
- Capacity Utilization Report
- Production Cost Report
- Scrap Analysis Report
- Rework Analysis Report
- Machine Utilization Report

### 28. ACCEPTANCE CRITERIA

✅ BOM management works

✅ MRP calculates shortages correctly

✅ Work orders execute successfully

✅ Material consumption tracked

✅ Finished goods inventory updated

✅ Production costing calculated

✅ Scrap tracked accurately

✅ Finance postings generated

### 29. UAT SCENARIOS

#### UAT-001

Create BOM

Expected:

BOM Saved Successfully

#### UAT-002

Run MRP

Expected:

Material Shortages Generated

#### UAT-003

Release Work Order

Expected:

Production Started

#### UAT-004

Complete Production

Expected:

Finished Goods Added To Inventory

#### UAT-005

Record Scrap

Expected:

Scrap Cost Captured

### ARCHITECT REVIEW

FRD-13 Manufacturing Domain is now locked.

#### Critical Enterprise Gap Identified

Before moving further, Manufacturing ke baad FRD-14 Quality Management aana mandatory hai.

Reason:

```
Procurement
↓
Incoming Quality Check

Manufacturing
↓
In Process Quality Check

Finished Goods
↓
Final Quality Check

Customer
↓
Complaint Quality Check
```


---

## FRD-14 Quality Management Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Upstream dependencies: [FRD-07 Procurement Domain](./FRD-07-Procurement-Domain.md), [FRD-13 Manufacturing Domain](./FRD-13-Manufacturing-Domain.md)
- Downstream dependency: [FRD-08 Inventory & Warehouse Domain](./FRD-08-Inventory-Warehouse-Domain.md)

### 1. PURPOSE

Quality Management Domain product aur process quality ensure karega.

#### Business Objectives

- Defect Prevention
- Process Standardization
- Regulatory Compliance
- Product Quality Assurance
- Customer Satisfaction
- Continuous Improvement

### 2. MODULES COVERED

- Quality Planning
- Incoming Quality Inspection
- In-Process Quality Inspection
- Final Quality Inspection
- Quality Control (QC)
- Quality Assurance (QA)
- Non-Conformance Management (NCR)
- CAPA Management
- Quality Audits
- Compliance Management
- Customer Quality Complaints

### 3. QUALITY LIFECYCLE

```
Quality Plan
↓
Incoming Inspection
↓
In Process Inspection
↓
Final Inspection
↓
Release
↓
Customer Feedback
↓
Corrective Action
```

### 4. QUALITY PLANNING

#### Purpose

Define quality standards.

#### Fields

| Field | Mandatory |
|---|---|
| Plan Code | Yes |
| Plan Name | Yes |
| Product Category | Yes |
| Inspection Type | Yes |
| Status | Yes |

#### Inspection Types

- Incoming
- In Process
- Final
- Customer Return

### 5. INCOMING QUALITY INSPECTION

#### Purpose

Inspect purchased materials.

#### Trigger

Goods Receipt Note (GRN)

#### Inspection Result

- Accepted
- Rejected
- Conditional Acceptance

#### Business Rule

Rejected Material:

Cannot Enter Production

### 6. IN-PROCESS QUALITY INSPECTION

#### Purpose

Check production quality during manufacturing.

#### Inspection Points

- Operation 1
- Operation 2
- Operation 3

#### Data Captured

| Field |
|---|
| Work Order |
| Operation |
| Inspector |
| Result |

### 7. FINAL QUALITY INSPECTION

#### Purpose

Inspect finished goods.

#### Outcomes

- Approved
- Rejected
- Rework Required

#### Business Rule

Only approved products can enter finished goods inventory.

### 8. QUALITY CHECKLIST MANAGEMENT

#### Purpose

Standardize inspections.

#### Checklist Types

- Product Quality
- Process Quality
- Safety Quality
- Compliance Quality

#### Example

- Dimension Check
- Weight Check
- Packaging Check
- Label Check

### 9. NON-CONFORMANCE MANAGEMENT (NCR)

#### Purpose

Track defects.

#### NCR Fields

| Field |
|---|
| NCR Number |
| Source |
| Severity |
| Description |
| Status |

#### Severity Levels

- Minor
- Major
- Critical

#### NCR Number

```
NCR-2026-000001
```

### 10. CORRECTIVE & PREVENTIVE ACTION (CAPA)

#### Purpose

Prevent recurring issues.

#### CAPA Fields

| Field |
|---|
| CAPA Number |
| NCR Reference |
| Root Cause |
| Corrective Action |
| Preventive Action |

#### Workflow

```
Issue
↓
Root Cause Analysis
↓
Corrective Action
↓
Verification
↓
Closure
```

### 11. QUALITY AUDIT MANAGEMENT

#### Purpose

Internal quality reviews.

#### Audit Types

- Internal Audit
- Supplier Audit
- Process Audit
- Compliance Audit

#### Audit Status

- Planned
- In Progress
- Completed
- Closed

### 12. COMPLIANCE MANAGEMENT

#### Purpose

Meet regulatory requirements.

#### Standards

- ISO 9001
- ISO 27001
- ISO 14001
- FDA
- GMP

#### Features

- Compliance Register
- Compliance Tracking
- Evidence Repository

### 13. CUSTOMER QUALITY COMPLAINTS

#### Purpose

Track customer-reported quality issues.

#### Complaint Types

- Defective Product
- Packaging Issue
- Performance Issue
- Wrong Product

#### Workflow

```
Complaint
↓
Investigation
↓
NCR
↓
CAPA
↓
Closure
```

### 14. QUALITY SCORE MANAGEMENT

#### Purpose

Measure quality performance.

#### KPIs

- First Pass Yield
- Defect Rate
- Rework Rate
- Customer Complaint Rate
- Supplier Quality Score

### 15. SCREEN INVENTORY

- Quality Dashboard
- Inspection Dashboard
- Incoming Inspection
- In Process Inspection
- Final Inspection
- NCR Dashboard
- CAPA Dashboard
- Audit Dashboard
- Compliance Dashboard
- Quality Reports

### 16. APPROVAL WORKFLOWS

#### NCR Approval

```
Inspector
↓
Quality Manager
↓
Approved
```

#### CAPA Approval

```
Quality Engineer
↓
Quality Manager
↓
Approved
```

#### Audit Closure

```
Auditor
↓
Quality Head
↓
Closed
```

### 17. NOTIFICATIONS

Events

- Inspection Failed
- NCR Created
- CAPA Assigned
- Audit Due
- Compliance Expiry

Channels

- Email
- In-App
- WhatsApp

### 18. AUDIT REQUIREMENTS

Track:

- Inspection Results
- Checklist Changes
- NCR Updates
- CAPA Updates
- Audit Findings
- Compliance Records

### 19. DATABASE TABLES

- quality_plans
- quality_checklists
- incoming_inspections
- inprocess_inspections
- final_inspections
- ncr_records
- capa_records
- quality_audits
- audit_findings
- compliance_register
- customer_complaints

### 20. KEY RELATIONSHIPS

```
GRN
1:N Incoming Inspections

Work Order
1:N In Process Inspections

Finished Goods
1:N Final Inspections

NCR
1:N CAPA Records

Audit
1:N Findings
```

### 21. API SPECIFICATIONS

#### Inspection APIs

```
GET /api/v1/inspections

POST /api/v1/inspections
```

#### NCR APIs

```
GET /api/v1/ncrs

POST /api/v1/ncrs

PUT /api/v1/ncrs/{id}
```

#### CAPA APIs

```
GET /api/v1/capas

POST /api/v1/capas
```

### 22. REPORTS

#### Quality Reports

- Incoming Inspection Report
- Production Quality Report
- NCR Report
- CAPA Report
- Supplier Quality Report
- Customer Complaint Report
- Audit Findings Report
- Compliance Status Report

### 23. ACCEPTANCE CRITERIA

✅ Incoming inspections work

✅ Production inspections work

✅ NCR workflow works

✅ CAPA workflow works

✅ Audit management works

✅ Compliance tracking works

✅ Customer complaints tracked

✅ Quality KPIs generated

### 24. UAT SCENARIOS

#### UAT-001

Inspect Incoming Material

Expected:

Inspection Result Recorded

#### UAT-002

Create NCR

Expected:

NCR Created Successfully

#### UAT-003

Create CAPA

Expected:

Corrective Action Assigned

#### UAT-004

Conduct Audit

Expected:

Findings Recorded

#### UAT-005

Process Customer Complaint

Expected:

Complaint Closed Successfully

### ARCHITECT REVIEW

FRD-14 Quality Management Domain is now locked.

#### Dependency Chain

```
Procurement
↓
Quality
↓
Manufacturing
↓
Inventory
↓
Customer
```

#### Critical Observation

Quality module now supports:

- Supplier Quality Control
- Production Quality Control
- Finished Goods Quality
- NCR Management
- CAPA Management
- Audit & Compliance
- Customer Complaint Resolution


---

## FRD-15 Supply Chain Management (SCM) Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Related upstream/downstream: [FRD-07 Procurement Domain](./FRD-07-Procurement-Domain.md), [FRD-08 Inventory & Warehouse Domain](./FRD-08-Inventory-Warehouse-Domain.md), [FRD-13 Manufacturing Domain](./FRD-13-Manufacturing-Domain.md)

### 1. PURPOSE

Supply Chain Management Domain end-to-end material aur product flow ko optimize karega.

#### Business Objectives

- Demand Forecasting
- Supply Planning
- Distribution Optimization
- Logistics Visibility
- Supplier Collaboration
- Cost Reduction
- Service Level Improvement

### 2. MODULES COVERED

- Demand Planning
- Demand Forecasting
- Supply Planning
- Distribution Planning
- Logistics Management
- Shipment Tracking
- Supplier Collaboration
- Transportation Management
- Network Planning
- Supply Chain Analytics

### 3. SCM LIFECYCLE

```
Demand Forecast
↓
Supply Plan
↓
Procurement
↓
Manufacturing
↓
Inventory
↓
Distribution
↓
Shipment
↓
Customer
```

### 4. DEMAND PLANNING

#### Purpose

Estimate future demand.

#### Forecast Inputs

- Sales History
- Sales Orders
- Market Trends
- Seasonality
- Promotions
- Manual Forecast

#### Forecast Types

- Monthly
- Quarterly
- Yearly

#### Outputs

- Forecast Quantity
- Forecast Revenue
- Forecast Accuracy

### 5. DEMAND FORECASTING

#### Methods

- Manual
- Statistical
- AI Based
- Hybrid

#### KPIs

- Forecast Accuracy %
- Forecast Bias
- Forecast Error

### 6. SUPPLY PLANNING

#### Purpose

Match supply with demand.

#### Inputs

- Demand Forecast
- Current Inventory
- Production Capacity
- Open Purchase Orders

#### Outputs

- Procurement Plan
- Production Plan
- Transfer Plan

### 7. DISTRIBUTION PLANNING

#### Purpose

Allocate inventory across warehouses.

#### Planning Factors

- Warehouse Capacity
- Regional Demand
- Transit Time
- Inventory Levels

#### Outputs

- Distribution Orders
- Transfer Orders

### 8. LOGISTICS MANAGEMENT

#### Purpose

Manage movement of goods.

#### Logistics Types

- Inbound Logistics
- Outbound Logistics
- Inter Warehouse Logistics

#### Fields

| Field |
|---|
| Shipment Number |
| Carrier |
| Route |
| Dispatch Date |
| Delivery Date |

### 9. SHIPMENT TRACKING

#### Purpose

Track deliveries.

#### Shipment Status

- Planned
- Dispatched
- In Transit
- Delivered
- Delayed
- Returned

#### Tracking Data

- Location
- Carrier
- ETA
- Proof Of Delivery

### 10. SUPPLIER COLLABORATION

#### Purpose

Improve supplier coordination.

#### Features

- Supplier Portal
- RFQ Responses
- PO Acknowledgement
- Delivery Commitments
- Performance Sharing

#### Supplier Actions

- Accept PO
- Reject PO
- Update Delivery Date
- Upload Documents

### 11. TRANSPORTATION MANAGEMENT

#### Purpose

Optimize transportation.

#### Transport Modes

- Road
- Rail
- Air
- Sea

#### Planning Factors

- Cost
- Delivery Time
- Capacity
- Priority

### 12. ROUTE MANAGEMENT

#### Purpose

Optimize delivery routes.

#### Features

- Route Planning
- Route Optimization
- Route Monitoring

#### Outputs

- Distance
- Estimated Cost
- Delivery Time

### 13. NETWORK PLANNING

#### Purpose

Optimize supply chain structure.

#### Components

- Factories
- Warehouses
- Distribution Centers
- Retail Stores

#### Analysis

- Network Cost
- Coverage
- Capacity Utilization

### 14. SUPPLY CHAIN ANALYTICS

#### KPIs

- Inventory Turnover
- Fill Rate
- Order Fulfillment Rate
- On Time Delivery
- Lead Time
- Forecast Accuracy
- Logistics Cost

### 15. SCREEN INVENTORY

- SCM Dashboard
- Demand Planning Dashboard
- Forecast Dashboard
- Supply Planning Dashboard
- Distribution Dashboard
- Shipment Dashboard
- Transportation Dashboard
- Supplier Collaboration Portal
- Network Planning Dashboard
- SCM Analytics Dashboard

### 16. APPROVAL WORKFLOWS

#### Forecast Approval

```
Planner
↓
Supply Chain Manager
↓
Approved
```

#### Supply Plan Approval

```
Planner
↓
Operations Head
↓
Approved
```

#### Distribution Plan Approval

```
Distribution Manager
↓
SCM Head
↓
Approved
```

### 17. NOTIFICATIONS

Events

- Forecast Generated
- Supply Shortage
- Shipment Delayed
- PO Acknowledged
- Delivery Completed
- Transportation Exception

Channels

- Email
- In-App
- WhatsApp

### 18. AUDIT REQUIREMENTS

Track:

- Forecast Changes
- Supply Plan Changes
- Shipment Updates
- Route Changes
- Supplier Responses

### 19. DATABASE TABLES

- demand_forecasts
- forecast_versions
- supply_plans
- distribution_plans
- shipments
- shipment_tracking
- carriers
- transport_orders
- routes
- supplier_portal_users
- supplier_acknowledgements
- network_models

### 20. KEY RELATIONSHIPS

```
Forecast
1:N Supply Plans

Supply Plan
1:N Procurement Plans

Supply Plan
1:N Production Plans

Shipment
1:N Tracking Events

Carrier
1:N Shipments

Supplier
1:N Acknowledgements
```

### 21. API SPECIFICATIONS

#### Forecast APIs

```
GET /api/v1/forecasts

POST /api/v1/forecasts

PUT /api/v1/forecasts/{id}
```

#### Shipment APIs

```
GET /api/v1/shipments

POST /api/v1/shipments

PUT /api/v1/shipments/{id}
```

#### Supplier Portal APIs

```
GET /api/v1/suppliers/portal

POST /api/v1/suppliers/acknowledge
```

### 22. REPORTS

#### SCM Reports

- Demand Forecast Report
- Forecast Accuracy Report
- Supply Plan Report
- Distribution Report
- Shipment Performance Report
- Transportation Cost Report
- Supplier Collaboration Report
- Network Utilization Report

### 23. ACCEPTANCE CRITERIA

✅ Forecast generated correctly

✅ Supply planning works

✅ Distribution planning works

✅ Shipment tracking works

✅ Supplier collaboration works

✅ Transportation planning works

✅ SCM KPIs calculated

### 24. UAT SCENARIOS

#### UAT-001

Generate Forecast

Expected:

Forecast Created Successfully

#### UAT-002

Create Supply Plan

Expected:

Supply Plan Generated

#### UAT-003

Track Shipment

Expected:

Shipment Status Updated

#### UAT-004

Supplier Acknowledges PO

Expected:

Acknowledgement Recorded

#### UAT-005

View SCM Dashboard

Expected:

KPIs Displayed Correctly

### ARCHITECT REVIEW

FRD-15 SCM Domain is now locked.

#### Critical Observation

SCM module now supports:

- Demand Forecasting
- Supply Planning
- Distribution Planning
- Shipment Visibility
- Transportation Optimization
- Supplier Collaboration
- Supply Chain Analytics


---

## FRD-16 Service Management Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Upstream dependencies: [FRD-01 Foundation Domain](./FRD-01-Foundation-Domain.md), [FRD-03 Master Data Domain](./FRD-03-Master-Data-Domain.md), [FRD-12 Asset Management Domain](./FRD-12-Asset-Management-Domain.md), [FRD-17 Helpdesk & Customer Support Domain](./FRD-17-Helpdesk-Customer-Support-Domain.md)
- Downstream dependency: [FRD-04 Finance & Accounting Domain](./FRD-04-Finance-Accounting-Domain.md)

### 1. PURPOSE

Service Management Domain service delivery aur maintenance operations ko manage karega.

#### Business Objectives

- Service Request Management
- SLA Compliance
- Field Service Optimization
- Maintenance Planning
- Technician Productivity
- Customer Satisfaction

### 2. MODULES COVERED

- Service Requests
- Service Contracts
- Work Orders
- Preventive Maintenance
- Corrective Maintenance
- Breakdown Maintenance
- Field Service Management
- Technician Scheduling
- Service Parts Management
- SLA Management
- Service Billing

### 3. SERVICE LIFECYCLE

```
Service Request
↓
Assignment
↓
Work Order
↓
Technician Dispatch
↓
Service Execution
↓
Validation
↓
Closure
↓
Billing
```

### 4. SERVICE REQUEST MANAGEMENT

#### Purpose

Capture service needs.

#### Request Sources

- Customer Portal
- Email
- Phone
- Mobile App
- Helpdesk
- Manual Entry

#### Service Request Fields

| Field | Mandatory |
|---|---|
| Request Number | Yes |
| Customer | Yes |
| Asset | No |
| Service Type | Yes |
| Priority | Yes |
| Description | Yes |
| Status | Yes |

#### Request Number Format

```
SR-2026-000001
```

#### Priority Levels

- Low
- Medium
- High
- Critical

#### Status

- New
- Assigned
- In Progress
- Resolved
- Closed
- Cancelled

### 5. SERVICE CONTRACT MANAGEMENT

#### Purpose

Manage customer service agreements.

#### Contract Types

- AMC
- Warranty
- Support Contract
- Managed Services

#### Contract Fields

| Field |
|---|
| Contract Number |
| Customer |
| Start Date |
| End Date |
| Coverage |
| SLA |

#### Contract Number

```
SC-2026-000001
```

### 6. WORK ORDER MANAGEMENT

#### Purpose

Execute service activities.

#### Work Order Fields

| Field |
|---|
| Work Order Number |
| Request Reference |
| Technician |
| Scheduled Date |
| Completion Date |
| Status |

#### Work Order Number

```
WO-SRV-2026-000001
```

#### Status

- Draft
- Assigned
- In Progress
- Completed
- Closed

### 7. PREVENTIVE MAINTENANCE

#### Purpose

Avoid breakdowns.

#### Scheduling Types

- Daily
- Weekly
- Monthly
- Quarterly
- Half-Yearly
- Yearly

#### Trigger Sources

- Calendar Based
- Usage Based
- Meter Based

### 8. CORRECTIVE MAINTENANCE

#### Purpose

Fix identified issues.

#### Trigger Sources

- Inspection Failure
- Customer Complaint
- Technician Finding
- Asset Monitoring Alert

### 9. BREAKDOWN MAINTENANCE

#### Purpose

Handle urgent failures.

#### Characteristics

- Immediate Response
- High Priority
- SLA Driven

#### Escalation

Mandatory.

### 10. FIELD SERVICE MANAGEMENT

#### Purpose

Manage on-site service operations.

#### Features

- Technician Assignment
- Route Planning
- Geo Tracking
- Mobile App
- Digital Service Report

#### Technician Data

| Field |
|---|
| Technician |
| Skills |
| Certifications |
| Region |
| Availability |

### 11. TECHNICIAN SCHEDULING

#### Purpose

Optimize workforce allocation.

#### Scheduling Factors

- Skill Match
- Location
- Availability
- Priority
- SLA

#### Validation

No overlapping assignments

### 12. SERVICE PARTS MANAGEMENT

#### Purpose

Track spare part usage.

#### Sources

- Inventory
- Warehouse
- Vendor

#### Fields

| Field |
|---|
| Part |
| Quantity |
| Cost |
| Work Order |

#### Inventory Impact

```
Parts Consumption
↓
Inventory Reduction
```

### 13. SLA MANAGEMENT

#### Purpose

Track contractual commitments.

#### SLA Metrics

- Response Time
- Resolution Time
- First Time Fix Rate
- Availability

#### SLA Status

- Within SLA
- At Risk
- Breached

### 14. SERVICE BILLING

#### Purpose

Generate invoices for service activities.

#### Billing Types

- Time Based
- Fixed Price
- Contract Based
- Material Based

#### Finance Impact

- Accounts Receivable Dr
- Service Revenue Cr

### 15. SCREEN INVENTORY

- Service Dashboard
- Service Request Dashboard
- Service Contract Dashboard
- Work Order Dashboard
- Maintenance Dashboard
- Field Service Dashboard
- Technician Dashboard
- SLA Dashboard
- Service Billing Dashboard

### 16. APPROVAL WORKFLOWS

#### Service Request Escalation

```
Agent
↓
Supervisor
↓
Manager
```

#### Work Order Approval

```
Coordinator
↓
Service Manager
↓
Approved
```

#### Service Billing Approval

```
Service Manager
↓
Finance
↓
Approved
```

### 17. NOTIFICATIONS

Events

- Request Assigned
- Technician Assigned
- SLA Breach Risk
- Maintenance Due
- Work Order Completed
- Invoice Generated

Channels

- Email
- In-App
- SMS
- WhatsApp

### 18. AUDIT REQUIREMENTS

Track:

- Request Updates
- Work Order Changes
- Technician Assignment
- SLA Changes
- Maintenance Records
- Billing Activities

### 19. DATABASE TABLES

- service_requests
- service_contracts
- service_work_orders
- preventive_maintenance
- corrective_maintenance
- breakdown_maintenance
- technician_profiles
- technician_schedules
- service_parts
- sla_policies
- sla_events
- service_billings

### 20. KEY RELATIONSHIPS

```
Customer
1:N Service Requests

Contract
1:N Service Requests

Request
1:N Work Orders

Technician
1:N Work Orders

Work Order
1:N Service Parts

Contract
1:N SLA Policies
```

### 21. API SPECIFICATIONS

#### Service Request APIs

```
GET /api/v1/service-requests

POST /api/v1/service-requests

PUT /api/v1/service-requests/{id}
```

#### Work Order APIs

```
GET /api/v1/service-work-orders

POST /api/v1/service-work-orders

PUT /api/v1/service-work-orders/{id}
```

#### SLA APIs

```
GET /api/v1/sla

POST /api/v1/sla
```

### 22. REPORTS

#### Service Reports

- Service Request Report
- SLA Compliance Report
- Technician Productivity Report
- Preventive Maintenance Report
- Breakdown Analysis Report
- Service Revenue Report
- Work Order Report
- Customer Service Performance Report

### 23. ACCEPTANCE CRITERIA

✅ Service requests created successfully

✅ Work orders generated

✅ Technician scheduling works

✅ Preventive maintenance schedules generated

✅ SLA tracking accurate

✅ Service billing generated

✅ Inventory updates for spare parts

✅ Reports generated correctly

### 24. UAT SCENARIOS

#### UAT-001

Create Service Request

Expected:

Request Created Successfully

#### UAT-002

Assign Technician

Expected:

Technician Assigned

#### UAT-003

Complete Work Order

Expected:

Service Closure Recorded

#### UAT-004

SLA Breach

Expected:

Escalation Triggered

#### UAT-005

Generate Service Invoice

Expected:

Invoice Created Successfully

### ARCHITECT REVIEW

FRD-16 Service Management Domain is now locked.

#### Dependency Chain

```
Foundation
↓
Master Data
↓
Assets
↓
Helpdesk
↓
Service Management
↓
Finance
```

#### Critical Observation

Service Management now supports:

- End-to-End Service Lifecycle
- Preventive & Corrective Maintenance
- Field Service Operations
- SLA Governance
- Technician Scheduling
- Service Billing


---

## FRD-17 Helpdesk & Customer Support Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Related: [FRD-12 Asset Management Domain](./FRD-12-Asset-Management-Domain.md) (OEM & Asset Linking)
- Downstream dependency: [FRD-16 Service Management Domain](./FRD-16-Service-Management-Domain.md)

### 1. PURPOSE

Helpdesk Domain users, customers, employees aur assets se related incidents, requests aur issues ko manage karega.

#### Business Objectives

- Centralized Ticket Management
- SLA Compliance
- Faster Resolution
- Customer Satisfaction
- Service Visibility
- Knowledge Reuse

### 2. MODULES COVERED

- Ticket Management
- Incident Management
- Service Request Management
- Problem Management
- Change Management
- Knowledge Base
- SLA Management
- Escalation Management
- Customer Communication
- Support Analytics

### 3. HELPDESK LIFECYCLE

```
Issue Reported
↓
Ticket Created
↓
Assignment
↓
Investigation
↓
Resolution
↓
Validation
↓
Closure
```

### 4. TICKET MANAGEMENT

#### Purpose

Central repository of all support requests.

#### Ticket Sources

- Web Portal
- Mobile App
- Email
- Phone
- WhatsApp
- API
- Manual Entry

#### Ticket Fields

| Field | Mandatory |
|---|---|
| Ticket Number | Yes |
| Requester | Yes |
| Category | Yes |
| Priority | Yes |
| Description | Yes |
| Status | Yes |

#### Ticket Number Format

```
TKT-2026-000001
```

#### Ticket Status

- New
- Assigned
- In Progress
- Pending
- Resolved
- Closed
- Cancelled

### 5. INCIDENT MANAGEMENT

#### Purpose

Handle service interruptions.

#### Incident Categories

- Hardware
- Software
- Network
- Security
- Application
- Infrastructure

#### Impact Levels

- Low
- Medium
- High
- Critical

#### Priority Matrix

| Impact | Urgency | Priority |
|---|---|---|
| High | High | P1 |
| High | Medium | P2 |
| Medium | Medium | P3 |
| Low | Low | P4 |

### 6. SERVICE REQUEST MANAGEMENT

#### Purpose

Handle standard user requests.

#### Request Types

- Password Reset
- Software Installation
- Access Request
- Hardware Request
- Asset Allocation
- Employee Onboarding

#### Workflow

```
Request
↓
Approval
↓
Fulfillment
↓
Closure
```

### 7. PROBLEM MANAGEMENT

#### Purpose

Identify root causes.

#### Flow

```
Incident
↓
Problem Record
↓
Root Cause Analysis
↓
Known Error
↓
Permanent Fix
↓
Closure
```

#### Problem Fields

| Field |
|---|
| Problem Number |
| Root Cause |
| Impact |
| Workaround |
| Resolution |

### 8. CHANGE MANAGEMENT

#### Purpose

Control production changes.

#### Change Types

- Standard
- Normal
- Emergency

#### Change Lifecycle

```
Request
↓
Assessment
↓
Approval
↓
Implementation
↓
Validation
↓
Closure
```

#### CAB Approval

Required for:

- Normal Changes
- High Risk Changes

### 9. KNOWLEDGE BASE MANAGEMENT

#### Purpose

Reduce repetitive tickets.

#### Article Types

- How To
- FAQ
- Troubleshooting
- Known Errors
- Best Practices

#### Status

- Draft
- Review
- Published
- Archived

### 10. SLA MANAGEMENT

#### Purpose

Track support commitments.

#### SLA Metrics

- First Response Time
- Resolution Time
- Escalation Time
- Customer Response Time

#### SLA Status

- Within SLA
- Warning
- Breached

#### Example

| Priority | Response | Resolution |
|---|---|---|
| P1 | 15 Min | 4 Hours |
| P2 | 30 Min | 8 Hours |
| P3 | 4 Hours | 24 Hours |
| P4 | 1 Day | 3 Days |

### 11. ESCALATION MANAGEMENT

#### Purpose

Prevent unresolved tickets.

#### Escalation Levels

- L1 Support
- L2 Support
- L3 Support
- Manager
- Service Head

#### Auto Escalation

Triggered by:

- SLA Breach
- No Response
- Customer Escalation

### 12. CUSTOMER COMMUNICATION

#### Purpose

Maintain ticket communication history.

#### Channels

- Email
- SMS
- WhatsApp
- Portal
- Mobile App

#### Features

- Comments
- Internal Notes
- Attachments
- Communication History

### 13. OEM & ASSET LINKING (Enterprise Enhancement)

#### Purpose

Link tickets with assets and OEMs.

#### Example

```
Ticket
↓
Asset

Asset
↓
OEM

OEM
↓
Warranty

OEM
↓
Support Contract
```

#### Benefits

- Warranty Validation
- AMC Validation
- OEM Performance Analysis
- MTTR Analysis

### 14. SUPPORT ANALYTICS

#### KPIs

- Ticket Volume
- First Response Time
- Resolution Time
- SLA Compliance %
- Reopen Rate
- Customer Satisfaction (CSAT)
- MTTR
- MTBF

### 15. SCREEN INVENTORY

- Helpdesk Dashboard
- Ticket Dashboard
- Incident Dashboard
- Problem Dashboard
- Change Dashboard
- Knowledge Base
- SLA Dashboard
- Escalation Dashboard
- Customer Communication Dashboard
- Support Analytics Dashboard

### 16. APPROVAL WORKFLOWS

#### Service Request Approval

```
Requester
↓
Manager
↓
IT Team
↓
Fulfilled
```

#### Change Request Approval

```
Requester
↓
CAB Review
↓
Approval
↓
Implementation
```

#### Emergency Change

```
Requester
↓
Emergency CAB
↓
Approval
```

### 17. NOTIFICATIONS

Events

- Ticket Assigned
- Ticket Escalated
- SLA Warning
- SLA Breach
- Ticket Resolved
- Change Approved

Channels

- Email
- In-App
- SMS
- WhatsApp

### 18. AUDIT REQUIREMENTS

Track:

- Ticket Changes
- Assignment Changes
- Status Changes
- SLA Changes
- Change Approvals
- Knowledge Updates

### 19. DATABASE TABLES

- tickets
- ticket_comments
- ticket_attachments
- incidents
- problems
- known_errors
- changes
- change_approvals
- knowledge_articles
- sla_policies
- sla_events
- ticket_escalations
- customer_feedback
- ticket_asset_mapping

### 20. KEY RELATIONSHIPS

```
Customer
1:N Tickets

Ticket
1:N Comments

Ticket
1:N Attachments

Incident
1:1 Problem

Problem
1:N Known Errors

Ticket
N:1 Asset

Asset
N:1 OEM
```

### 21. API SPECIFICATIONS

#### Ticket APIs

```
GET /api/v1/tickets

POST /api/v1/tickets

PUT /api/v1/tickets/{id}
```

#### Incident APIs

```
GET /api/v1/incidents

POST /api/v1/incidents
```

#### Change APIs

```
GET /api/v1/changes

POST /api/v1/changes
```

#### Knowledge APIs

```
GET /api/v1/knowledge

POST /api/v1/knowledge
```

### 22. REPORTS

#### Helpdesk Reports

- Ticket Summary Report
- SLA Compliance Report
- MTTR Report
- Incident Report
- Problem Report
- Change Success Rate Report
- Knowledge Usage Report
- Customer Satisfaction Report
- OEM Performance Report

### 23. ACCEPTANCE CRITERIA

✅ Ticket lifecycle works

✅ Incident management works

✅ Problem management works

✅ Change approvals work

✅ SLA tracking works

✅ Auto escalation works

✅ Knowledge base searchable

✅ Asset/OEM linkage works

### 24. UAT SCENARIOS

#### UAT-001

Create Ticket

Expected:

Ticket Created Successfully

#### UAT-002

SLA Breach

Expected:

Escalation Triggered Automatically

#### UAT-003

Create Problem Record

Expected:

Problem Linked To Incident

#### UAT-004

Approve Change

Expected:

Change Released Successfully

#### UAT-005

Search Knowledge Base

Expected:

Relevant Articles Returned

### ARCHITECT REVIEW

FRD-17 Helpdesk & Customer Support Domain is now locked.

#### Important Observation

Ab tumhara ERP traditional ERP se aage nikal raha hai.

Current modules cover:

```
ERP
+
ITSM
+
Asset Lifecycle
+
OEM Intelligence Foundation
+
Service Management
```


---

## FRD-18 Business Intelligence (BI), Reporting & Analytics Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Consumes data from all operational domains: [FRD-04 Finance](./FRD-04-Finance-Accounting-Domain.md), [FRD-09 HR](./FRD-09-HR-Domain.md), [FRD-05 CRM](./FRD-05-CRM-Domain.md), [FRD-06 Sales](./FRD-06-Sales-Domain.md), [FRD-07 Procurement](./FRD-07-Procurement-Domain.md), [FRD-08 Inventory](./FRD-08-Inventory-Warehouse-Domain.md), [FRD-13 Manufacturing](./FRD-13-Manufacturing-Domain.md), [FRD-11 Projects](./FRD-11-Project-Management-Domain.md)

### 1. PURPOSE

Business Intelligence Domain ERP ke saare modules se data collect karke decision-making insights provide karega.

#### Business Objectives

- Executive Visibility
- Real-Time Monitoring
- KPI Tracking
- Predictive Insights
- Operational Reporting
- Strategic Decision Support

### 2. MODULES COVERED

- Operational Dashboards
- Executive Dashboards
- KPI Engine
- Ad Hoc Reporting
- Scheduled Reporting
- Data Warehouse
- Analytics Engine
- Cross Module Reporting
- Forecasting
- Data Export & BI Integrations

### 3. BI ARCHITECTURE

```
ERP Modules
↓
Operational Database
↓
Data Warehouse
↓
Analytics Layer
↓
Dashboards
↓
Executives
```

### 4. EXECUTIVE DASHBOARDS

#### Purpose

Provide enterprise-wide visibility.

#### CEO Dashboard

KPIs:

- Revenue
- Profit
- Cash Flow
- Sales Growth
- Customer Growth
- Project Status
- Operational Efficiency

#### CFO Dashboard

KPIs:

- AR Aging
- AP Aging
- Cash Position
- Budget Variance
- Profitability
- Tax Liability

#### COO Dashboard

KPIs:

- Production Output
- Inventory Levels
- Order Fulfillment
- Supply Chain Efficiency
- Warehouse Utilization

#### CHRO Dashboard

KPIs:

- Headcount
- Attrition
- Attendance
- Payroll Cost
- Performance Ratings
- Training Completion

### 5. OPERATIONAL DASHBOARDS

#### Sales Dashboard

- Sales Revenue
- Pipeline
- Quotation Conversion
- Top Customers
- Top Products

#### Procurement Dashboard

- Purchase Spend
- Open POs
- Vendor Performance
- Procurement Savings

#### Inventory Dashboard

- Stock Value
- Low Stock
- Inventory Aging
- Inventory Turnover

#### Manufacturing Dashboard

- Production Output
- OEE
- Capacity Utilization
- Scrap %
- Rework %

#### HR Dashboard

- Attendance
- Leaves
- Attrition
- Recruitment Pipeline

### 6. KPI ENGINE

#### Purpose

Central KPI calculation framework.

#### KPI Categories

- Financial
- Sales
- Operations
- Inventory
- Manufacturing
- HR
- Projects
- Customer Support

#### KPI Components

| Field |
|---|
| KPI Name |
| Formula |
| Target |
| Actual |
| Variance |

### 7. REPORTING ENGINE

#### Purpose

Generate reports across ERP.

#### Report Types

- Operational
- Analytical
- Compliance
- Management
- Executive

#### Formats

- PDF
- Excel
- CSV
- Dashboard
- API

### 8. AD-HOC REPORTING

#### Purpose

User-created reports.

#### Features

- Drag & Drop
- Filters
- Grouping
- Sorting
- Aggregations

#### Output

Custom Report

### 9. SCHEDULED REPORTING

#### Purpose

Automate report delivery.

#### Frequencies

- Daily
- Weekly
- Monthly
- Quarterly
- Yearly

#### Delivery Channels

- Email
- Portal
- Shared Storage

### 10. DATA WAREHOUSE

#### Purpose

Central analytics repository.

#### Data Sources

- Finance
- HR
- CRM
- Sales
- Procurement
- Inventory
- Manufacturing
- Projects

#### Refresh Modes

- Real Time
- Hourly
- Daily

### 11. ANALYTICS ENGINE

#### Purpose

Generate insights.

#### Analytics Types

- Descriptive
- Diagnostic
- Predictive
- Prescriptive

#### Examples

- Revenue Trend
- Customer Churn Risk
- Inventory Forecast
- Demand Forecast

### 12. FORECASTING

#### Purpose

Future projections.

#### Forecast Types

- Revenue Forecast
- Demand Forecast
- Cash Flow Forecast
- Workforce Forecast

#### Inputs

- Historical Data
- Current Trends
- Market Inputs

### 13. CROSS-MODULE ANALYTICS

#### Purpose

Unified enterprise reporting.

#### Examples

- Sales vs Inventory
- Projects vs Payroll
- Procurement vs Budget
- Manufacturing vs Quality
- Service vs Customer Satisfaction

### 14. SELF-SERVICE ANALYTICS

#### Purpose

Allow users to explore data.

#### Features

- Dashboard Builder
- Report Builder
- Saved Views
- Bookmarks

### 15. ALERTS & THRESHOLDS

#### Purpose

Proactive monitoring.

#### Examples

- Revenue Below Target
- Budget Exceeded
- Low Inventory
- SLA Breach
- High Attrition

#### Trigger Types

- Threshold
- Trend
- Exception

### 16. SCREEN INVENTORY

- Executive Dashboard
- Sales Analytics Dashboard
- Finance Dashboard
- Procurement Dashboard
- Inventory Dashboard
- Manufacturing Dashboard
- HR Dashboard
- Project Dashboard
- Custom Report Builder
- KPI Dashboard

### 17. APPROVAL WORKFLOWS

#### Report Publication

```
Analyst
↓
Manager
↓
Published
```

#### KPI Changes

```
Business Owner
↓
Executive Approval
↓
Active
```

### 18. NOTIFICATIONS

Events

- Scheduled Report Generated
- KPI Threshold Breached
- Forecast Generated
- Dashboard Shared

Channels

- Email
- In-App
- WhatsApp

### 19. AUDIT REQUIREMENTS

Track:

- Report Access
- Report Exports
- KPI Changes
- Dashboard Modifications
- Analytics Queries

### 20. DATABASE TABLES

- kpi_definitions
- kpi_results
- reports
- report_schedules
- report_executions
- dashboards
- dashboard_widgets
- analytics_models
- forecasts
- alerts
- alert_subscriptions
- data_warehouse_jobs

### 21. KEY RELATIONSHIPS

```
Dashboard
1:N Widgets

Report
1:N Schedules

KPI
1:N Results

Forecast
1:N Forecast Versions
```

### 22. API SPECIFICATIONS

#### Dashboard APIs

```
GET /api/v1/dashboards

POST /api/v1/dashboards
```

#### KPI APIs

```
GET /api/v1/kpis

GET /api/v1/kpis/results
```

#### Report APIs

```
GET /api/v1/reports

POST /api/v1/reports
```

### 23. REPORTS

#### Meta Reports

- Dashboard Usage Report
- KPI Performance Report
- Report Execution Report
- Forecast Accuracy Report
- User Analytics Report

### 24. ACCEPTANCE CRITERIA

✅ Executive dashboards work

✅ KPIs calculate correctly

✅ Ad-hoc reporting works

✅ Scheduled reports generated

✅ Cross-module analytics works

✅ Forecasting works

✅ Alerts generated

### 25. UAT SCENARIOS

#### UAT-001

Generate Executive Dashboard

Expected:

KPIs Displayed Correctly

#### UAT-002

Schedule Report

Expected:

Report Delivered Automatically

#### UAT-003

Create Custom Dashboard

Expected:

Dashboard Saved Successfully

#### UAT-004

Threshold Breach

Expected:

Alert Generated

#### UAT-005

Run Forecast

Expected:

Forecast Produced Successfully

### ARCHITECT REVIEW

FRD-18 BI & Analytics Domain is now locked.

#### Critical Observation

Ab ERP mein:

- Operational Layer ✓
- Transactional Layer ✓
- Planning Layer ✓
- Analytics Layer ✓


---

## FRD-19 Document Management System (DMS) Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Serves as document repository for all domains, notably [FRD-09 HR Domain](./FRD-09-HR-Domain.md), [FRD-04 Finance & Accounting Domain](./FRD-04-Finance-Accounting-Domain.md), [FRD-07 Procurement Domain](./FRD-07-Procurement-Domain.md), [FRD-11 Project Management Domain](./FRD-11-Project-Management-Domain.md), [FRD-14 Quality Management Domain](./FRD-14-Quality-Management-Domain.md), [FRD-20 GRC Domain](./FRD-20-Compliance-Risk-Governance-Domain.md)

### 1. PURPOSE

Document Management System enterprise documents ka centralized repository provide karega.

#### Business Objectives

- Centralized Document Storage
- Version Control
- Secure Access
- Approval Workflows
- Fast Search
- Compliance Retention
- Digital Records Management

### 2. MODULES COVERED

- Document Repository
- Folder Management
- Version Control
- Document Approval
- Document Classification
- Metadata Management
- OCR Processing
- Document Search
- Document Retention
- Document Archival
- Document Sharing
- e-Signature Integration

### 3. DOCUMENT LIFECYCLE

```
Create
↓
Upload
↓
Review
↓
Approval
↓
Publish
↓
Use
↓
Archive
↓
Retention Expiry
↓
Disposal
```

### 4. DOCUMENT REPOSITORY

#### Purpose

Central storage for all documents.

#### Supported File Types

- PDF
- DOCX
- XLSX
- PPTX
- TXT
- CSV
- Images
- ZIP

#### File Size

Configurable

Default:

100 MB

### 5. FOLDER MANAGEMENT

#### Purpose

Logical document organization.

#### Example Structure

```
Company
│
├── HR
│
├── Finance
│
├── Procurement
│
├── Projects
│
├── Quality
│
└── Legal
```

#### Folder Types

- System Folder
- Business Folder
- User Folder

### 6. DOCUMENT CLASSIFICATION

#### Purpose

Categorize documents.

#### Categories

- Employee Documents
- Invoices
- Contracts
- Purchase Orders
- Quality Records
- Project Documents
- Policies
- Compliance Records

#### Classification Levels

- Public
- Internal
- Confidential
- Restricted

### 7. METADATA MANAGEMENT

#### Purpose

Enable search and governance.

#### Metadata Fields

| Field |
|---|
| Document Name |
| Category |
| Owner |
| Department |
| Tags |
| Effective Date |
| Expiry Date |

#### Custom Metadata

Supported.

### 8. VERSION CONTROL

#### Purpose

Track document revisions.

#### Version Format

- 1.0
- 1.1
- 2.0

#### Actions

- Check-In
- Check-Out
- Version Compare
- Rollback

#### Business Rule

No version can be permanently overwritten.

### 9. DOCUMENT APPROVAL WORKFLOW

#### Purpose

Control document publishing.

#### Workflow

```
Draft
↓
Review
↓
Approval
↓
Published
```

#### States

- Draft
- Under Review
- Approved
- Published
- Archived
- Rejected

### 10. OCR PROCESSING

#### Purpose

Extract text from scanned documents.

#### Supported Sources

- PDF
- Images
- Scanned Files

#### Outputs

- Searchable Text
- Keywords
- Metadata Suggestions

### 11. DOCUMENT SEARCH

#### Purpose

Enterprise-wide search.

#### Search Types

- Full Text Search
- Metadata Search
- Tag Search
- Advanced Search

#### Filters

- Department
- Owner
- Date
- Category
- Version

### 12. DOCUMENT RETENTION

#### Purpose

Compliance-driven storage.

#### Retention Policies

Examples:

- HR Records - 7 Years
- Financial Records - 10 Years
- Audit Records - 10 Years
- Contracts - Contract End + 7 Years

#### Actions After Expiry

- Archive
- Delete
- Manual Review

### 13. DOCUMENT ARCHIVAL

#### Purpose

Long-term storage.

#### Archive Types

- Cold Storage
- Compliance Archive
- Legal Archive

#### Archive Access

Restricted.

### 14. DOCUMENT SHARING

#### Purpose

Controlled document distribution.

#### Sharing Types

- Internal
- External
- Temporary Link
- Role Based

#### Controls

- Expiry Date
- Password Protection
- Download Restriction

### 15. E-SIGNATURE INTEGRATION

#### Purpose

Digital approval of documents.

#### Supported Use Cases

- Contracts
- Purchase Orders
- HR Letters
- Policies
- Compliance Forms

#### Integrations

- DocuSign
- Adobe Sign
- Digital Signature APIs

### 16. SCREEN INVENTORY

- Document Dashboard
- Repository Browser
- Folder Management
- Document Upload
- Version Dashboard
- Approval Dashboard
- OCR Dashboard
- Search Center
- Retention Dashboard
- Archive Dashboard

### 17. APPROVAL WORKFLOWS

#### Policy Document

```
Author
↓
Reviewer
↓
Approver
↓
Published
```

#### Contract Document

```
Owner
↓
Legal
↓
Management
↓
Approved
```

#### Financial Document

```
Finance Executive
↓
Finance Manager
↓
Approved
```

### 18. NOTIFICATIONS

Events

- Document Uploaded
- Approval Required
- Approval Granted
- Document Expiring
- Retention Expiring
- Document Archived

Channels

- Email
- In-App
- WhatsApp

### 19. AUDIT REQUIREMENTS

Track:

- Upload
- Download
- View
- Edit
- Delete
- Approval
- Sharing

#### Audit Fields

- User
- Document
- Action
- Timestamp
- IP Address

### 20. DATABASE TABLES

- documents
- document_versions
- document_folders
- document_metadata
- document_tags
- document_approvals
- document_comments
- document_retention
- document_archives
- ocr_results
- document_shares
- esign_transactions

### 21. KEY RELATIONSHIPS

```
Document
1:N Versions

Document
1:N Metadata

Document
1:N Comments

Document
1:N Approvals

Document
1:N Shares
```

### 22. API SPECIFICATIONS

#### Document APIs

```
GET /api/v1/documents

POST /api/v1/documents

PUT /api/v1/documents/{id}
```

#### Version APIs

```
GET /api/v1/documents/{id}/versions

POST /api/v1/documents/{id}/versions
```

#### Search APIs

```
GET /api/v1/search/documents
```

#### OCR APIs

```
POST /api/v1/ocr/process
```

### 23. REPORTS

#### DMS Reports

- Document Inventory Report
- Version History Report
- Approval Report
- Retention Report
- Archive Report
- User Activity Report
- Search Analytics Report

### 24. ACCEPTANCE CRITERIA

✅ Documents uploaded successfully

✅ Version control works

✅ Approval workflow works

✅ OCR extracts searchable text

✅ Search returns relevant results

✅ Retention policies enforced

✅ e-Signature integration works

✅ Audit logs generated

### 25. UAT SCENARIOS

#### UAT-001

Upload Document

Expected:

Document Stored Successfully

#### UAT-002

Create New Version

Expected:

Version Incremented

#### UAT-003

Approve Document

Expected:

Document Published

#### UAT-004

Run OCR

Expected:

Text Extracted Successfully

#### UAT-005

Retention Expiry

Expected:

Archive Workflow Triggered

### ARCHITECT REVIEW

FRD-19 DMS Domain is now locked.

#### Current ERP Coverage

- Foundation ✓
- Organization ✓
- Master Data ✓
- Finance ✓
- CRM ✓
- Sales ✓
- Procurement ✓
- Inventory ✓
- HR ✓
- Payroll ✓
- Projects ✓
- Assets ✓
- Manufacturing ✓
- Quality ✓
- SCM ✓
- Service ✓
- Helpdesk ✓
- BI & Analytics ✓
- DMS ✓


---

## FRD-20 Compliance, Risk Management & Governance Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Related: [FRD-01 Foundation Domain](./FRD-01-Foundation-Domain.md) (Audit Engine), [FRD-19 Document Management System Domain](./FRD-19-Document-Management-System-Domain.md) (Policy & Compliance Records)

### 1. PURPOSE

Governance, Risk & Compliance (GRC) Domain organization ke compliance obligations, enterprise risks, internal controls aur governance framework ko manage karega.

#### Business Objectives

- Enterprise Risk Visibility
- Regulatory Compliance
- Internal Control Management
- Audit Readiness
- Governance Enforcement
- Business Continuity

### 2. MODULES COVERED

- Risk Management
- Risk Register
- Risk Assessment
- Internal Controls
- Compliance Management
- Compliance Register
- Policy Management
- Audit Management
- Exception Management
- Business Continuity Management (BCM)
- Governance Framework
- Regulatory Tracking

### 3. GRC LIFECYCLE

```
Identify Risk
↓
Assess Risk
↓
Define Controls
↓
Monitor Compliance
↓
Audit
↓
Corrective Action
↓
Continuous Monitoring
```

### 4. RISK MANAGEMENT

#### Purpose

Manage enterprise risks.

#### Risk Categories

- Strategic
- Operational
- Financial
- Compliance
- Cyber Security
- Vendor Risk
- Project Risk
- Reputation Risk

#### Risk Fields

| Field | Mandatory |
|---|---|
| Risk ID | Yes |
| Risk Title | Yes |
| Risk Category | Yes |
| Risk Owner | Yes |
| Impact | Yes |
| Probability | Yes |
| Status | Yes |

#### Risk Number Format

```
RSK-2026-000001
```

### 5. RISK ASSESSMENT

#### Purpose

Evaluate risk severity.

#### Impact Scale

1 - Very Low
2 - Low
3 - Medium
4 - High
5 - Critical

#### Probability Scale

1 - Rare
2 - Unlikely
3 - Possible
4 - Likely
5 - Almost Certain

#### Formula

```
Risk Score
=
Impact × Probability
```

#### Risk Levels

- 1-5 = Low
- 6-10 = Medium
- 11-15 = High
- 16-25 = Critical

### 6. RISK MITIGATION MANAGEMENT

#### Purpose

Reduce risk exposure.

#### Mitigation Options

- Accept
- Avoid
- Reduce
- Transfer

#### Mitigation Fields

| Field |
|---|
| Risk |
| Action Plan |
| Owner |
| Target Date |
| Status |

### 7. INTERNAL CONTROL MANAGEMENT

#### Purpose

Ensure operational integrity.

#### Control Types

- Preventive
- Detective
- Corrective
- Compensating

#### Examples

- Approval Workflow
- Segregation Of Duties
- Password Policies
- Audit Logs
- Reconciliations

### 8. COMPLIANCE MANAGEMENT

#### Purpose

Track regulatory obligations.

#### Compliance Areas

- Tax Compliance
- Labor Compliance
- Financial Compliance
- Information Security
- Environmental Compliance
- Industry Specific Compliance

#### Compliance Status

- Compliant
- Partially Compliant
- Non-Compliant

### 9. COMPLIANCE REGISTER

#### Purpose

Central repository of compliance obligations.

#### Fields

| Field |
|---|
| Compliance ID |
| Regulation |
| Description |
| Owner |
| Due Date |
| Status |

#### Compliance Number

```
CMP-2026-000001
```

### 10. POLICY MANAGEMENT

#### Purpose

Manage enterprise policies.

#### Policy Types

- HR Policy
- Finance Policy
- IT Policy
- Security Policy
- Procurement Policy
- Compliance Policy

#### Policy Lifecycle

```
Draft
↓
Review
↓
Approval
↓
Published
↓
Revision
```

### 11. AUDIT MANAGEMENT

#### Purpose

Plan and execute audits.

#### Audit Types

- Internal Audit
- External Audit
- Compliance Audit
- Financial Audit
- Operational Audit
- IT Audit

#### Audit Lifecycle

```
Planning
↓
Execution
↓
Findings
↓
Recommendations
↓
Closure
```

#### Audit Status

- Planned
- In Progress
- Completed
- Closed

### 12. AUDIT FINDINGS MANAGEMENT

#### Severity Levels

- Observation
- Minor
- Major
- Critical

#### Fields

| Field |
|---|
| Finding Number |
| Audit |
| Severity |
| Description |
| Action Required |

### 13. EXCEPTION MANAGEMENT

#### Purpose

Track policy deviations.

#### Examples

- Unauthorized Access
- Approval Bypass
- Process Violation
- Security Exception

#### Workflow

```
Exception
↓
Investigation
↓
Approval
↓
Closure
```

### 14. BUSINESS CONTINUITY MANAGEMENT (BCM)

#### Purpose

Prepare for disruptions.

#### Components

- Business Impact Analysis
- Recovery Plans
- Crisis Management
- Disaster Recovery
- Emergency Contacts

#### Recovery Metrics

- RTO (Recovery Time Objective)
- RPO (Recovery Point Objective)

### 15. GOVERNANCE FRAMEWORK

#### Purpose

Define organizational governance.

#### Components

- Policies
- Controls
- Approvals
- Risk Ownership
- Audit Oversight
- Compliance Oversight

### 16. REGULATORY TRACKING

#### Purpose

Monitor changing regulations.

#### Features

- Regulation Register
- Change Alerts
- Compliance Impact Analysis
- Action Tracking

### 17. SCREEN INVENTORY

- GRC Dashboard
- Risk Register
- Risk Assessment Dashboard
- Controls Dashboard
- Compliance Dashboard
- Policy Dashboard
- Audit Dashboard
- Audit Findings Dashboard
- Exception Dashboard
- BCM Dashboard
- Governance Dashboard

### 18. APPROVAL WORKFLOWS

#### Risk Approval

```
Risk Owner
↓
Department Head
↓
Risk Committee
↓
Approved
```

#### Policy Approval

```
Author
↓
Reviewer
↓
Management
↓
Approved
```

#### Audit Closure

```
Auditor
↓
Audit Manager
↓
Closed
```

#### Compliance Exception

```
Requester
↓
Compliance Officer
↓
Management
↓
Approved
```

### 19. NOTIFICATIONS

Events

- High Risk Identified
- Risk Overdue
- Compliance Due
- Compliance Breach
- Audit Scheduled
- Audit Finding Raised
- Policy Expiring
- Exception Raised

Channels

- Email
- In-App
- SMS
- WhatsApp

### 20. AUDIT REQUIREMENTS

Track:

- Risk Changes
- Control Changes
- Policy Updates
- Compliance Updates
- Audit Findings
- Exception Approvals
- Governance Actions

#### Retention

Minimum 10 Years

### 21. DATABASE TABLES

- risk_register
- risk_assessments
- risk_mitigations
- internal_controls
- compliance_register
- compliance_obligations
- policies
- policy_versions
- audits
- audit_findings
- audit_actions
- exceptions
- business_continuity_plans
- regulations
- governance_committees

### 22. KEY RELATIONSHIPS

```
Risk
1:N Assessments

Risk
1:N Mitigations

Audit
1:N Findings

Finding
1:N Corrective Actions

Policy
1:N Versions

Compliance
1:N Obligations
```

### 23. API SPECIFICATIONS

#### Risk APIs

```
GET /api/v1/risks

POST /api/v1/risks

PUT /api/v1/risks/{id}
```

#### Compliance APIs

```
GET /api/v1/compliance

POST /api/v1/compliance
```

#### Audit APIs

```
GET /api/v1/audits

POST /api/v1/audits
```

#### Policy APIs

```
GET /api/v1/policies

POST /api/v1/policies
```

### 24. REPORTS

#### GRC Reports

- Enterprise Risk Report
- Risk Heat Map
- Compliance Status Report
- Compliance Gap Analysis
- Policy Compliance Report
- Audit Findings Report
- Exception Report
- Business Continuity Readiness Report
- Regulatory Change Report

### 25. ACCEPTANCE CRITERIA

✅ Risk register maintained

✅ Risk scoring calculated correctly

✅ Compliance obligations tracked

✅ Policy lifecycle managed

✅ Audit workflows executed

✅ Findings tracked until closure

✅ Exception approvals work

✅ GRC reports generated

### 26. UAT SCENARIOS

#### UAT-001

Create Risk

Expected:

Risk Registered Successfully

#### UAT-002

Perform Risk Assessment

Expected:

Risk Score Calculated

#### UAT-003

Create Audit

Expected:

Audit Plan Created

#### UAT-004

Raise Audit Finding

Expected:

Corrective Action Triggered

#### UAT-005

Compliance Breach

Expected:

Compliance Alert Generated

### ARCHITECT REVIEW

FRD-20 GRC Domain is now locked.

#### ERP Coverage Status

- Core ERP Modules ✓
- Manufacturing ERP ✓
- SCM ✓
- HRMS ✓
- Payroll ✓
- Projects ✓
- Assets ✓
- Quality ✓
- Service Management ✓
- Helpdesk ✓
- BI & Analytics ✓
- DMS ✓
- Governance/Risk ✓


---

## FRD-21 Integration Hub & Enterprise Platform Services

### Version
1.0

### Status
Architecture Approved

### Cross References
- Provides backbone services consumed by every domain, especially [FRD-01 Foundation Domain](./FRD-01-Foundation-Domain.md) (Workflow Engine, Notification Engine, IAM, Audit)
- Downstream consumer: [FRD-22 E-Commerce & External Channel Integration Domain](./FRD-22-Ecommerce-External-Channel-Integration-Domain.md)

### 1. PURPOSE

Integration Hub & Platform Services ERP ke sabhi modules ke liye centralized infrastructure services provide karega.

Ye module business functionality nahi provide karega.

Ye ERP ka foundational backbone hoga.

#### Business Objectives

- Seamless Integrations
- Centralized Communication
- Event Driven Architecture
- Standardized APIs
- Scalability
- Extensibility
- Enterprise Connectivity

### 2. MODULES COVERED

- API Gateway
- Integration Hub
- Webhook Engine
- Event Bus
- Workflow Engine
- Notification Engine
- Email Service
- SMS Service
- WhatsApp Service
- Payment Gateway Integration
- Banking Integration
- GST/Tax Integration
- Identity Management (IAM)
- Single Sign-On (SSO)
- Scheduler Service
- Background Job Processing
- File Storage Service
- Audit Service
- Search Service

### 3. HIGH LEVEL ARCHITECTURE

```
ERP Modules
     ↓
API Gateway
     ↓
Integration Hub
     ↓
Event Bus
     ↓
Platform Services
     ↓
External Systems
```

### 4. API GATEWAY

#### Purpose

Single entry point for all APIs.

#### Features

- Routing
- Authentication
- Authorization
- Rate Limiting
- Request Validation
- API Versioning
- Logging
- Monitoring

#### API Version Format

```
/api/v1/

/api/v2/
```

#### Supported Protocols

- REST
- GraphQL
- Webhook
- gRPC (Future)

### 5. INTEGRATION HUB

#### Purpose

Central integration layer.

#### Supported Integrations

- ERP Modules
- CRM
- HRMS
- Banks
- Payment Gateways
- Tax Systems
- E-Commerce Platforms
- Third Party Applications

#### Integration Types

- Real Time
- Batch
- Event Driven
- Scheduled

### 6. EVENT BUS

#### Purpose

Enable asynchronous communication.

#### Event Examples

- SalesOrderCreated
- PurchaseOrderApproved
- EmployeeCreated
- InvoiceGenerated
- TicketClosed
- PayrollProcessed

#### Benefits

- Loose Coupling
- Scalability
- Resilience
- Performance

### 7. WEBHOOK ENGINE

#### Purpose

Push events to external systems.

#### Trigger Events

- Invoice Created
- Payment Received
- Customer Created
- Shipment Delivered
- Ticket Closed

#### Delivery Modes

- Immediate
- Retry
- Scheduled

#### Retry Strategy

- 1 Min
- 5 Min
- 15 Min
- 1 Hour
- 24 Hour

### 8. WORKFLOW ENGINE

#### Purpose

Central workflow orchestration.

#### Workflow Types

- Approval Workflow
- Business Workflow
- Escalation Workflow
- Notification Workflow

#### Components

- Steps
- Conditions
- Approvers
- Actions
- Escalations

#### Example

```
Purchase Requisition
↓
Manager
↓
Procurement Head
↓
Finance
↓
Approved
```

### 9. NOTIFICATION ENGINE

#### Purpose

Centralized notification management.

#### Channels

- Email
- SMS
- WhatsApp
- Push Notification
- In-App Notification

#### Notification Types

- Transactional
- Approval
- Reminder
- Escalation
- Alert

### 10. EMAIL SERVICE

#### Purpose

Enterprise email delivery.

#### Features

- Templates
- Bulk Email
- Attachments
- Tracking
- Retry Handling

#### Supported Providers

- SMTP
- Microsoft 365
- Google Workspace
- SendGrid
- Amazon SES

### 11. SMS SERVICE

#### Purpose

SMS delivery.

#### Supported Providers

- MSG91
- Twilio
- TextLocal
- Custom Gateway

#### Use Cases

- OTP
- Alerts
- Notifications
- Reminders

### 12. WHATSAPP SERVICE

#### Purpose

Business messaging.

#### Supported Providers

- Meta Cloud API
- Twilio
- MSG91
- Gupshup

#### Use Cases

- Approvals
- Invoices
- Tickets
- Reminders
- Customer Communication

### 13. PAYMENT GATEWAY INTEGRATION

#### Purpose

Receive payments.

#### Supported Providers

- Razorpay
- PayU
- Stripe
- PayPal
- CCAvenue

#### Payment Types

- Card
- UPI
- Net Banking
- Wallet
- International Payments

### 14. BANKING INTEGRATION

#### Purpose

Bank statement and payment automation.

#### Features

- Bank Statement Import
- Auto Reconciliation
- Payment File Generation
- Transaction Sync

#### Formats

- CSV
- Excel
- MT940
- ISO20022

### 15. GST / TAX INTEGRATION

#### Purpose

Tax compliance automation.

#### Features

- GST Validation
- GST Filing Data
- Tax Calculation
- Tax Reconciliation

#### Supported Countries

- India (GST)
- UAE (VAT)
- EU (VAT)
- US (Sales Tax)

### 16. IDENTITY & ACCESS MANAGEMENT (IAM)

#### Purpose

Central identity platform.

#### Features

- User Authentication
- RBAC
- Permission Management
- Session Management
- MFA

#### Authentication Methods

- Password
- OTP
- MFA
- SSO
- OAuth

### 17. SINGLE SIGN-ON (SSO)

#### Purpose

Unified login experience.

#### Supported Providers

- Microsoft Entra ID
- Google Workspace
- Okta
- Auth0
- LDAP

#### Protocols

- SAML 2.0
- OAuth 2.0
- OpenID Connect

### 18. SCHEDULER SERVICE

#### Purpose

Run scheduled jobs.

#### Examples

- Payroll Processing
- Report Generation
- Data Synchronization
- Backup Jobs
- Notifications

#### Frequencies

- Hourly
- Daily
- Weekly
- Monthly

### 19. BACKGROUND JOB PROCESSOR

#### Purpose

Execute long-running tasks.

#### Examples

- Bulk Email
- Payroll Run
- MRP Calculation
- Forecast Generation
- File Processing

#### Status

- Queued
- Running
- Completed
- Failed

### 20. FILE STORAGE SERVICE

#### Purpose

Central document storage.

#### Storage Types

- Local Storage
- AWS S3
- Azure Blob
- Google Cloud Storage

#### Features

- Versioning
- Encryption
- Retention
- Archival

### 21. ENTERPRISE SEARCH SERVICE

#### Purpose

Global ERP search.

#### Search Sources

- Customers
- Employees
- Invoices
- Tickets
- Assets
- Documents
- Products

#### Search Types

- Keyword
- Full Text
- Metadata
- Advanced Search

### 22. AUDIT SERVICE

#### Purpose

Central audit logging.

#### Events

- Login
- Logout
- Create
- Update
- Delete
- Approval
- Export

#### Retention

Minimum 10 Years

### 23. SCREEN INVENTORY

- Integration Dashboard
- API Gateway Dashboard
- Webhook Dashboard
- Workflow Designer
- Notification Center
- Email Dashboard
- SMS Dashboard
- WhatsApp Dashboard
- Payment Gateway Dashboard
- Scheduler Dashboard
- Background Jobs Dashboard
- SSO Dashboard
- Audit Dashboard

### 24. APPROVAL WORKFLOWS

#### Integration Approval

```
Developer
↓
Architect
↓
Approved
```

#### API Publication

```
Developer
↓
Tech Lead
↓
Published
```

#### Workflow Deployment

```
Business Analyst
↓
Administrator
↓
Active
```

### 25. NOTIFICATIONS

Events

- Integration Failed
- Webhook Failed
- Payment Received
- SSO Login Failure
- Job Failed
- API Rate Limit Exceeded

Channels

- Email
- SMS
- WhatsApp
- In-App

### 26. AUDIT REQUIREMENTS

Track:

- API Calls
- Workflow Changes
- Webhook Deliveries
- SSO Logins
- Payment Events
- Scheduler Runs

### 27. DATABASE TABLES

- api_clients
- api_keys
- api_logs
- integration_endpoints
- integration_jobs
- event_bus_events
- webhook_subscriptions
- webhook_deliveries
- workflow_definitions
- workflow_instances
- notifications
- notification_templates
- email_logs
- sms_logs
- whatsapp_logs
- payment_transactions
- bank_integrations
- tax_integrations
- sso_providers
- scheduled_jobs
- background_jobs
- audit_logs
- search_indexes

### 28. KEY RELATIONSHIPS

```
Workflow
1:N Workflow Instances

Notification Template
1:N Notifications

API Client
1:N API Logs

Webhook
1:N Deliveries

SSO Provider
1:N Users

Scheduled Job
1:N Executions
```

### 29. API SPECIFICATIONS

#### Integration APIs

```
GET /api/v1/integrations

POST /api/v1/integrations
```

#### Workflow APIs

```
GET /api/v1/workflows

POST /api/v1/workflows
```

#### Notification APIs

```
POST /api/v1/notifications/send
```

#### Webhook APIs

```
POST /api/v1/webhooks/register
```

### 30. REPORTS

#### Platform Reports

- API Usage Report
- Integration Health Report
- Workflow Execution Report
- Notification Delivery Report
- Webhook Failure Report
- Payment Gateway Report
- SSO Usage Report
- Audit Activity Report

### 31. ACCEPTANCE CRITERIA

✅ API Gateway routes requests correctly

✅ Workflow engine executes workflows

✅ Notifications delivered successfully

✅ Webhooks delivered with retry

✅ SSO works

✅ Payment integration works

✅ Audit logs generated

✅ Search indexes updated

### 32. UAT SCENARIOS

#### UAT-001

Publish API

Expected:

API Accessible Through Gateway

#### UAT-002

Execute Workflow

Expected:

Workflow Completed Successfully

#### UAT-003

Send Notification

Expected:

Notification Delivered

#### UAT-004

Receive Payment

Expected:

Transaction Recorded

#### UAT-005

SSO Login

Expected:

User Authenticated Successfully


---

## FRD-22 E-Commerce & External Channel Integration Domain

### Version
1.0

### Status
Architecture Approved

### Cross References
- Upstream dependency: [FRD-21 Integration Hub & Enterprise Platform Services](./FRD-21-Integration-Hub-Enterprise-Platform-Services.md)
- Related: [FRD-06 Sales Domain](./FRD-06-Sales-Domain.md), [FRD-08 Inventory & Warehouse Domain](./FRD-08-Inventory-Warehouse-Domain.md), [FRD-03 Master Data Domain](./FRD-03-Master-Data-Domain.md)

### 1. PURPOSE

External sales channels aur ERP ke beech real-time data synchronization provide karna.

#### Business Objectives

- Omnichannel Commerce
- Real-Time Inventory Visibility
- Centralized Order Management
- Customer Data Synchronization
- Marketplace Integration
- Revenue Growth

### 2. MODULES COVERED

- Product Synchronization
- Inventory Synchronization
- Order Synchronization
- Customer Synchronization
- Marketplace Integration
- Website Integration
- Mobile App Integration
- Pricing Synchronization
- Promotion Synchronization
- External Channel Management

### 3. E-COMMERCE ARCHITECTURE

```
ERP
↓
Integration Hub
↓
E-Commerce Layer
↓
Website

Marketplace

Mobile App

B2B Portal
```

### 4. PRODUCT SYNCHRONIZATION

#### Purpose

ERP Product Master ko external channels par synchronize karna.

#### Synced Data

- SKU
- Product Name
- Description
- Images
- Category
- Brand
- Attributes
- Pricing

#### Sync Modes

- Real Time
- Scheduled
- Manual

### 5. INVENTORY SYNCHRONIZATION

#### Purpose

Inventory consistency maintain karna.

#### Sync Events

- Stock Receipt
- Stock Transfer
- Sales Order
- Return
- Adjustment

#### Business Rule

```
ERP Inventory
=
Master Inventory
```

ERP remains source of truth.

### 6. ORDER SYNCHRONIZATION

#### Purpose

External orders ko ERP mein lana.

#### Sources

- Website
- Mobile App
- Amazon
- Flipkart
- Shopify
- WooCommerce

#### Order Lifecycle

```
Order Received
↓
ERP Sales Order
↓
Inventory Reservation
↓
Invoice
↓
Shipment
↓
Delivery
```

#### Order Status

- New
- Processing
- Packed
- Shipped
- Delivered
- Returned
- Cancelled

### 7. CUSTOMER SYNCHRONIZATION

#### Purpose

Single customer view maintain karna.

#### Synced Fields

- Customer Name
- Email
- Mobile
- Addresses
- GST Number
- Order History

#### Deduplication Rules

- Email
- Mobile
- Customer Code

### 8. MARKETPLACE INTEGRATION

#### Purpose

Manage marketplace sales.

#### Supported Platforms

- Amazon
- Flipkart
- Myntra
- eBay
- Etsy
- Custom Marketplace

#### Features

- Product Sync
- Order Sync
- Inventory Sync
- Shipment Sync

### 9. WEBSITE INTEGRATION

#### Purpose

Connect ERP with company website.

#### Supported Platforms

- Shopify
- WooCommerce
- Magento
- Custom Website
- Headless Commerce

#### Functions

- Product Catalog
- Pricing
- Orders
- Customers
- Inventory

### 10. MOBILE APP INTEGRATION

#### Purpose

Support mobile commerce.

#### Features

- Catalog Sync
- Order Placement
- Order Tracking
- Customer Profile

### 11. PRICING SYNCHRONIZATION

#### Purpose

Maintain pricing consistency.

#### Pricing Types

- Retail Price
- Wholesale Price
- Contract Price
- Promotional Price

#### Sync Triggers

- Price Update
- Promotion Launch
- Contract Change

### 12. PROMOTION MANAGEMENT

#### Purpose

Synchronize marketing campaigns.

#### Promotion Types

- Discount %
- Coupon
- Bundle Offer
- Flash Sale
- Seasonal Offer

#### Channels

- Website
- Mobile App
- Marketplace

### 13. EXTERNAL CHANNEL MANAGEMENT

#### Purpose

Manage all sales channels centrally.

#### Channel Types

- B2C
- B2B
- Marketplace
- Distributor Portal
- Dealer Portal

#### Metrics

- Revenue
- Orders
- Conversion
- Returns

### 14. RETURNS MANAGEMENT

#### Purpose

Handle return requests.

#### Return Sources

- Website
- Marketplace
- Mobile App

#### Return Workflow

```
Return Request
↓
Approval
↓
Pickup
↓
Inspection
↓
Refund
```

### 15. SHIPPING & LOGISTICS INTEGRATION

#### Purpose

Automate shipping.

#### Supported Providers

- Shiprocket
- Delhivery
- Blue Dart
- FedEx
- DHL

#### Functions

- Shipment Creation
- Tracking
- Label Printing
- Delivery Updates

### 16. SCREEN INVENTORY

- E-Commerce Dashboard
- Marketplace Dashboard
- Product Sync Dashboard
- Inventory Sync Dashboard
- Order Sync Dashboard
- Customer Sync Dashboard
- Promotion Dashboard
- Return Dashboard
- Channel Performance Dashboard

### 17. APPROVAL WORKFLOWS

#### Product Publication

```
Product Manager
↓
Marketing
↓
Published
```

#### Promotion Approval

```
Marketing
↓
Sales Head
↓
Approved
```

#### Return Approval

```
Customer Service
↓
Warehouse
↓
Approved
```

### 18. NOTIFICATIONS

Events

- Order Received
- Order Shipped
- Order Delivered
- Return Requested
- Inventory Low
- Sync Failed

Channels

- Email
- SMS
- WhatsApp
- Push Notification

### 19. AUDIT REQUIREMENTS

Track:

- Product Sync
- Price Changes
- Inventory Sync
- Order Sync
- Customer Sync
- Returns

### 20. DATABASE TABLES

- sales_channels
- channel_products
- channel_inventory
- channel_orders
- channel_order_items
- channel_customers
- channel_promotions
- channel_returns
- marketplace_integrations
- shipping_integrations
- sync_logs

### 21. KEY RELATIONSHIPS

```
Channel
1:N Orders

Channel
1:N Products

Customer
1:N Orders

Order
1:N Shipments

Order
1:N Returns
```

### 22. API SPECIFICATIONS

#### Product APIs

```
POST /api/v1/channels/products/sync

GET /api/v1/channels/products
```

#### Order APIs

```
GET /api/v1/channels/orders

POST /api/v1/channels/orders/import
```

#### Inventory APIs

```
POST /api/v1/channels/inventory/sync
```

#### Customer APIs

```
POST /api/v1/channels/customers/sync
```

### 23. REPORTS

#### E-Commerce Reports

- Channel Revenue Report
- Marketplace Performance Report
- Product Performance Report
- Inventory Sync Report
- Return Analysis Report
- Promotion Performance Report
- Customer Acquisition Report

### 24. ACCEPTANCE CRITERIA

✅ Product sync works

✅ Inventory sync works

✅ Orders imported correctly

✅ Customer sync works

✅ Marketplace integration works

✅ Shipping integration works

✅ Returns workflow works

✅ Channel reports generated

### 25. UAT SCENARIOS

#### UAT-001

Publish Product

Expected:

Product Visible On Website

#### UAT-002

Place Order On Website

Expected:

ERP Sales Order Created

#### UAT-003

Inventory Update

Expected:

Channel Inventory Updated

#### UAT-004

Create Return Request

Expected:

Return Workflow Started

#### UAT-005

Marketplace Order

Expected:

Order Imported Successfully

### ARCHITECT REVIEW

FRD-22 E-Commerce & External Channel Integration Domain is now locked.

#### ENTERPRISE ERP STATUS

Ab tak humne define kar liya hai:

```
Foundation Domain ✓
Organization Domain ✓
Master Data Domain ✓

Finance & Accounting ✓
CRM ✓
Sales ✓
Procurement ✓
Inventory ✓
SCM ✓
Manufacturing ✓
Quality ✓

HR ✓
Payroll ✓
Projects ✓
Assets ✓

Service Management ✓
Helpdesk ✓

BI & Analytics ✓
DMS ✓
GRC ✓

Integration Hub ✓
E-Commerce ✓
```


---

## MASTER FRD ARCHITECT REVIEW

All 22 Domain FRDs (FRD-01 through FRD-22) are now locked under this Master FRD.

### Final ERP Coverage Status

```
Foundation Domain ✓
Organization Domain ✓
Master Data Domain ✓

Finance & Accounting ✓
CRM ✓
Sales ✓
Procurement ✓
Inventory ✓
SCM ✓
Manufacturing ✓
Quality ✓

HR ✓
Payroll ✓
Projects ✓
Assets ✓

Service Management ✓
Helpdesk ✓

BI & Analytics ✓
DMS ✓
GRC ✓

Integration Hub ✓
E-Commerce ✓
```
