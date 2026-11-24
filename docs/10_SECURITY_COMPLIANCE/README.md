# Security & Compliance Pack — iConnect Plus

**Product:** iConnect Plus  
**Organisation:** Cache Digitech  
**Classification:** Internal — Confidential  
**Version:** 2.0  
**Date:** 2026-11-03  
**Deployment model:** On-premises (Cache Digitech premises) · VPN for remote access  

---

## 1. Purpose

This folder is the **authoritative security and compliance documentation pack** for **iConnect Plus** as operated by **Cache Digitech** on **internal on-premises infrastructure**. It supersedes narratives that treated public cloud SaaS (e.g. AWS RDS/S3 as primary runtime) as the production model for this assessment scope.

## 2. Deployment model (v2.0)

| Aspect | Policy |
|--------|--------|
| Hosting | Cache Digitech internal server(s) on company premises |
| Runtime | Docker Compose: web, ESS, API, Celery, PostgreSQL, Redis, RabbitMQ, MinIO (+ ClamAV, optional OpenSearch) |
| Office access | Corporate LAN → internal reverse proxy (TLS) |
| Remote access | **Cache Digitech VPN only** — no public internet exposure for application tier |
| Primary data stores | On-prem PostgreSQL + MinIO volumes |
| Backups / DR | On-premises dumps, object copies, restore drills — not cloud DB/object as primary |
| Log retention | ≥ **180 days** on-premises within India |
| Time sync | NTP to NIC/NPL or internal NTP traceable to them |
| Incident reporting | **CERT-In 6-hour** reporting obligation where applicable; PoC placeholders for Cache Digitech |

## 3. Document index

### 01 — Architecture

| Ref | Document |
|-----|----------|
| 1.1 | [Solution Architecture (HLD & LLD)](01_Architecture/1.1-Solution-Architecture-HLD-LLD.md) |
| 1.2 | [Data Flow Diagram](01_Architecture/1.2-Data-Flow-Diagram.md) |
| 1.3 | [Application Network Diagram](01_Architecture/1.3-Application-Network-Diagram.md) |
| 1.5 | [Asset & Component Inventory](01_Architecture/1.5-Asset-Component-Inventory.md) |
| 1.6 | [API Specification](01_Architecture/1.6-API-Specification.md) |
| 1.7 | [Infrastructure Shared-Responsibility Matrix](01_Architecture/1.7-Cloud-Shared-Responsibility-Matrix.md) |

### 02 — Secure Development

| Ref | Document |
|-----|----------|
| 2.1 | [Application Security Requirements](02_Secure_Development/2.1-Application-Security-Requirements.md) |
| 2.2 | [Secure SDLC & Coding Standard](02_Secure_Development/2.2-Secure-SDLC-and-Coding-Standard.md) |
| 2.3 | [Environment Separation](02_Secure_Development/2.3-Environment-Separation.md) |
| 2.4 | [Change & Release Records](02_Secure_Development/2.4-Change-and-Release-Records.md) |
| 2.5 | [Source Code Access Control](02_Secure_Development/2.5-Source-Code-Access-Control.md) |
| 2.6 | [Security Testing Reports & Remediation Tracker](02_Secure_Development/2.6-Security-Testing-Reports-and-Remediation-Tracker.md) |
| 2.7 | [Software Bill of Materials](02_Secure_Development/2.7-Software-Bill-of-Materials.md) |

### 03 — Access Control

| Ref | Document |
|-----|----------|
| 3.1 | [RBAC Matrix](03_Access_Control/3.1-RBAC-Matrix.md) |

### 04 — Data Protection

| Ref | Document |
|-----|----------|
| 4.1 | [Data Inventory & Classification](04_Data_Protection/4.1-Data-Inventory-and-Classification.md) |
| 4.2 | [Cryptography & Key Management (CBOM)](04_Data_Protection/4.2-Cryptography-and-Key-Management-CBOM.md) |
| 4.3 | [Data Retention & Deletion Schedule](04_Data_Protection/4.3-Data-Retention-and-Deletion-Schedule.md) |
| 4.4 | [Backup & Restore Procedure](04_Data_Protection/4.4-Backup-and-Restore-Procedure.md) |
| 4.5 | [Personal Data Processing Record (DPDP)](04_Data_Protection/4.5-Personal-Data-Processing-Record.md) |
| 4.6 | [Test Data & Data Masking](04_Data_Protection/4.6-Test-Data-and-Data-Masking.md) |

### 05 — Operations

| Ref | Document |
|-----|----------|
| 5.1 | [Logging & Monitoring Specification](05_Operations/5.1-Logging-and-Monitoring-Specification.md) |
| 5.2 | [Time Synchronisation Evidence](05_Operations/5.2-Time-Synchronisation-Evidence.md) |
| 5.3 | [Hardening Configuration Baseline](05_Operations/5.3-Hardening-Configuration-Baseline.md) |
| 5.4 | [Incident Response Plan & Playbooks](05_Operations/5.4-Incident-Response-Plan-and-Playbooks.md) |
| 5.5 | [BCP / DR Plan & DR Test Report](05_Operations/5.5-BCP-DR-Plan-and-DR-Test-Report.md) |
| 5.6 | [Operations Runbook (SOPs)](05_Operations/5.6-Operations-Runbook-SOPs.md) |
| 5.7 | [Capacity Plan](05_Operations/5.7-Capacity-Plan.md) |

### 06 — User Facing

| Ref | Document |
|-----|----------|
| 6.1 | [User Manual](06_User_Facing/6.1-User-Manual.md) |
| 6.2 | [Administrator Manual](06_User_Facing/6.2-Administrator-Manual.md) |
| 6.3 | [Privacy Notice & Terms of Use](06_User_Facing/6.3-Privacy-Notice-and-Terms-of-Use.md) |
| 6.4 | [AI Transparency Notice](06_User_Facing/6.4-AI-Transparency-Notice.md) |

## 4. Evidence status

Items marked **Template / Pending sign-off** require owner attestation, dated evidence attachment, or operational records before external audit submission. This pack is **Markdown only** (no PDF exports in-repo).

## 5. Application security baseline (summary)

| Control | Implementation |
|---------|----------------|
| Password storage | bcrypt |
| MFA | Optional TOTP |
| Session | JWT in HttpOnly cookies |
| Lockout | 5 failures / 15 minutes (configurable) |
| Field encryption | Fernet for designated PII/finance columns |
| Authorization | RBAC; tenant isolation |
| Deletion | Soft delete on business tables |
| Classification | `public` / `internal` / `confidential` / `restricted` |

## 6. Ownership

| Function | Owner |
|----------|-------|
| Pack maintenance | Platform / connect module owner |
| Infrastructure & VPN | Cache Digitech IT |
| CERT-In liaison | **Template / Pending sign-off** (Cache Digitech PoC) |

## 7. Change log

| Date | Version | Change |
|------|---------|--------|
| 2026-11-03 | 2.0 | On-prem + VPN model; sections 04–06 added |
