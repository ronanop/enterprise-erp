# User Profile (HRMS) — Page Override

> Overrides `MASTER.md` for **domain content only**. Shell, fonts, and primary palette stay global.

**Route:** `/organization/users/[userId]`  
**Entry:** Organization Users → Synced users → click name

## Purpose

Show the full remote HRMS employee profile for a synced ERP login. Persist fields after load; always refresh leave balances from HRMS; offer manual full refresh.

## Section order

1. PageHeader — name, code/designation, back to Users, **Refresh profile**
2. Alerts — error / status
3. Identity band — avatar, status, email/mobile, saved timestamps
4. Employment — designation, department, company, branch, manager, dates
5. Personal — name parts, gender, DOB, contacts
6. Leave balances — table (always refreshed on open)
7. Location & org labels — company/branch/work location + sync timestamps

## Behavior

- First open: fetch remote employee by code, save profile, refresh leave
- Subsequent open: use saved profile fields; always re-fetch leave from HRMS
- Refresh profile: force full re-fetch and save

## Do not

- Purple/pink gradients or dark-mode-by-default
- Emoji icons (Lucide only)
