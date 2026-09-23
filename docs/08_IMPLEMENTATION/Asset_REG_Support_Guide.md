# Asset Registration — Support Guide

## Stuck in draft

- Use **Submit** only after mandatory fields are set (name, category, type, purchase date/cost, currency).
- Validation errors return **422** with message text.

## Rejected registration

- Status `cancelled`, workflow `rejected` → use **Reopen**, edit draft, **Submit** again (new workflow instance). Same **asset code**.

## Active without GL

- **Active** means operational register + master asset link, not finance posted (ADR-REG-01).

## PO / GRN errors

- PO must be approved/sent/received/closed family; GRN must be received or partially received.
- GRN must match PO when both are provided.

## Governance off

- Reject endpoint returns error; use legacy single approve only.
