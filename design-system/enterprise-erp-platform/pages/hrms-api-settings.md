# HRMS API Settings — Page Override

> Overrides `MASTER.md` for **domain content only**. Shell, fonts, and primary palette stay global.

**Route:** `/organization/users/hrms-api`  
**Entry:** Organization Users → **API settings**

## Purpose

Configure the remote HRMS integration employee API (`X-HRMS-Api-Key`) used to fetch and sync employees into ERP users.

Employee data for Organization Users comes **only** from this API (no local HRMS sync button).

The in-app `/hr` HRMS workspace is retired in this ERP: routes redirect here, and HRMS is hidden from the shell nav.

## Section order

1. PageHeader — title, back to Users, Test connection / Fetch & sync actions  
2. Alerts — error / success  
3. Connection form — base URL, employees path, API key, page size, curl preview, Save  
4. Connection test sample table (after Test)  
5. Last sync summary (after Sync)

## Defaults

- Base URL: `http://172.16.110.15:3000`
- Path: `/api/v1/hr/integration/employees`
- Header: `X-HRMS-Api-Key`

## Do not

- Show the full saved API key after load (mask only)  
- Put purple/pink gradients or dark-mode-by-default  
- Expose raw internal `/api/v1` paths as primary product copy outside the curl preview
